import { SessionEnvironment } from '../entities/session.entity';

export function parseEnvironment(header?: string): SessionEnvironment {
  if (header === 'live') return 'live';
  return 'test';
}

export const ENVIRONMENT_HEADER = 'x-seatview-environment';
