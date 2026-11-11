import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { VenueEntity } from './venue.entity';
import { HallPlanEntity } from './hall-plan.entity';
import { SeatEntity } from './seat.entity';
import { SessionEntity } from './session.entity';
import type { PlanLayout } from '../plan/plan-layout.types';

@Entity('plan_versions')
@Unique(['venueId', 'version'])
export class PlanVersionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'venue_id', type: 'uuid' })
  venueId!: string;

  @Column({ name: 'hall_plan_id', type: 'uuid', nullable: true })
  hallPlanId!: string | null;

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ name: 'layout_snapshot', type: 'jsonb', nullable: true })
  layoutSnapshot!: PlanLayout | null;

  @Column({ name: 'draft_revision', type: 'int', nullable: true })
  draftRevision!: number | null;

  @ManyToOne(() => VenueEntity, (venue) => venue.planVersions)
  @JoinColumn({ name: 'venue_id' })
  venue!: VenueEntity;

  @ManyToOne(() => HallPlanEntity, { nullable: true })
  @JoinColumn({ name: 'hall_plan_id' })
  hallPlan!: HallPlanEntity | null;

  @OneToMany(() => SeatEntity, (seat) => seat.planVersion)
  seats!: SeatEntity[];

  @OneToMany(() => SessionEntity, (session) => session.planVersion)
  sessions!: SessionEntity[];
}
