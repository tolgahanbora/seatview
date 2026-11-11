import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BusinessEntity } from '../entities/business.entity';
import { HallPlanEntity } from '../entities/hall-plan.entity';
import { VenueEntity } from '../entities/venue.entity';
import { PlanVersionEntity } from '../entities/plan-version.entity';
import { SessionEntity } from '../entities/session.entity';
import { SeatEntity } from '../entities/seat.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { loadHallSeatsFromDemo } from '../hall-from-demo';
import {
  DEMO_API_KEY,
  DEMO_BUSINESS_ID,
  DEMO_HALL_PLAN_ID,
  DEMO_PLAN_V1_ID,
  DEMO_PLAN_V2_ID,
  DEMO_SESSION_1945_ID,
  DEMO_SESSION_2215_ID,
  DEMO_VENUE_ID,
  OTHER_API_KEY,
  OTHER_BUSINESS_ID,
} from '../demo-ids';

const DEMO_STARTS = {
  s1945: new Date('2026-11-10T19:45:00+03:00'),
  s2215: new Date('2026-11-10T22:15:00+03:00'),
} as const;

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run() {
    const demoSeats = await loadHallSeatsFromDemo();
    if (demoSeats.length !== 108) {
      throw new Error('Demo seed: 108 koltuk bekleniyordu, alınan ' + demoSeats.length);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.upsert(
        BusinessEntity,
        [
          {
            id: DEMO_BUSINESS_ID,
            name: 'Meridian Sineması',
            apiKey: DEMO_API_KEY,
            embedAllowedOrigins: [
              'http://127.0.0.1:4173',
              'http://127.0.0.1:4280',
              'http://localhost:4280',
            ],
          },
          {
            id: OTHER_BUSINESS_ID,
            name: 'Diğer Sinema',
            apiKey: OTHER_API_KEY,
            embedAllowedOrigins: [],
          },
        ],
        ['id'],
      );

      await manager.upsert(
        HallPlanEntity,
        { id: DEMO_HALL_PLAN_ID, name: 'Salon 03 geometri' },
        ['id'],
      );

      await manager.upsert(
        VenueEntity,
        { id: DEMO_VENUE_ID, businessId: DEMO_BUSINESS_ID, name: 'Salon 03' },
        ['id'],
      );

      await manager.upsert(PlanVersionEntity, [
        {
          id: DEMO_PLAN_V1_ID,
          venueId: DEMO_VENUE_ID,
          hallPlanId: DEMO_HALL_PLAN_ID,
          version: 1,
          publishedAt: new Date('2026-01-01T12:00:00+03:00'),
        },
        {
          id: DEMO_PLAN_V2_ID,
          venueId: DEMO_VENUE_ID,
          hallPlanId: DEMO_HALL_PLAN_ID,
          version: 2,
          publishedAt: new Date('2026-06-01T12:00:00+03:00'),
        },
      ], ['id']);

      const existingV1Seats = await manager.count(SeatEntity, {
        where: { planVersionId: DEMO_PLAN_V1_ID },
      });
      if (existingV1Seats === 0) {
        await manager.save(
          SeatEntity,
          demoSeats.map((seat) => ({
            planVersionId: DEMO_PLAN_V1_ID,
            id: seat.id,
            hallPlanId: DEMO_HALL_PLAN_ID,
            row: seat.row,
            column: seat.column,
            category: seat.category,
            price: seat.price,
          })),
        );
      }

      const existingV2Seats = await manager.count(SeatEntity, {
        where: { planVersionId: DEMO_PLAN_V2_ID },
      });
      if (existingV2Seats === 0) {
        await manager.save(
          SeatEntity,
          demoSeats.map((seat) => ({
            planVersionId: DEMO_PLAN_V2_ID,
            id: seat.id,
            hallPlanId: DEMO_HALL_PLAN_ID,
            row: seat.row,
            column: seat.column,
            category: seat.category,
            price: seat.price + 20,
          })),
        );
      }

      await this.ensureSession(manager, {
        id: DEMO_SESSION_1945_ID,
        title: '19:45 · IMAX',
        startsAt: DEMO_STARTS.s1945,
        initialReserved: demoSeats.filter((s) => s.initiallyReserved).map((s) => s.id),
      });

      await this.ensureSession(manager, {
        id: DEMO_SESSION_2215_ID,
        title: '22:15 · IMAX',
        startsAt: DEMO_STARTS.s2215,
        initialReserved: [],
      });
    });

    this.logger.log('Demo seed tamamlandı (idempotent).');
  }

  private async ensureSession(
    manager: DataSource['manager'],
    spec: {
      id: string;
      title: string;
      startsAt: Date;
      initialReserved: string[];
    },
  ) {
    let session = await manager.findOne(SessionEntity, { where: { id: spec.id } });
    if (!session) {
      await manager.insert(SessionEntity, {
        id: spec.id,
        businessId: DEMO_BUSINESS_ID,
        venueId: DEMO_VENUE_ID,
        planVersionId: DEMO_PLAN_V1_ID,
        hallPlanId: DEMO_HALL_PLAN_ID,
        title: spec.title,
        startsAt: spec.startsAt,
        timezone: 'Europe/Istanbul',
        environment: 'test',
      });
      session = await manager.findOne(SessionEntity, { where: { id: spec.id } });
    }

    const invCount = await manager.count(InventoryEntity, {
      where: { sessionId: spec.id },
    });

    if (invCount === 0) {
      const seats = await manager.find(SeatEntity, {
        where: { planVersionId: DEMO_PLAN_V1_ID },
      });
      await manager.insert(
        InventoryEntity,
        seats.map((seat) => ({
          sessionId: spec.id,
          seatId: seat.id,
          status: spec.initialReserved.includes(seat.id) ? ('reserved' as const) : ('available' as const),
          holdId: null,
          reservationId: null,
        })),
      );
    }
  }
}
