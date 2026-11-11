import { Request } from 'express';
import { BusinessEntity } from '../entities/business.entity';

export type RequestWithBusiness = Request & {
  business?: BusinessEntity;
};
