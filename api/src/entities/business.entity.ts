import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { SessionEntity } from './session.entity';
import { VenueEntity } from './venue.entity';

@Entity('businesses')
export class BusinessEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'api_key', type: 'text', unique: true })
  apiKey!: string;

  @Column({ name: 'embed_allowed_origins', type: 'jsonb', default: [] })
  embedAllowedOrigins!: string[];

  @OneToMany(() => SessionEntity, (session) => session.business)
  sessions!: SessionEntity[];

  @OneToMany(() => VenueEntity, (venue) => venue.business)
  venues!: VenueEntity[];
}
