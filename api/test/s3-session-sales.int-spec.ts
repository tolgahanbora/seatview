import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  DEMO_API_KEY,
  DEMO_SESSION_ID,
  OTHER_API_KEY,
} from '../src/demo-ids';

describe('S3-02 · Seans satış ve blokaj', () => {
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

  const envHeaders = {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': 'test',
  };

  async function resetSeat(seatId: string) {
    await dataSource.query(
      `
      UPDATE inventory
      SET status = 'available', hold_id = NULL, reservation_id = NULL
      WHERE session_id = $1 AND seat_id = $2
      `,
      [DEMO_SESSION_ID, seatId],
    );
    await dataSource.query(`DELETE FROM hold_seats WHERE seat_id = $1`, [seatId]);
    await dataSource.query(`DELETE FROM session_seat_blocks WHERE session_id = $1 AND seat_id = $2`, [
      DEMO_SESSION_ID,
      seatId,
    ]);
  }

  async function restoreSalesDefaults() {
    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(envHeaders)
      .send({ salesOpen: true, categoryPrices: [], unblockSeatIds: ['D7', 'D8', 'F8'] });
  }

  beforeEach(async () => {
    await restoreSalesDefaults();
    await resetSeat('D7');
    await resetSeat('D8');
    await resetSeat('F8');
  });

  it('kategori fiyatı GET /seats yanıtına yansır', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(envHeaders)
      .send({
        categoryPrices: [
          { category: 'Standart', amountCents: 36000, currency: 'TRY' },
          { category: 'Recliner', amountCents: 52000, currency: 'TRY' },
        ],
      });
    expect(patch.status).toBe(200);

    const seats = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_ID}/seats`);
    expect(seats.status).toBe(200);
    const d8 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'D8');
    expect(d8).toMatchObject({ price: 36000, currency: 'TRY', status: 'available' });
    const h11 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'H11');
    expect(h11).toMatchObject({ price: 52000, currency: 'TRY' });
  });

  it('bloklu D7 hold alamaz; envanterde blocked görünür', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(envHeaders)
      .send({ blockedSeatIds: ['D7'] });
    expect(patch.status).toBe(200);
    expect(patch.body.blockedSeatIds).toContain('D7');

    const seats = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_ID}/seats`);
    const d7 = seats.body.seats.find((s: { seatId: string }) => s.seatId === 'D7');
    expect(d7.status).toBe('blocked');

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set(envHeaders)
      .send({ seatIds: ['D7'] });
    expect(hold.status).toBe(409);
  });

  it('satış kapalıyken yeni hold 403', async () => {
    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(envHeaders)
      .send({ salesOpen: false });

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set(envHeaders)
      .send({ seatIds: ['F8'] });
    expect(hold.status).toBe(403);
  });

  it('aktif tutmalı koltuk bloklanamaz', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_ID}/holds`)
      .set(envHeaders)
      .send({ seatIds: ['F8'] });
    expect(hold.status).toBe(201);

    const block = await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(envHeaders)
      .send({ blockedSeatIds: ['F8'] });
    expect(block.status).toBe(409);
  });

  it('farklı işletme seans satışına erişemez', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set({
        'X-Business-Api-Key': OTHER_API_KEY,
        'X-Seatview-Environment': 'test',
      })
      .send({ salesOpen: false });
    expect(res.status).toBe(403);
  });
});
