import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import {
  DEMO_API_KEY,
  DEMO_PLAN_V1_ID,
  DEMO_PLAN_V2_ID,
  DEMO_SESSION_1945_ID,
  DEMO_SESSION_2215_ID,
  OTHER_API_KEY,
} from '../src/demo-ids';

describe('S1 seans servisi (PostgreSQL)', () => {
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
    await app.get(DemoSeedService).run();
  });

  afterAll(async () => {
    await app.close();
  });

  it('A ve B seanslarında F8 envanteri bağımsızdır', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_1945_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ seatIds: ['F8'] });

    expect(hold.status).toBe(201);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ orderKey: 's1-ab-f8-' + Date.now() })
      .expect(200);

    const seatsA = await request(app.getHttpServer()).get(
      `/sessions/${DEMO_SESSION_1945_ID}/seats`,
    );
    const seatsB = await request(app.getHttpServer()).get(
      `/sessions/${DEMO_SESSION_2215_ID}/seats`,
    );

    const f8a = seatsA.body.seats.find((s: { seatId: string }) => s.seatId === 'F8');
    const f8b = seatsB.body.seats.find((s: { seatId: string }) => s.seatId === 'F8');
    expect(f8a.status).toBe('reserved');
    expect(f8b.status).toBe('available');
  });

  it('plan sürümü seansa sabitlenir; yeni seans v2 kullanır', async () => {
    const sessionA = await dataSource.query(
      `SELECT plan_version_id FROM sessions WHERE id = $1`,
      [DEMO_SESSION_1945_ID],
    );
    expect(sessionA[0].plan_version_id).toBe(DEMO_PLAN_V1_ID);

    const created = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'v2 test',
        startsAt: '2026-11-11T20:00:00+03:00',
        planVersionId: DEMO_PLAN_V2_ID,
      });

    expect(created.status).toBe(201);
    expect(created.body.planVersionId).toBe(DEMO_PLAN_V2_ID);

    const again = await dataSource.query(
      `SELECT plan_version_id FROM sessions WHERE id = $1`,
      [DEMO_SESSION_1945_ID],
    );
    expect(again[0].plan_version_id).toBe(DEMO_PLAN_V1_ID);
  });

  it('başka işletme seans oluşturamaz', async () => {
    await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', OTHER_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'izinsiz',
        startsAt: '2026-11-11T21:00:00+03:00',
        planVersionId: DEMO_PLAN_V1_ID,
      })
      .expect(403);
  });

  it('ortam uyuşmazlığında hold reddedilir', async () => {
    await dataSource.query(
      `UPDATE inventory SET status = 'available', hold_id = NULL, reservation_id = NULL
       WHERE session_id = $1 AND seat_id = 'C8'`,
      [DEMO_SESSION_2215_ID],
    );

    await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_2215_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'live')
      .send({ seatIds: ['C8'] })
      .expect(403);
  });

  it('atomik seans: envanter yarım kalırsa seans rollback', async () => {
    process.env.SEATVIEW_TEST_FAIL_INVENTORY_AFTER = '3';
    const before = await dataSource.query(`SELECT COUNT(*)::int AS n FROM sessions WHERE title = 'rollback-test'`);

    await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'rollback-test',
        startsAt: '2026-11-12T18:00:00+03:00',
        planVersionId: DEMO_PLAN_V1_ID,
      })
      .expect(500);

    const after = await dataSource.query(`SELECT COUNT(*)::int AS n FROM sessions WHERE title = 'rollback-test'`);
    expect(after[0].n).toBe(before[0].n);

    const inv = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM inventory i
       JOIN sessions s ON s.id = i.session_id
       WHERE s.title = 'rollback-test'`,
    );
    expect(inv[0].n).toBe(0);
    delete process.env.SEATVIEW_TEST_FAIL_INVENTORY_AFTER;
  });

  it('POST /sessions envanteri tek seferde 108 satır açar', async () => {
    const created = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'full-inventory-' + Date.now(),
        startsAt: '2026-11-13T18:00:00+03:00',
        planVersionId: DEMO_PLAN_V1_ID,
      });

    expect(created.status).toBe(201);
    expect(created.body.inventoryCount).toBe(108);
  });
});
