import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BusinessEntity } from '../entities/business.entity';
import { HallPlanEntity } from '../entities/hall-plan.entity';
import { PlanDraftEntity } from '../entities/plan-draft.entity';
import { PlanVersionEntity } from '../entities/plan-version.entity';
import { SeatEntity } from '../entities/seat.entity';
import { SessionEntity } from '../entities/session.entity';
import { VenueEntity } from '../entities/venue.entity';
import {
  defaultHall48Calibration,
  emptyPlanLayout,
  PlanCategory,
  PlanLayout,
  PlanSeatDraft,
} from './plan-layout.types';
import { PlanValidationService } from './plan-validation.service';

export const REVISION_HEADER = 'if-match-revision';

@Injectable()
export class PlanDraftsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlanDraftEntity)
    private readonly drafts: Repository<PlanDraftEntity>,
    @InjectRepository(VenueEntity)
    private readonly venues: Repository<VenueEntity>,
    private readonly validation: PlanValidationService,
  ) {}

  async createDraft(business: BusinessEntity, venueId: string, title?: string) {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) {
      throw new NotFoundException('Salon bulunamadı');
    }
    if (venue.businessId !== business.id) {
      throw new ForbiddenException('Bu salona erişim yok');
    }

    const id = uuidv4();
    const layout = emptyPlanLayout();
    await this.drafts.insert({
      id,
      businessId: business.id,
      venueId: venue.id,
      hallPlanId: null,
      title: title?.trim() || 'Yeni salon planı',
      revision: 1,
      layout,
      lastPublishedRevision: null,
      lastPublishedPlanVersionId: null,
    });

    return this.getDraftForBusiness(id, business.id);
  }

  async getDraftForBusiness(draftId: string, businessId: string) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException('Taslak bulunamadı');
    }
    if (draft.businessId !== businessId) {
      throw new ForbiddenException('Bu taslağa erişim yok');
    }
    return this.toResponse(draft);
  }

  async saveDraft(
    draftId: string,
    business: BusinessEntity,
    layout: PlanLayout,
    expectedRevision: number,
    title?: string,
  ) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException('Taslak bulunamadı');
    }
    if (draft.businessId !== business.id) {
      throw new ForbiddenException('Bu taslağa erişim yok');
    }
    if (draft.revision !== expectedRevision) {
      throw new ConflictException({
        message: 'Taslak revizyonu uyuşmuyor',
        currentRevision: draft.revision,
      });
    }

    this.assertLayoutShape(layout);

    draft.layout = layout;
    if (title?.trim()) {
      draft.title = title.trim();
    }
    draft.revision += 1;
    await this.drafts.save(draft);
    return this.toResponse(draft);
  }

  async publishDraft(draftId: string, business: BusinessEntity, expectedRevision: number) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException('Taslak bulunamadı');
    }
    if (draft.businessId !== business.id) {
      throw new ForbiddenException('Bu taslağa erişim yok');
    }
    if (draft.revision !== expectedRevision) {
      throw new ConflictException({
        message: 'Taslak revizyonu uyuşmuyor',
        currentRevision: draft.revision,
      });
    }

    if (
      draft.lastPublishedRevision === draft.revision &&
      draft.lastPublishedPlanVersionId
    ) {
      const existing = await this.dataSource
        .getRepository(PlanVersionEntity)
        .findOne({ where: { id: draft.lastPublishedPlanVersionId } });
      if (existing) {
        return {
          planVersionId: existing.id,
          version: existing.version,
          seatCount: await this.dataSource.getRepository(SeatEntity).count({
            where: { planVersionId: existing.id },
          }),
          idempotent: true,
          draft: this.toResponse(draft),
        };
      }
    }

    const issues = this.validation.validate(draft.layout);
    if (issues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Plan doğrulanamadı', issues });
    }

    return this.dataSource.transaction(async (manager) => {
      let hallPlanId = draft.hallPlanId;
      if (!hallPlanId) {
        hallPlanId = uuidv4();
        await manager.insert(HallPlanEntity, {
          id: hallPlanId,
          name: draft.title,
        });
      } else {
        await manager.update(HallPlanEntity, { id: hallPlanId }, { name: draft.title });
      }

      const maxRow: { max: number | null }[] = await manager.query(
        `SELECT MAX(version) AS max FROM plan_versions WHERE venue_id = $1`,
        [draft.venueId],
      );
      const nextVersion = (maxRow[0]?.max ?? 0) + 1;
      const planVersionId = uuidv4();

      await manager.insert(PlanVersionEntity, {
        id: planVersionId,
        venueId: draft.venueId,
        hallPlanId,
        version: nextVersion,
        publishedAt: new Date(),
        layoutSnapshot: draft.layout,
        draftRevision: draft.revision,
      });

      const categoryById = new Map(draft.layout.categories.map((c) => [c.id, c]));
      for (const seat of draft.layout.seats) {
        const category = categoryById.get(seat.categoryId)!;
        await manager.insert(SeatEntity, {
          planVersionId: planVersionId,
          id: seat.uid,
          label: seat.label,
          hallPlanId,
          row: seat.row,
          column: seat.column,
          category: category.name,
          price: category.defaultPrice,
          posX: seat.x,
          posY: seat.y,
          posZ: seat.z,
        });
      }

      draft.hallPlanId = hallPlanId;
      draft.lastPublishedRevision = draft.revision;
      draft.lastPublishedPlanVersionId = planVersionId;
      await manager.save(PlanDraftEntity, draft);

      return {
        planVersionId,
        version: nextVersion,
        seatCount: draft.layout.seats.length,
        idempotent: false,
        draft: this.toResponse(draft),
      };
    });
  }

  async getDraftLayout(draftId: string, businessId: string) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException('Taslak bulunamadı');
    }
    if (draft.businessId !== businessId) {
      throw new ForbiddenException('Bu taslağa erişim yok');
    }
    return {
      draftId: draft.id,
      revision: draft.revision,
      layout: draft.layout,
    };
  }

  async getSessionLayoutPublic(sessionId: string) {
    const session = await this.dataSource.getRepository(SessionEntity).findOne({
      where: { id: sessionId },
    });
    if (!session?.planVersionId) {
      throw new NotFoundException('Seans planı bulunamadı');
    }
    const version = await this.dataSource.getRepository(PlanVersionEntity).findOne({
      where: { id: session.planVersionId },
    });
    if (!version) {
      throw new NotFoundException('Plan sürümü bulunamadı');
    }
    if (version.layoutSnapshot) {
      return {
        sessionId,
        planVersionId: version.id,
        version: version.version,
        layout: version.layoutSnapshot,
      };
    }
    return this.getPublishedLayout(version.id, session.businessId);
  }

  async getPublishedLayout(planVersionId: string, businessId: string) {
    const version = await this.dataSource.getRepository(PlanVersionEntity).findOne({
      where: { id: planVersionId },
      relations: { venue: true },
    });
    if (!version) {
      throw new NotFoundException('Plan sürümü bulunamadı');
    }
    if (version.venue.businessId !== businessId) {
      throw new ForbiddenException('Bu plana erişim yok');
    }

    if (version.layoutSnapshot) {
      return {
        planVersionId,
        version: version.version,
        layout: version.layoutSnapshot,
      };
    }

    const seats = await this.dataSource.getRepository(SeatEntity).find({
      where: { planVersionId },
      order: { row: 'ASC', column: 'ASC' },
    });

    const layout: PlanLayout = {
      screen: { width: 6, bottom: 1.4, height: 3.2 },
      calibration: { version: 1, unit: 'm', calibrated: false, eyeHeightM: 1.14 },
      sections: [{ id: 'main', name: 'Ana salon' }],
      categories: [...emptyPlanLayout().categories],
      rowBlocks: [],
      seats: seats.map((seat) => ({
        uid: seat.id,
        label: seat.label ?? seat.id,
        row: seat.row,
        column: seat.column,
        sectionId: 'main',
        categoryId: seat.category === 'VIP' ? 'cat-vip' : 'cat-std',
        x: seat.posX ?? 0,
        y: seat.posY ?? 0,
        z: seat.posZ ?? 0,
      })),
    };

    return { planVersionId, version: version.version, layout };
  }

  private assertLayoutShape(layout: PlanLayout) {
    if (!layout || !Array.isArray(layout.seats) || !Array.isArray(layout.categories)) {
      throw new UnprocessableEntityException('Geçersiz plan gövdesi');
    }
  }

  private toResponse(draft: PlanDraftEntity) {
    const issues = this.validation.validate(draft.layout);
    return {
      id: draft.id,
      venueId: draft.venueId,
      hallPlanId: draft.hallPlanId,
      title: draft.title,
      revision: draft.revision,
      layout: draft.layout,
      lastPublishedRevision: draft.lastPublishedRevision,
      lastPublishedPlanVersionId: draft.lastPublishedPlanVersionId,
      canPublish: issues.length === 0,
      validationIssues: issues,
      updatedAt: draft.updatedAt,
    };
  }

  /** Editör ve testler için 48 koltuk üreten yardımcı. */
  static buildHall48Layout(sectionId = 'main'): PlanLayout {
    const categories: PlanCategory[] = [...emptyPlanLayout().categories];
    const screen = { width: 6.0, bottom: 1.4, height: 3.2 };
    const sections = [{ id: sectionId, name: 'Ana salon' }];
    const rowBlocks = ['A', 'B', 'C', 'D'].map((row) => ({
      row,
      seatsLeft: 6,
      seatsRight: 6,
      aisleAfterSeat: 6,
      categoryId: row === 'D' ? 'cat-vip' : 'cat-std',
    }));
    return {
      screen,
      calibration: defaultHall48Calibration(),
      sections,
      categories,
      rowBlocks,
      seats: PlanDraftsService.seatsFromRowBlocks(rowBlocks, sectionId),
    };
  }

  static seatsFromRowBlocks(
    rowBlocks: PlanLayout['rowBlocks'],
    defaultSectionId: string,
  ): PlanSeatDraft[] {
    const seats: PlanSeatDraft[] = [];
    const rowIndexByLetter = (row: string) => row.charCodeAt(0) - 'A'.charCodeAt(0);
    for (const block of rowBlocks) {
      const ri = rowIndexByLetter(block.row);
      let col = 1;
      for (let i = 0; i < block.seatsLeft; i += 1) {
        seats.push(
          PlanDraftsService.makeSeat(block.row, col, block.categoryId, defaultSectionId, ri, col),
        );
        col += 1;
      }
      col += 1;
      for (let i = 0; i < block.seatsRight; i += 1) {
        seats.push(
          PlanDraftsService.makeSeat(block.row, col, block.categoryId, defaultSectionId, ri, col),
        );
        col += 1;
      }
    }
    return seats;
  }

  private static makeSeat(
    row: string,
    column: number,
    categoryId: string,
    sectionId: string,
    rowIndex: number,
    logicalCol: number,
  ): PlanSeatDraft {
    const aisleGap = 0.9;
    const pitch = 0.64;
    const xOffset =
      logicalCol <= 6
        ? (logicalCol - 3.5) * pitch - aisleGap / 2
        : (logicalCol - 9.5) * pitch + aisleGap / 2;
    return {
      uid: uuidv4(),
      label: row + column,
      row,
      column,
      sectionId,
      categoryId,
      x: xOffset,
      y: rowIndex * 0.25,
      z: 5.2 + rowIndex * 1.12,
    };
  }
}
