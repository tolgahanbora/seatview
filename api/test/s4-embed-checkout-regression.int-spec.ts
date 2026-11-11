import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  DEMO_API_KEY,
  DEMO_SESSION_ID,
} from '../src/demo-ids';

/**
 * S4-05: 3D katmanı API’yi etkilemez — embed hold/confirm (D11) checkout regresyonu.
 */
describe('S4-05 · Embed checkout regresyonu (3D bağımsız)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const headers = {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': 'test',
  };

  beforeAll(async () => {
    process.env.TYPEORM_SYNCHRONIZE = '1';
    process.env.SEATVIEW_SKIP_SEED = '1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.synchronize();
    const { DemoSeedService } = await import('../src/seed/demo-seed.service');
    await app.get(DemoSeedService).run();
  });

  afterAll(async () => {
    await app.close();
  });

  async function resetSeat(seatId: string) {
    await dataSource.query(
      `UPDATE inventory SET status = 'available', hold_id = NULL, reservation_id = NULL
       WHERE session_id = $1 AND seat_id = $2`,
      [DEMO_SESSION_ID, seatId],
    );
  }

  it('embed: D11 tut → müşteri backend confirm (3D simülasyonu arada olsa da)', async () => {
    await resetSeat('D11');

    const embed = await request(app.getHttpServer())
      .post('/embed-sessions')
      .set(headers)
      .send({ sessionId: DEMO_SESSION_ID, hostOrigin: 'http://127.0.0.1:4280' });
    expect(embed.status).toBe(201);
    const token = embed.body.embedToken as string;

    const hold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set('Authorization', 'Bearer ' + token)
      .send({ seatIds: ['D11'] });
    expect(hold.status).toBe(201);

    const orderKey = 's4-regression-' + Date.now();
    const confirm = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set(headers)
      .send({ orderKey });
    expect(confirm.status).toBe(200);
    expect(confirm.body.seatIds).toContain('D11');
  });
});
