import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessEntity } from './entities/business.entity';
import { HallPlanEntity } from './entities/hall-plan.entity';
import { VenueEntity } from './entities/venue.entity';
import { PlanVersionEntity } from './entities/plan-version.entity';
import { SessionEntity } from './entities/session.entity';
import { SeatEntity } from './entities/seat.entity';
import { InventoryEntity } from './entities/inventory.entity';
import { HoldEntity } from './entities/hold.entity';
import { HoldSeatEntity } from './entities/hold-seat.entity';
import { ReservationEntity } from './entities/reservation.entity';
import { ReservationsController } from './reservations/reservations.controller';
import { ReservationsService } from './reservations/reservations.service';
import { SessionsController } from './sessions/sessions.controller';
import { SessionsService } from './sessions/sessions.service';
import { SeedService } from './seed/seed.service';
import { DemoSeedService } from './seed/demo-seed.service';
import { BusinessAuthGuard } from './auth/business-auth.guard';
import { PlanDraftEntity } from './entities/plan-draft.entity';
import { PlanDraftsController } from './plan/plan-drafts.controller';
import { PlanDraftsService } from './plan/plan-drafts.service';
import { PlanValidationService } from './plan/plan-validation.service';
import { SessionSeatBlockEntity } from './entities/session-seat-block.entity';
import { EmbedSessionEntity } from './entities/embed-session.entity';
import { EmbedSessionsController } from './embed/embed-sessions.controller';
import { EmbedSessionsService } from './embed/embed-sessions.service';
import { EmbedAuthGuard } from './auth/embed-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgresql://seatview:seatview@127.0.0.1:5432/seatview',
      entities: [
        BusinessEntity,
        HallPlanEntity,
        VenueEntity,
        PlanVersionEntity,
        SessionEntity,
        SeatEntity,
        InventoryEntity,
        HoldEntity,
        HoldSeatEntity,
        ReservationEntity,
        PlanDraftEntity,
        SessionSeatBlockEntity,
        EmbedSessionEntity,
      ],
      synchronize: process.env.TYPEORM_SYNCHRONIZE === '1',
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === '1',
    }),
    TypeOrmModule.forFeature([
      BusinessEntity,
      VenueEntity,
      PlanVersionEntity,
      SessionEntity,
      InventoryEntity,
      HoldEntity,
      HoldSeatEntity,
      ReservationEntity,
      HallPlanEntity,
      SeatEntity,
      PlanDraftEntity,
      SessionSeatBlockEntity,
      EmbedSessionEntity,
    ]),
  ],
  controllers: [
    ReservationsController,
    SessionsController,
    PlanDraftsController,
    EmbedSessionsController,
  ],
  providers: [
    ReservationsService,
    SessionsService,
    SeedService,
    DemoSeedService,
    BusinessAuthGuard,
    EmbedAuthGuard,
    PlanDraftsService,
    PlanValidationService,
    EmbedSessionsService,
  ],
})
export class AppModule {}
