import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HoldEntity } from './hold.entity';

@Entity('hold_seats')
export class HoldSeatEntity {
  @PrimaryColumn({ name: 'hold_id', type: 'uuid' })
  holdId!: string;

  @PrimaryColumn({ name: 'seat_id', type: 'text' })
  seatId!: string;

  @ManyToOne(() => HoldEntity, (hold) => hold.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hold_id' })
  hold!: HoldEntity;
}
