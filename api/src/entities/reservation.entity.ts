import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { BusinessEntity } from './business.entity';
import { SessionEntity } from './session.entity';
import { HoldEntity } from './hold.entity';

@Entity('reservations')
@Unique(['businessId', 'orderKey'])
export class ReservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'hold_id', type: 'uuid' })
  holdId!: string;

  @Column({ name: 'order_key', type: 'text' })
  orderKey!: string;

  @Column({ name: 'confirmed_at', type: 'timestamptz' })
  confirmedAt!: Date;

  @ManyToOne(() => BusinessEntity)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @ManyToOne(() => SessionEntity)
  @JoinColumn({ name: 'session_id' })
  session!: SessionEntity;

  @ManyToOne(() => HoldEntity)
  @JoinColumn({ name: 'hold_id' })
  hold!: HoldEntity;
}
