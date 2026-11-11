import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import { PlanDraftsService } from '../src/plan/plan-drafts.service';
import { DEMO_API_KEY, DEMO_VENUE_ID, OTHER_API_KEY } from '../src/demo-ids';

describe('S2 plan taslak API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TYPEORM_SYNCHRONIZE = '1';
    process.env.SEATVIEW_SKIP_SEED = '1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('POST /venues/:id/plan-drafts yeni taslak oluşturur', async () => {
    const response = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'Test planı' })
      .expect(201);

    expect(response.body.revision).toBe(1);
    expect(response.body.venueId).toBe(DEMO_VENUE_ID);
    expect(response.body.layout.categories.length).toBeGreaterThan(0);
  });

  it('PATCH kaydetme revizyonu artırır; eski revizyon 409 döner', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'Çakışma testi' })
      .expect(201);

    const layout = PlanDraftsService.buildHall48Layout();
    const saved = await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 1 })
      .expect(200);

    expect(saved.body.revision).toBe(2);
    expect(saved.body.layout.seats).toHaveLength(48);

    await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 1 })
      .expect(409);
  });

  it('etiket değişince koltuk uid korunur', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({})
      .expect(201);

    const layout = PlanDraftsService.buildHall48Layout();
    const target = layout.seats.find((s) => s.label === 'D8')!;
    const uid = target.uid;
    target.label = 'D8-VIP';

    await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 1 })
      .expect(200);

    const reloaded = await request(app.getHttpServer())
      .get(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .expect(200);

    const again = reloaded.body.layout.seats.find((s: { uid: string }) => s.uid === uid);
    expect(again.label).toBe('D8-VIP');
  });

  it('işletme izolasyonu: diğer API anahtarı taslağa erişemez', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .get(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', OTHER_API_KEY)
      .expect(403);
  });
});
