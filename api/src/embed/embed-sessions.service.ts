import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BusinessEntity } from '../entities/business.entity';
import { EmbedSessionEntity } from '../entities/embed-session.entity';
import { SessionEntity } from '../entities/session.entity';
import { SessionEnvironment } from '../entities/session.entity';

const EMBED_TTL_SECONDS = 30 * 60;

function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin.replace(/\/$/, '');
  }
}

@Injectable()
export class EmbedSessionsService {
  constructor(
    @InjectRepository(EmbedSessionEntity)
    private readonly embedSessions: Repository<EmbedSessionEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
  ) {}

  async create(
    business: BusinessEntity,
    environment: SessionEnvironment,
    sessionId: string,
    hostOrigin: string,
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Seans bulunamadı');
    }
    if (session.businessId !== business.id || session.environment !== environment) {
      throw new ForbiddenException('Seans kapsamı uyuşmuyor');
    }

    const freshBusiness = await this.businesses.findOne({ where: { id: business.id } });
    const allowed = (freshBusiness?.embedAllowedOrigins ?? []).map(normalizeOrigin);
    const normalizedHost = normalizeOrigin(hostOrigin);
    if (!allowed.includes(normalizedHost)) {
      throw new ForbiddenException('İzin verilmeyen host origin: ' + normalizedHost);
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + EMBED_TTL_SECONDS * 1000);
    const id = uuidv4();

    await this.embedSessions.insert({
      id,
      businessId: business.id,
      sessionId,
      environment,
      hostOrigin: normalizedHost,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    });

    const widgetBase = process.env.SEATVIEW_WIDGET_ORIGIN ?? 'http://127.0.0.1:4173';
    const params = new URLSearchParams({
      sessionId,
      embedToken: token,
      embedHost: normalizedHost,
    });

    return {
      contractVersion: 'embed.v1',
      embedToken: token,
      embedSessionId: id,
      sessionId,
      environment,
      hostOrigin: normalizedHost,
      expiresAt,
      widgetUrl: widgetBase + '/?' + params.toString(),
    };
  }
}
