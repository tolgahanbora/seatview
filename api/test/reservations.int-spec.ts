import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  DEMO_API_KEY,
  DEMO_SESSION_ID,
  HOLD_TTL_SECONDS,
  OTHER_API_KEY,
} from '../src/demo-ids';

describe('Rezervasyon API (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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

  async function resetSeat(seatId: string) {
    await dataSource.query(
      `
      UPDATE inventory
      SET status = 'available', hold_id = NULL, reservation_id = NULL
      WHERE session_id = $1 AND seat_id = $2
      `,
      [DEMO_SESSION_ID, seatId],
    );
    await dataSource.query(
      `DELETE FROM hold_seats WHERE seat_id = $1`,
      [seatId],
    );
  }

  it('GET /sessions/:id/seats demo seansında 108 koltuk döner', async () => {
    const response = await request(app.getHttpServer()).get(
      `/sessions/${DEMO_SESSION_ID}/seats`,
    );
    expect(response.status).toBe(200);
    expect(response.body.seats).toHaveLength(108);
    const f8 = response.body.seats.find((s: { seatId: string }) => s.seatId === 'F8');
    expect(f8).toMatchObject({ row: 'F', column: 8, category: 'Standart' });
  });

  it('F8 için eşzamanlı iki tutma: biri 201, diğeri 409', async () => {
    await resetSeat('F8');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/sessions/${DEMO_SESSION_ID}/holds`)
        .set('X-Business-Api-Key', DEMO_API_KEY)
        .send({ seatIds: ['F8'] }),
      request(app.getHttpServer())
        .post(`/sessions/${DEMO_SESSION_ID}/holds`)
        .set('X-Business-Api-Key', DEMO_API_KEY)
        .send({ seatIds: ['F8'] }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('tutma süresi PostgreSQL saatine göre 8 dakika', async () => {
    await resetSeat('F1');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['F1'] });

    expect(hold.status).toBe(201);

    const row: { seconds: string }[] = await dataSource.query(
      `
      SELECT EXTRACT(EPOCH FROM (expires_at - created_window)) AS seconds
      FROM (
        SELECT expires_at, NOW() AS created_window FROM holds WHERE id = $1
      ) h
      `,
      [hold.body.id],
    );
    const seconds = Number(row[0].seconds);
    expect(seconds).toBeGreaterThanOrEqual(HOLD_TTL_SECONDS - 2);
    expect(seconds).toBeLessThanOrEqual(HOLD_TTL_SECONDS + 2);
  });

  it('aynı koltuğa paralel iki tutmadan yalnızca biri başarılı olur', async () => {
    await resetSeat('B4');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/sessions/${DEMO_SESSION_ID}/holds`)
        .set('X-Business-Api-Key', DEMO_API_KEY)
        .send({ seatIds: ['B4'] }),
      request(app.getHttpServer())
        .post(`/sessions/${DEMO_SESSION_ID}/holds`)
        .set('X-Business-Api-Key', DEMO_API_KEY)
        .send({ seatIds: ['B4'] }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('çoklu koltuk tutması atomiktir', async () => {
    await resetSeat('B5');
    await dataSource.query(
      `UPDATE inventory SET status = 'reserved' WHERE session_id = $1 AND seat_id = 'A2'`,
      [DEMO_SESSION_ID],
    );

    const response = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['B5', 'A2'] });

    expect(response.status).toBe(409);

    const inv = await dataSource.query(
      `SELECT status, hold_id FROM inventory WHERE session_id = $1 AND seat_id = 'B5'`,
      [DEMO_SESSION_ID],
    );
    expect(inv[0].status).toBe('available');
    expect(inv[0].hold_id).toBeNull();
  });

  it('süresi dolmuş tutma onaylanamaz', async () => {
    await resetSeat('C5');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['C5'] });

    expect(hold.status).toBe(201);

    await dataSource.query(
      `UPDATE holds SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [hold.body.id],
    );

    const confirm = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ orderKey: 'expired-hold-order' });

    expect(confirm.status).toBe(410);
  });

  it('aynı orderKey ile confirm idempotent', async () => {
    await resetSeat('D2');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['D2'] });

    const orderKey = 'idem-' + Date.now();
    const first = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ orderKey });

    const second = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ orderKey });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);
  });

  it('release sonrası koltuk GET ile available olur', async () => {
    await resetSeat('G1');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['G1'] });

    expect(hold.status).toBe(201);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/release`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .expect(204);

    const seats = await request(app.getHttpServer()).get(
      `/sessions/${DEMO_SESSION_ID}/seats`,
    );
    const g1 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'G1');
    expect(g1.status).toBe('available');
  });

  it('confirm sonrası koltuk reserved olur', async () => {
    await resetSeat('G2');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['G2'] });

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ orderKey: 'buy-g2-' + Date.now() })
      .expect(200);

    const seats = await request(app.getHttpServer()).get(
      `/sessions/${DEMO_SESSION_ID}/seats`,
    );
    const g2 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'G2');
    expect(g2.status).toBe('reserved');
  });

  it('başka işletme hold kaydına erişemez', async () => {
    await resetSeat('E3');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ seatIds: ['E3'] });

    const forbidden = await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', OTHER_API_KEY)
      .send({ orderKey: 'other-business' });

    expect(forbidden.status).toBe(403);
  });
});
