import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/seed/demo-seed.service';
import { PlanDraftsService } from '../src/plan/plan-drafts.service';
import { DEMO_API_KEY, DEMO_VENUE_ID } from '../src/demo-ids';

describe('S4-02 · Kalibrasyon sürüm izolasyonu', () => {
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

  it('V1 snapshot kalibrasyonu V2 değişikliğinden etkilenmez', async () => {
    const created = await request(app.getHttpServer())
      .post(`/venues/${DEMO_VENUE_ID}/plan-drafts`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ title: 'Kalibrasyon izolasyon' })
      .expect(201);

    const layoutV1 = PlanDraftsService.buildHall48Layout();
    const eyeV1 = layoutV1.calibration!.eyeHeightM;

    const saved = await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout: layoutV1, expectedRevision: 1 })
      .expect(200);

    const publishedV1 = await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 2 })
      .expect(200);

    const sessionV1 = await request(app.getHttpServer())
      .post('/sessions')
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .set('X-Seatview-Environment', 'test')
      .send({
        title: 'Kalibre V1',
        startsAt: '2026-12-01T19:45:00+03:00',
        planVersionId: publishedV1.body.planVersionId,
      })
      .expect(201);

    const layoutV2 = structuredClone(saved.body.layout);
    layoutV2.calibration = {
      ...layoutV2.calibration,
      eyeHeightM: 1.22,
      screenTarget: { x: 0, y: 3.35, z: 0 },
    };
    layoutV2.screen = { width: 6.5, bottom: 1.4, height: 3.2 };

    await request(app.getHttpServer())
      .patch(`/plan-drafts/${created.body.id}`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ layout: layoutV2, expectedRevision: 2 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/plan-drafts/${saved.body.id}/publish`)
      .set('X-Business-Api-Key', DEMO_API_KEY)
      .send({ expectedRevision: 3 })
      .expect(200);

    const sessionLayout = await request(app.getHttpServer())
      .get(`/sessions/${sessionV1.body.id}/layout`)
      .expect(200);

    expect(sessionLayout.body.layout.calibration.eyeHeightM).toBe(eyeV1);
    expect(sessionLayout.body.layout.screen.width).toBe(6);

    const v2Published = await request(app.getHttpServer())
      .get(`/plan-versions/${publishedV1.body.planVersionId}/layout`)
      .set('X-Business-Api-Key', DEMO_API_KEY);

    expect(v2Published.body.layout.calibration.eyeHeightM).toBe(eyeV1);
  });
});
