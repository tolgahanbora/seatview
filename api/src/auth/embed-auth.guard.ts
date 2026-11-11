import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { BusinessEntity } from '../entities/business.entity';
import { EmbedSessionEntity } from '../entities/embed-session.entity';
import { RequestWithEmbed } from './request-with-embed';

export const EMBED_AUTH_HEADER = 'authorization';

@Injectable()
export class EmbedAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(EmbedSessionEntity)
    private readonly embedSessions: Repository<EmbedSessionEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithEmbed>();
    const auth = request.header(EMBED_AUTH_HEADER) ?? '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException('Embed oturum token gerekli');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.embedSessions.findOne({ where: { tokenHash } });
    if (!row) {
      throw new UnauthorizedException('Geçersiz embed oturumu');
    }
    if (row.expiresAt <= new Date()) {
      throw new UnauthorizedException('Embed oturumu süresi dolmuş');
    }

    const business = await this.businesses.findOne({ where: { id: row.businessId } });
    if (!business) {
      throw new UnauthorizedException('İşletme bulunamadı');
    }

    request.embedSession = row;
    request.embedBusiness = business;
    request.business = business;
    return true;
  }
}

export function assertEmbedSessionScope(
  request: RequestWithEmbed,
  sessionId: string,
) {
  if (!request.embedSession) {
    throw new UnauthorizedException('Embed oturumu yok');
  }
  if (request.embedSession.sessionId !== sessionId) {
    throw new ForbiddenException('Embed oturumu bu seansa ait değil');
  }
}
