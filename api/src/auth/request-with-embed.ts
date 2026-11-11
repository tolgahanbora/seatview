import { Request } from 'express';
import { BusinessEntity } from '../entities/business.entity';
import { EmbedSessionEntity } from '../entities/embed-session.entity';
import { RequestWithBusiness } from './request-with-business';

export type RequestWithEmbed = RequestWithBusiness & {
  embedSession?: EmbedSessionEntity;
  embedBusiness?: BusinessEntity;
};
