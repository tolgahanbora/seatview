import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import { DEMO_API_KEY, DEMO_PLAN_V1_ID, DEMO_SESSION_1945_ID, DEMO_SESSION_2215_ID } from '../src/demo-ids';

describe('S1 panel akışı (API)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TYPEORM_SYNCHRONIZE = '1';
    process.env.SEATVIEW_SKIP_SEED = '1';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const dataSource = app.get(DataSource);
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.synchronize();
    await app.get(DemoSeedService).run();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /venues salon ve plan koltuk sayısı döner', async () => {
    const response = await request(app.getHttpServer())
      .get('/venues')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .expect(200);

    expect(response.body.venues.length).toBeGreaterThan(0);
    const planV1 = response.body.venues[0].planVersions.find((p: { version: number }) => p.version === 1);
    expect(planV1.seatCount).toBe(108);
  });

  it('GET /sessions widget önizlemesi için seans listesi döner', async () => {
    const response = await request(app.getHttpServer())
      .get('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .expect(200);

    const titles = response.body.sessions.map((s: { title: string }) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['19:45 · IMAX', '22:15 · IMAX']));
  });

  it('POST /sessions geçersiz gövde 400 döner', async () => {
    await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ title: '', startsAt: 'not-a-date', planVersionId: 'nope' })
      .expect(400);
  });

  it('panelden yeni seans oluşturma listeye ekler ve müsaitlik uçları çalışır', async () => {
    const before = await request(app.getHttpServer())
      .get('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test');

    const created = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'Panel test · ' + Date.now(),
        startsAt: '2026-12-15T20:00:00+03:00',
        planVersionId: DEMO_PLAN_V1_ID,
        timezone: 'Europe/Istanbul',
      })
      .expect(201);

    expect(created.body.inventoryCount).toBe(108);

    const after = await request(app.getHttpServer())
      .get('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test');

    expect(after.body.sessions.length).toBe(before.body.sessions.length + 1);

    const seats = await request(app.getHttpServer()).get('/sessions/' + created.body.id + '/seats').expect(200);
    expect(seats.body.seats.length).toBe(108);
  });

  it('kabul demosu: 19:45 F8 onaylı, 22:15 F8 müsait', async () => {
    const hold = await request(app.getHttpServer())
      .post(`/sessions/${DEMO_SESSION_1945_ID}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ seatIds: ['F8'] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ orderKey: 'panel-demo-f8-' + Date.now() })
      .expect(200);

    const seats1945 = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_1945_ID}/seats`);
    const seats2215 = await request(app.getHttpServer()).get(`/sessions/${DEMO_SESSION_2215_ID}/seats`);

    const f8a = seats1945.body.seats.find((s: { seatId: string }) => s.seatId === 'F8');
    const f8b = seats2215.body.seats.find((s: { seatId: string }) => s.seatId === 'F8');
    expect(f8a.status).toBe('reserved');
    expect(f8b.status).toBe('available');
  });
});
