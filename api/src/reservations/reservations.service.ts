import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SessionSeatBlockEntity } from '../entities/session-seat-block.entity';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SessionEntity } from '../entities/session.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { HoldEntity } from '../entities/hold.entity';
import { HoldSeatEntity } from '../entities/hold-seat.entity';
import { ReservationEntity } from '../entities/reservation.entity';
import { SeatEntity } from '../entities/seat.entity';
import { BusinessEntity } from '../entities/business.entity';
import { HOLD_TTL_SECONDS } from '../demo-ids';
import { SessionEnvironment } from '../entities/session.entity';
import { SessionsService } from '../sessions/sessions.service';

type SeatRow = {
  seat_id: string;
  label: string;
  row: string;
  column: number;
  category: string;
  price: number;
  status: string;
  hold_expires_at: Date | null;
};

@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservations: Repository<ReservationEntity>,
    @InjectRepository(HoldEntity)
    private readonly holds: Repository<HoldEntity>,
    private readonly sessionsService: SessionsService,
  ) {}

  async getSessionSeats(sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }

    const rows: SeatRow[] = await this.dataSource.query(
      `
      SELECT
        s.id AS seat_id,
        COALESCE(s.label, s.id) AS label,
        s.row,
        s.column,
        s.category,
        s.price,
        CASE
          WHEN blk.seat_id IS NOT NULL THEN 'blocked'
          WHEN i.status = 'reserved' THEN 'reserved'
          WHEN i.status = 'held' AND h.expires_at > NOW() THEN 'held'
          ELSE 'available'
        END AS status,
        CASE
          WHEN i.status = 'held' AND h.expires_at > NOW() THEN h.expires_at
          ELSE NULL
        END AS hold_expires_at
      FROM inventory i
      JOIN sessions sess ON sess.id = i.session_id
      JOIN seats s ON s.id = i.seat_id
        AND (sess.plan_version_id IS NULL OR s.plan_version_id = sess.plan_version_id)
      LEFT JOIN session_seat_blocks blk ON blk.session_id = i.session_id AND blk.seat_id = i.seat_id
      LEFT JOIN holds h ON h.id = i.hold_id
      WHERE i.session_id = $1
      ORDER BY s.row, s.column
      `,
      [sessionId],
    );

    const priceMap = new Map(
      (session.categoryPrices ?? []).map((p) => [p.category, p]),
    );

    return {
      sessionId,
      salesOpen: session.salesOpen,
      seats: rows.map((row) => {
        const override = priceMap.get(row.category);
        const priceCents = override?.amountCents ?? row.price;
        return {
          seatId: row.seat_id,
          label: row.label,
          row: row.row,
          column: row.column,
          category: row.category,
          price: priceCents,
          currency: override?.currency ?? 'TRY',
          status: row.status,
          holdExpiresAt: row.hold_expires_at,
        };
      }),
    };
  }

  async createHold(
    sessionId: string,
    business: BusinessEntity,
    seatIds: string[],
    environment: SessionEnvironment,
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }
    this.sessionsService.assertSessionScope(session, business, environment);

    if (!session.salesOpen) {
      throw new ForbiddenException('Seans satışı durduruldu');
    }

    const uniqueSeatIds = [...new Set(seatIds)].sort();

    const blocked = await this.dataSource.getRepository(SessionSeatBlockEntity).find({
      where: { sessionId, seatId: In(uniqueSeatIds) },
    });
    if (blocked.length > 0) {
      throw new ConflictException('Koltuk satışa kapalı: ' + blocked.map((b) => b.seatId).join(', '));
    }

    return this.dataSource.transaction(async (manager) => {
      const seatCount = await manager.count(SeatEntity, {
        where: {
          id: In(uniqueSeatIds),
          ...(session.planVersionId ? { planVersionId: session.planVersionId } : {}),
        },
      });
      if (seatCount !== uniqueSeatIds.length) {
        throw new NotFoundException('Bilinmeyen koltuk kimliği');
      }

      const locked: InventoryEntity[] = await manager
        .createQueryBuilder(InventoryEntity, 'i')
        .setLock('pessimistic_write')
        .where('i.session_id = :sessionId', { sessionId })
        .andWhere('i.seat_id IN (:...seatIds)', { seatIds: uniqueSeatIds })
        .orderBy('i.seat_id', 'ASC')
        .getMany();

      if (locked.length !== uniqueSeatIds.length) {
        throw new ConflictException('Eksik envanter kaydı');
      }

      const holdIds = [
        ...new Set(locked.map((row) => row.holdId).filter(Boolean)),
      ] as string[];
      const activeHolds =
        holdIds.length > 0
          ? await manager.find(HoldEntity, { where: { id: In(holdIds) } })
          : [];
      const holdExpiry = new Map(activeHolds.map((h) => [h.id, h.expiresAt]));

      const nowRow: { now: Date }[] = await manager.query(`SELECT NOW() AS now`);
      const now = nowRow[0].now;

      for (const row of locked) {
        if (row.status === 'reserved') {
          throw new ConflictException('Koltuk rezerve: ' + row.seatId);
        }
        if (row.status === 'held' && row.holdId) {
          const expiresAt = holdExpiry.get(row.holdId);
          if (expiresAt && expiresAt > now) {
            throw new ConflictException('Koltuk tutulmuş: ' + row.seatId);
          }
        }
      }

      const holdId = uuidv4();
      const expiresAtRow: { expires: Date }[] = await manager.query(
        `SELECT NOW() + ($1::text || ' seconds')::interval AS expires`,
        [HOLD_TTL_SECONDS],
      );
      const expiresAt = expiresAtRow[0].expires;

      await manager.insert(HoldEntity, {
        id: holdId,
        sessionId,
        businessId: business.id,
        expiresAt,
        status: 'active',
      });

      for (const seatId of uniqueSeatIds) {
        await manager.insert(HoldSeatEntity, { holdId, seatId });
      }

      for (const row of locked) {
        await manager.update(
          InventoryEntity,
          { sessionId, seatId: row.seatId },
          { status: 'held', holdId, reservationId: null },
        );
      }

      return {
        id: holdId,
        sessionId,
        seatIds: uniqueSeatIds,
        expiresAt,
        status: 'active' as const,
      };
    });
  }

  async releaseHold(holdId: string, business: BusinessEntity, environment: SessionEnvironment) {
    await this.dataSource.transaction(async (manager) => {
      const hold = await manager.findOne(HoldEntity, { where: { id: holdId } });
      if (!hold) {
        throw new NotFoundException('Tutma bulunamadı');
      }
      if (hold.businessId !== business.id) {
        throw new ForbiddenException('Bu tutmaya erişim yok');
      }
      const session = await manager.findOne(SessionEntity, { where: { id: hold.sessionId } });
      if (session) {
        this.sessionsService.assertSessionScope(session, business, environment);
      }
      if (hold.status !== 'active') {
        return;
      }

      await manager
        .createQueryBuilder(InventoryEntity, 'i')
        .setLock('pessimistic_write')
        .where('i.session_id = :sessionId', { sessionId: hold.sessionId })
        .andWhere('i.hold_id = :holdId', { holdId })
        .orderBy('i.seat_id', 'ASC')
        .getMany();

      await manager.update(
        InventoryEntity,
        { sessionId: hold.sessionId, holdId },
        { status: 'available', holdId: null },
      );
      await manager.update(HoldEntity, { id: holdId }, { status: 'released' });
    });
  }

  async confirmHold(
    holdId: string,
    business: BusinessEntity,
    orderKey: string,
    environment: SessionEnvironment,
  ) {
    const existing = await this.reservations.findOne({
      where: { businessId: business.id, orderKey },
    });
    if (existing) {
      const seats = await this.dataSource
        .getRepository(HoldSeatEntity)
        .find({ where: { holdId: existing.holdId }, order: { seatId: 'ASC' } });
      return {
        id: existing.id,
        sessionId: existing.sessionId,
        orderKey: existing.orderKey,
        seatIds: seats.map((s) => s.seatId),
        confirmedAt: existing.confirmedAt,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const hold = await manager.findOne(HoldEntity, { where: { id: holdId } });
      if (!hold) {
        throw new NotFoundException('Tutma bulunamadı');
      }
      if (hold.businessId !== business.id) {
        throw new ForbiddenException('Bu tutmaya erişim yok');
      }
      const session = await manager.findOne(SessionEntity, { where: { id: hold.sessionId } });
      if (session) {
        this.sessionsService.assertSessionScope(session, business, environment);
      }

      const fresh: { expired: boolean }[] = await manager.query(
        `SELECT (expires_at <= NOW()) AS expired FROM holds WHERE id = $1 FOR UPDATE`,
        [holdId],
      );
      if (fresh[0]?.expired) {
        throw new GoneException('Tutma süresi dolmuş');
      }
      if (hold.status !== 'active') {
        throw new ConflictException('Tutma onaylanamaz');
      }

      const holdSeats = await manager.find(HoldSeatEntity, {
        where: { holdId },
        order: { seatId: 'ASC' },
      });
      const seatIds = holdSeats.map((s) => s.seatId);

      await manager
        .createQueryBuilder(InventoryEntity, 'i')
        .setLock('pessimistic_write')
        .where('i.session_id = :sessionId', { sessionId: hold.sessionId })
        .andWhere('i.seat_id IN (:...seatIds)', { seatIds })
        .orderBy('i.seat_id', 'ASC')
        .getMany();

      const inventory = await manager.find(InventoryEntity, {
        where: { sessionId: hold.sessionId, seatId: In(seatIds) },
      });
      for (const row of inventory) {
        if (row.holdId !== holdId || row.status !== 'held') {
          throw new ConflictException('Koltuk durumu tutma ile uyumsuz');
        }
      }

      const reservationId = uuidv4();
      const confirmedRow: { confirmed_at: Date }[] = await manager.query(
        `SELECT NOW() AS confirmed_at`,
      );
      const confirmedAt = confirmedRow[0].confirmed_at;

      await manager.insert(ReservationEntity, {
        id: reservationId,
        businessId: business.id,
        sessionId: hold.sessionId,
        holdId,
        orderKey,
        confirmedAt,
      });

      for (const seatId of seatIds) {
        await manager.update(
          InventoryEntity,
          { sessionId: hold.sessionId, seatId },
          { status: 'reserved', reservationId, holdId: null },
        );
      }
      await manager.update(HoldEntity, { id: holdId }, { status: 'confirmed' });

      return {
        id: reservationId,
        sessionId: hold.sessionId,
        orderKey,
        seatIds,
        confirmedAt,
      };
    });
  }
}
