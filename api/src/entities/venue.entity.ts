import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { BusinessEntity } from './business.entity';
import { PlanVersionEntity } from './plan-version.entity';

@Entity('venues')
export class VenueEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ type: 'text' })
  name!: string;

  @ManyToOne(() => BusinessEntity, (business) => business.venues)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @OneToMany(() => PlanVersionEntity, (version) => version.venue)
  planVersions!: PlanVersionEntity[];
}
