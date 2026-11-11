# Seatview API (Aşama 1 + S1-02/03)

NestJS + PostgreSQL. Tutma süresi: **8 dakika**. OpenAPI: [`openapi.yaml`](./openapi.yaml).

## İlk kurulum (migration yolu — önerilen)

```bash
cd api
npm install
export DATABASE_URL=postgresql://seatview:seatview@127.0.0.1:5432/seatview

npm run migration:run
npm run seed
npm run start:dev
```

## Hızlı geliştirme (şema otomatik + boot seed)

`start:dev` varsayılan olarak `TYPEORM_SYNCHRONIZE=1` ve seed açık:

```bash
cd api && npm run start:dev
```

## Komutlar

| Komut | Açıklama |
|--------|----------|
| `npm run migration:run` | `src/migrations/*` çalıştırır |
| `npm run migration:revert` | Son migration geri alır |
| `npm run seed` | Idempotent demo seed (Meridian Salon 03, v1+v2, 19:45 & 22:15) |
| `npm run test:int` | PostgreSQL entegrasyon testleri |
| `npm run start:dev` | API `:3000`, CORS demo için |

Ortam değişkenleri:

- `DATABASE_URL` — Postgres bağlantısı
- `TYPEORM_SYNCHRONIZE=1` — entity’lerden şema (dev)
- `TYPEORM_MIGRATIONS_RUN=1` — başlangıçta migration
- `SEATVIEW_SKIP_SEED=1` — `run-seed.ts` / test için otomatik seed kapalı

## Yeni API (S1-03)

| Method | Route | Header |
|--------|-------|--------|
| `GET` | `/venues` | `X-Business-Api-Key`, `X-Seatview-Environment` (varsayılan `test`) |
| `GET` | `/sessions` | aynı |
| `GET` | `/sessions/:id/detail` | aynı |
| `POST` | `/sessions` | aynı — envanter tek transaction |

Mevcut rezervasyon uçları değişmedi: `GET …/seats`, `POST …/holds`, `POST /holds/:id/confirm|release`.

## Demo kimlikler

| Alan | Değer |
|------|--------|
| 19:45 seans (widget) | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001` |
| 22:15 seans | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002` |
| Plan v1 | `dddddddd-dddd-4ddd-8ddd-dddddddddd01` |
| API anahtarı | `demo-meridian-api-key` |
