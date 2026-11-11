import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { BusinessEntity } from './business.entity';
import { SessionEntity } from './session.entity';
import { HoldSeatEntity } from './hold-seat.entity';

export type HoldStatus = 'active' | 'confirmed' | 'released' | 'expired';

@Entity('holds')
export class HoldEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'text' })
  status!: HoldStatus;

  @ManyToOne(() => SessionEntity)
  @JoinColumn({ name: 'session_id' })
  session!: SessionEntity;

  @ManyToOne(() => BusinessEntity)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @OneToMany(() => HoldSeatEntity, (hs) => hs.hold)
  seats!: HoldSeatEntity[];
}
