import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BusinessEntity } from '../entities/business.entity';
import { SessionEntity, SessionEnvironment } from '../entities/session.entity';
import { PlanVersionEntity } from '../entities/plan-version.entity';
import { VenueEntity } from '../entities/venue.entity';
import { SeatEntity } from '../entities/seat.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { PatchSessionSalesDto } from './dto/patch-session-sales.dto';
import { SessionSeatBlockEntity } from '../entities/session-seat-block.entity';
import { HoldEntity } from '../entities/hold.entity';

@Injectable()
export class SessionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(PlanVersionEntity)
    private readonly planVersions: Repository<PlanVersionEntity>,
    @InjectRepository(VenueEntity)
    private readonly venues: Repository<VenueEntity>,
  ) {}

  async listVenues(businessId: string, environment: SessionEnvironment) {
    const venues = await this.venues.find({
      where: { businessId },
      relations: { planVersions: true },
      order: { name: 'ASC' },
    });
    const seatRepo = this.dataSource.getRepository(SeatEntity);
    const venuesOut = [];
    for (const venue of venues.sort((a, b) => a.name.localeCompare(b.name))) {
      const planVersions = [...venue.planVersions].sort((a, b) => a.version - b.version);
      const plans = [];
      for (const version of planVersions) {
        const seatCount = await seatRepo.count({ where: { planVersionId: version.id } });
        plans.push({
          id: version.id,
          version: version.version,
          publishedAt: version.publishedAt,
          seatCount,
        });
      }
      venuesOut.push({
        id: venue.id,
        name: venue.name,
        planVersions: plans,
      });
    }
    return {
      environment,
      venues: venuesOut,
    };
  }

  async listSessions(businessId: string, environment: SessionEnvironment) {
    const rows = await this.sessions.find({
      where: { businessId, environment },
      relations: { venue: true, planVersion: true },
      order: { startsAt: 'ASC' },
    });
    return {
      environment,
      sessions: rows.map((session) => ({
        id: session.id,
        title: session.title,
        startsAt: session.startsAt,
        timezone: session.timezone,
        venueId: session.venueId,
        venueName: session.venue?.name ?? null,
        planVersionId: session.planVersionId,
        planVersion: session.planVersion?.version ?? null,
        environment: session.environment,
      })),
    };
  }

  async getSession(sessionId: string, businessId: string, environment: SessionEnvironment) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }
    if (session.businessId !== businessId || session.environment !== environment) {
      throw new ForbiddenException('Bu seansa erişim yok');
    }

    const seatCount = session.planVersionId
      ? await this.dataSource.getRepository(SeatEntity).count({
          where: { planVersionId: session.planVersionId },
        })
      : 0;

    return {
      id: session.id,
      title: session.title,
      startsAt: session.startsAt,
      timezone: session.timezone,
      venueId: session.venueId,
      planVersionId: session.planVersionId,
      environment: session.environment,
      seatCount,
    };
  }

  assertSessionScope(
    session: SessionEntity,
    business: BusinessEntity,
    environment: SessionEnvironment,
  ) {
    if (session.businessId !== business.id) {
      throw new ForbiddenException('Bu seansa erişim yok');
    }
    if (session.environment !== environment) {
      throw new ForbiddenException('Ortam uyuşmuyor');
    }
  }

  async createSession(
    business: BusinessEntity,
    environment: SessionEnvironment,
    input: CreateSessionDto,
  ) {
    const planVersion = await this.planVersions.findOne({
      where: { id: input.planVersionId },
      relations: { venue: true },
    });
    if (!planVersion) {
      throw new NotFoundException('Plan sürümü bulunamadı');
    }
    if (planVersion.venue.businessId !== business.id) {
      throw new ForbiddenException('Plan sürümü bu işletmeye ait değil');
    }

    const seats = await this.dataSource.getRepository(SeatEntity).find({
      where: { planVersionId: planVersion.id },
      order: { row: 'ASC', column: 'ASC' },
    });
    if (seats.length === 0) {
      throw new NotFoundException('Plan sürümünde koltuk yok');
    }

  const sessionId = uuidv4();

    return this.dataSource.transaction(async (manager) => {
      await manager.insert(SessionEntity, {
        id: sessionId,
        businessId: business.id,
        venueId: planVersion.venueId,
        planVersionId: planVersion.id,
        hallPlanId: planVersion.hallPlanId,
        title: input.title,
        startsAt: new Date(input.startsAt),
        timezone: input.timezone ?? 'Europe/Istanbul',
        environment,
        salesOpen: true,
        categoryPrices: null,
      });

      const failAfter = Number(process.env.SEATVIEW_TEST_FAIL_INVENTORY_AFTER ?? '0');
      let written = 0;
      for (const seat of seats) {
        await manager.insert(InventoryEntity, {
          sessionId,
          seatId: seat.id,
          status: 'available',
          holdId: null,
          reservationId: null,
        });
        written += 1;
        if (failAfter > 0 && written >= failAfter) {
          throw new InternalServerErrorException('Test: envanter yarıda kesildi');
        }
      }

      const count = await manager.count(InventoryEntity, { where: { sessionId } });
      if (count !== seats.length) {
        throw new InternalServerErrorException('Envanter oluşturulamadı');
      }

      const session = await manager.findOne(SessionEntity, { where: { id: sessionId } });
      return {
        id: session!.id,
        title: session!.title,
        startsAt: session!.startsAt,
        timezone: session!.timezone,
        venueId: session!.venueId,
        planVersionId: session!.planVersionId,
        environment: session!.environment,
        inventoryCount: count,
      };
    });
  }

  async patchSessionSales(
    sessionId: string,
    business: BusinessEntity,
    environment: SessionEnvironment,
    input: PatchSessionSalesDto,
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }
    this.assertSessionScope(session, business, environment);

    if (input.salesOpen !== undefined) {
      session.salesOpen = input.salesOpen;
    }
    if (input.categoryPrices !== undefined) {
      session.categoryPrices = input.categoryPrices;
    }
    await this.sessions.save(session);

    const blockRepo = this.dataSource.getRepository(SessionSeatBlockEntity);
    const invRepo = this.dataSource.getRepository(InventoryEntity);

    if (input.unblockSeatIds?.length) {
      await blockRepo.delete({
        sessionId,
        seatId: In(input.unblockSeatIds),
      });
    }

    if (input.blockedSeatIds?.length) {
      for (const seatId of input.blockedSeatIds) {
        const inv = await invRepo.findOne({ where: { sessionId, seatId } });
        if (!inv) {
          throw new NotFoundException('Koltuk envanteri yok: ' + seatId);
        }
        if (inv.status === 'reserved') {
          throw new ConflictException('Rezerve koltuk bloklanamaz: ' + seatId);
        }
        if (inv.status === 'held' && inv.holdId) {
          const hold = await this.dataSource.getRepository(HoldEntity).findOne({
            where: { id: inv.holdId },
          });
          if (hold && hold.status === 'active' && hold.expiresAt > new Date()) {
            throw new ConflictException('Aktif tutmalı koltuk bloklanamaz: ' + seatId);
          }
        }
        await blockRepo.save({ sessionId, seatId, createdAt: new Date() });
      }
    }

    const blocks = await blockRepo.find({ where: { sessionId } });
    return {
      id: session.id,
      salesOpen: session.salesOpen,
      categoryPrices: session.categoryPrices,
      blockedSeatIds: blocks.map((b) => b.seatId),
    };
  }

  async getSessionSales(sessionId: string, businessId: string, environment: SessionEnvironment) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }
  if (session.businessId !== businessId || session.environment !== environment) {
      throw new ForbiddenException('Bu seansa erişim yok');
    }
    const blocks = await this.dataSource.getRepository(SessionSeatBlockEntity).find({
      where: { sessionId },
    });
    return {
      id: session.id,
      salesOpen: session.salesOpen,
      categoryPrices: session.categoryPrices,
      blockedSeatIds: blocks.map((b) => b.seatId),
    };
  }
}
