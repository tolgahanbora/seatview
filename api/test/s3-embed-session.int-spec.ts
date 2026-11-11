import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  DEMO_API_KEY,
  DEMO_SESSION_2215_ID,
  DEMO_SESSION_ID,
  OTHER_API_KEY,
} from '../src/demo-ids';

describe('S3-03 · Embed oturumu', () => {
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

  const businessHeaders = {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': 'test',
  };

  async function createEmbed(sessionId = DEMO_SESSION_ID, hostOrigin = 'http://127.0.0.1:4280') {
    return request(app.getHttpServer())
      .post('/embed-sessions')
      .set(businessHeaders)
      .send({ sessionId, hostOrigin });
  }

  it('izinli origin ile embed oturumu ve widgetUrl döner', async () => {
    const res = await createEmbed();
    expect(res.status).toBe(201);
    expect(res.body.contractVersion).toBe('embed.v1');
    expect(res.body.embedToken).toBeTruthy();
    expect(res.body.widgetUrl).toContain('embedToken=');
    expect(res.body.widgetUrl).not.toContain(DEMO_API_KEY);
    expect(res.body.sessionId).toBe(DEMO_SESSION_ID);
    expect(res.body.environment).toBe('test');
  });

  it('izinsiz host origin 403', async () => {
    const res = await createEmbed(DEMO_SESSION_ID, 'http://evil.example:9999');
    expect(res.status).toBe(403);
  });

  it('embed token ile koltuklar; gizli işletme anahtarı gerekmez', async () => {
    const created = await createEmbed();
    const token = created.body.embedToken as string;

    const seats = await request(app.getHttpServer())
      .get(`/embed/sessions/${DEMO_SESSION_ID}/seats`)
      .set('Authorization', 'Bearer ' + token);
    expect(seats.status).toBe(200);
    expect(seats.body.seats.length).toBeGreaterThan(0);
  });

  it('embed oturumu farklı sessionId yoluna erişemez', async () => {
    const created = await createEmbed();
    const token = created.body.embedToken as string;

    const wrong = await request(app.getHttpServer())
      .get(`/embed/sessions/${DEMO_SESSION_2215_ID}/seats`)
      .set('Authorization', 'Bearer ' + token);
    expect(wrong.status).toBe(403);
  });

  it('diğer işletme demo seansı için embed açamaz', async () => {
    const res = await request(app.getHttpServer())
      .post('/embed-sessions')
      .set({
        'X-Business-Api-Key': OTHER_API_KEY,
        'X-Seatview-Environment': 'test',
      })
      .send({ sessionId: DEMO_SESSION_ID, hostOrigin: 'http://127.0.0.1:4280' });
    expect(res.status).toBe(403);
  });

  it('embed hold + bloklu koltuk 409; satış kapalı 403', async () => {
    const created = await createEmbed();
    const token = created.body.embedToken as string;
    const bearer = { Authorization: 'Bearer ' + token };

    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(businessHeaders)
      .send({ blockedSeatIds: ['D7'], salesOpen: true });

    const blockedHold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set(bearer)
      .send({ seatIds: ['D7'] });
    expect(blockedHold.status).toBe(409);

    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(businessHeaders)
      .send({ salesOpen: false, unblockSeatIds: ['D7'] });

    const pausedHold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set(bearer)
      .send({ seatIds: ['F8'] });
    expect(pausedHold.status).toBe(403);
  });

  it('embed hold oluşturup embed release ile bırakır', async () => {
    await dataSource.query(
      `UPDATE inventory SET status = 'available', hold_id = NULL WHERE session_id = $1 AND seat_id = 'G9'`,
      [DEMO_SESSION_ID],
    );
    await request(app.getHttpServer())
      .patch(`/sessions/${DEMO_SESSION_ID}/sales`)
      .set(businessHeaders)
      .send({ salesOpen: true, unblockSeatIds: ['G9'] });

    const created = await createEmbed();
    const token = created.body.embedToken as string;
    const bearer = { Authorization: 'Bearer ' + token };

    const hold = await request(app.getHttpServer())
      .post(`/embed/sessions/${DEMO_SESSION_ID}/holds`)
      .set(bearer)
      .send({ seatIds: ['G9'] });
    expect(hold.status).toBe(201);

    const release = await request(app.getHttpServer())
      .post(`/embed/holds/${hold.body.id}/release`)
      .set(bearer);
    expect(release.status).toBe(204);
  });
});
