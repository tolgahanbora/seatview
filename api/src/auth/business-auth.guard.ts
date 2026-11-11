import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessEntity } from '../entities/business.entity';
import { RequestWithBusiness } from './request-with-business';

@Injectable()
export class BusinessAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithBusiness>();
    const apiKey = request.header('x-business-api-key');
    if (!apiKey) {
      throw new UnauthorizedException('X-Business-Api-Key gerekli');
    }
    const business = await this.businesses.findOne({ where: { apiKey } });
    if (!business) {
      throw new UnauthorizedException('Geçersiz API anahtarı');
    }
    request.business = business;
    return true;
  }
}
