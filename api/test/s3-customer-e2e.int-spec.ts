import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DEMO_API_KEY, DEMO_SESSION_ID } from '../src/demo-ids';

describe('S3-04/05 · Müşteri backend E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const headers = {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': 'test',
  };

  beforeAll(async () => {
    process.env.TYPEORM_SYNCHRONIZE = '1';
    process.env.SEATVIEW_SKIP_SEED = '1';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  async function resetD8() {
    await dataSource.query(
      `UPDATE inventory SET status = 'available', hold_id = NULL, reservation_id = NULL
       WHERE session_id = $1 AND seat_id = 'D8'`,
      [DEMO_SESSION_ID],
    );
    await dataSource.query(`DELETE FROM hold_seats WHERE seat_id = 'D8'`);
  }

  it('D8 embed hold → müşteri backend confirm → idempotent tekrar', async () => {
    await resetD8();

    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(headers)
      .send({
        salesOpen: true,
        blockedSeatIds: ['D7'],
        categoryPrices: [{ category: 'Standart', amountCents: 52000, currency: 'TRY' }],
      });

    const embed = await request(app.getHttpServer())
      .post('/embed-sessions')
      .set(headers)
      .send({ sessionId: DEMO_SESSION_ID, hostOrigin: 'http://127.0.0.1:4280' });
    expect(embed.status).toBe(201);
    const token = embed.body.embedToken as string;
    expect(embed.body.widgetUrl).toContain('embedHost=');

    const hold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set('Authorization', 'Bearer ' + token)
      .send({ seatIds: ['D8'] });
    expect(hold.status).toBe(201);

    const orderKey = 'shop-e2e-' + Date.now();
    const first = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set(headers)
      .send({ orderKey });
    expect(first.status).toBe(200);
    expect(first.body.seatIds).toContain('D8');

    const second = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set(headers)
      .send({ orderKey });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const seats = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_ID}/seats`);
    const d8 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'D8');
    expect(d8.status).toBe('reserved');
  });

  it('iptal release sonrası D8 tekrar müsait', async () => {
    await resetD8();
    const embed = await request(app.getHttpServer())
      .post('/embed-sessions')
      .set(headers)
      .send({ sessionId: DEMO_SESSION_ID, hostOrigin: 'http://127.0.0.1:4280' });
    const token = embed.body.embedToken as string;

    const hold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set('Authorization', 'Bearer ' + token)
      .send({ seatIds: ['D8'] });
    expect(hold.status).toBe(201);

    const release = await request(app.getHttpServer())
      .post(`/embed/holds/${hold.body.id}/release`)
      .set('Authorization', 'Bearer ' + token);
    expect(release.status).toBe(204);

    const seats = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_ID}/seats`);
    const d8 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'D8');
    expect(d8.status).toBe('available');
  });

  it('süresi dolmuş hold confirm 410', async () => {
    await resetD8();
    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set(headers)
      .send({ seatIds: ['D8'] });
    expect(hold.status).toBe(201);

    await dataSource.query(`UPDATE holds SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [
      hold.body.id,
    ]);

    const confirm = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set(headers)
      .send({ orderKey: 'expired-' + Date.now() });
    expect(confirm.status).toBe(410);
  });

  it('örnek müşteri statik dosyalarında işletme anahtarı yok', async () => {
    const root = join(__dirname, '..', '..', 'embed', 'customer-demo');
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const shopJs = await readFile(join(root, 'shop.js'), 'utf8');
    const server = await readFile(join(root, 'server.mjs'), 'utf8');
    expect(html.includes(DEMO_API_KEY)).toBe(false);
    expect(shopJs.includes(DEMO_API_KEY)).toBe(false);
    expect(server.includes(DEMO_API_KEY)).toBe(true);
  });
});
