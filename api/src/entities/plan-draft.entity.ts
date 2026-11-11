import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessEntity } from './business.entity';
import { VenueEntity } from './venue.entity';
import { HallPlanEntity } from './hall-plan.entity';
import { PlanVersionEntity } from './plan-version.entity';
import type { PlanLayout } from '../plan/plan-layout.types';

@Entity('plan_drafts')
export class PlanDraftEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ name: 'venue_id', type: 'uuid' })
  venueId!: string;

  @Column({ name: 'hall_plan_id', type: 'uuid', nullable: true })
  hallPlanId!: string | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'int', default: 1 })
  revision!: number;

  @Column({ type: 'jsonb' })
  layout!: PlanLayout;

  @Column({ name: 'last_published_revision', type: 'int', nullable: true })
  lastPublishedRevision!: number | null;

  @Column({ name: 'last_published_plan_version_id', type: 'uuid', nullable: true })
  lastPublishedPlanVersionId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => BusinessEntity)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @ManyToOne(() => VenueEntity)
  @JoinColumn({ name: 'venue_id' })
  venue!: VenueEntity;

  @ManyToOne(() => HallPlanEntity, { nullable: true })
  @JoinColumn({ name: 'hall_plan_id' })
  hallPlan!: HallPlanEntity | null;

  @ManyToOne(() => PlanVersionEntity, { nullable: true })
  @JoinColumn({ name: 'last_published_plan_version_id' })
  lastPublishedPlanVersion!: PlanVersionEntity | null;
}
