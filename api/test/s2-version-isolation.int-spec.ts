import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import { PlanDraftsService } from '../src/plan/plan-drafts.service';
import { DEMO_API_KEY, DEMO_VENUE_ID } from '../src/demo-ids';

describe('S2 sürüm izolasyonu (PostgreSQL)', () => {
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

  it('V1 seansı rezervasyon ve geometriyi korur; V2 yeni konum kullanır', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'İzolasyon 48' })
      .expect(201);

    let layout = PlanDraftsService.buildHall48Layout();
    let saved = await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 1 })
      .expect(200);

    const publishedV1 = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    const v1PlanId = publishedV1.body.planVersionId;
    const d8v1 = layout.seats.find((s) => s.label === 'D8')!;
    const xBefore = d8v1.x;

    const sessionV1 = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'V1 gösterimi',
        startsAt: '2026-12-20T19:45:00+03:00',
        planVersionId: v1PlanId,
      })
      .expect(201);

    const hold = await request(app.getHttpServer())
      .post(`/sessions/${sessionV1.body.id}/holds`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ seatIds: [d8v1.uid] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/holds/${hold.body.id}/confirm`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({ orderKey: 'v1-d8-' + Date.now() })
      .expect(200);

    layout = structuredClone(saved.body.layout);
    const d8draft = layout.seats.find((s) => s.label === 'D8')!;
    d8draft.x += 1.5;
    d8draft.z += 0.4;

    saved = await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout, expectedRevision: 2 })
      .expect(200);

    const publishedV2 = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 3 })
      .expect(200);

    expect(publishedV2.body.planVersionId).not.toBe(v1PlanId);

    const layoutV1Session = await request(app.getHttpServer())
      .get(`/sessions/${sessionV1.body.id}/layout`)
      .expect(200);

    const d8onV1 = layoutV1Session.body.layout.seats.find((s: { label: string }) => s.label === 'D8');
    expect(d8onV1.x).toBeCloseTo(xBefore, 2);

    const seatsV1 = await request(app.getHttpServer()).get(`/sessions/${sessionV1.body.id}/seats`);
    const d8inv = seatsV1.body.seats.find((s: { label: string }) => s.label === 'D8');
    expect(d8inv.status).toBe('reserved');

    const layoutV2 = await request(app.getHttpServer())
      .get(`/plan-versions/${publishedV2.body.planVersionId}/layout`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .expect(200);

    const d8onV2 = layoutV2.body.layout.seats.find((s: { label: string }) => s.label === 'D8');
    expect(d8onV2.x).toBeCloseTo(xBefore + 1.5, 2);

    const sessionV2 = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'V2 gösterimi',
        startsAt: '2026-12-20T22:15:00+03:00',
        planVersionId: publishedV2.body.planVersionId,
      })
      .expect(201);

    const seatsV2 = await request(app.getHttpServer()).get(`/sessions/${sessionV2.body.id}/seats`);
    const d8v2 = seatsV2.body.seats.find((s: { label: string }) => s.label === 'D8');
    expect(d8v2.status).toBe('available');
  });
});
