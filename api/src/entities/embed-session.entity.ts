import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BusinessEntity } from './business.entity';
import { SessionEntity, SessionEnvironment } from './session.entity';

@Entity('embed_sessions')
export class EmbedSessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'text' })
  environment!: SessionEnvironment;

  @Column({ name: 'host_origin', type: 'text' })
  hostOrigin!: string;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => BusinessEntity)
  @JoinColumn({ name: 'business_id' })
  business!: BusinessEntity;

  @ManyToOne(() => SessionEntity)
  @JoinColumn({ name: 'session_id' })
  session!: SessionEntity;
}
