import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import { PlanDraftsService } from '../src/plan/plan-drafts.service';
import { DEMO_API_KEY, DEMO_VENUE_ID } from '../src/demo-ids';

describe('S2 plan yayın API', () => {
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

  async function draftWithHall48() {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'Salon 48' })
      .expect(201);

    const layout = PlanDraftsService.buildHall48Layout();
    return request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 1 })
      .expect(200);
  }

  it('geçerli 48 koltuk yayınlanır ve layout ucu döner', async () => {
    const saved = await draftWithHall48();
    const publish = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    expect(publish.body.seatCount).toBe(48);
    expect(publish.body.idempotent).toBe(false);

    const layout = await request(app.getHttpServer())
      .get(`/plan-versions/${publish.body.planVersionId}/layout`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .expect(200);

    expect(layout.body.layout.seats).toHaveLength(48);
    const d8 = layout.body.layout.seats.find((s: { label: string }) => s.label === 'D8');
    expect(d8.categoryId).toBe('cat-vip');
  });

  it('aynı revizyona ikinci yayın isteği idempotent tek sürüm döner', async () => {
    const saved = await draftWithHall48();
    const first = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    expect(second.body.idempotent).toBe(true);
    expect(second.body.planVersionId).toBe(first.body.planVersionId);
  });

  it('geçersiz plan (koltuksuz) 422 döner', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'Boş' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/plan-drafts/${created.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 1 })
      .expect(422);
  });

  it('yayın sonrası seans 48 envanter açar', async () => {
    const saved = await draftWithHall48();
    const publish = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    const session = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: '48 koltuk gösterimi',
        startsAt: '2026-12-01T19:45:00+03:00',
        planVersionId: publish.body.planVersionId,
      })
      .expect(201);

    expect(session.body.inventoryCount).toBe(48);
  });
});
