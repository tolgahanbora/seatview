import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { BusinessEntity } from './business.entity';
import { HallPlanEntity } from './hall-plan.entity';
import { InventoryEntity } from './inventory.entity';
import { VenueEntity } from './venue.entity';
import { PlanVersionEntity } from './plan-version.entity';

export type SessionEnvironment = 'test' | 'live';

export type SessionCategoryPrice = {
  category: string;
  amountCents: number;
  currency: string;
};

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ name: 'venue_id', type: 'uuid', nullable: true })
  venueId!: string | null;

  @Column({ name: 'plan_version_id', type: 'uuid', nullable: true })
  planVersionId!: string | null;

  /** Geriye dönük uyumluluk; plan sürümünden türetilir. */
  @Column({ name: 'hall_plan_id', type: 'uuid', nullable: true })
  hallPlanId!: string | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'text', default: 'Europe/Istanbul' })
  timezone!: string;

  @Column({ type: 'text', default: 'test' })
  environment!: SessionEnvironment;

  @Column({ name: 'sales_open', type: 'boolean', default: true })
  salesOpen!: boolean;

  @Column({ name: 'category_prices', type: 'jsonb', nullable: true })
  categoryPrices!: SessionCategoryPrice[] | null;

  @ManyToOne(() => BusinessEntity, (business) => business.sessions)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @ManyToOne(() => VenueEntity)
  @JoinColumn({ name: 'venue_id' })
  venue!: VenueEntity;

  @ManyToOne(() => PlanVersionEntity, (version) => version.sessions)
  @JoinColumn({ name: 'plan_version_id' })
  planVersion!: PlanVersionEntity;

  @ManyToOne(() => HallPlanEntity, { nullable: true })
  @JoinColumn({ name: 'hall_plan_id' })
  hallPlan!: HallPlanEntity | null;

  @OneToMany(() => InventoryEntity, (inv) => inv.session)
  inventory!: InventoryEntity[];
}
