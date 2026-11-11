import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SessionEntity } from './session.entity';

@Entity('session_seat_blocks')
export class SessionSeatBlockEntity {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @PrimaryColumn({ name: 'seat_id', type: 'text' })
  seatId!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => SessionEntity)
  @JoinColumn({ name: 'session_id' })
  session!: SessionEntity;
}
