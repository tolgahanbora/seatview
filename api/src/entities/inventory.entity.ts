import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { SessionEntity } from './session.entity';
export type InventoryStatus = 'available' | 'held' | 'reserved';

@Entity('inventory')
@Unique(['sessionId', 'seatId'])
export class InventoryEntity {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @PrimaryColumn({ name: 'seat_id', type: 'text' })
  seatId!: string;

  @Column({ type: 'text' })
  status!: InventoryStatus;

  @Column({ name: 'hold_id', type: 'uuid', nullable: true })
  holdId!: string | null;

  @Column({ name: 'reservation_id', type: 'uuid', nullable: true })
  reservationId!: string | null;

  @ManyToOne(() => SessionEntity, (session) => session.inventory)
  @JoinColumn({ name: 'session_id' })
  session!: SessionEntity;

}
