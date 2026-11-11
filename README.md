# Seatview Starter

**Interactive seat maps and “view from your seat” preview for cinemas and live venues.**

Seatview lets ticket buyers pick seats on a 2D hall plan, hold inventory with a time limit, and—when the hall is calibrated—open a **3D eye-level preview** of the screen from the selected seat. This repository is a **full-stack reference implementation**: NestJS API, operator panel, embeddable widget, and a separate-origin demo ticket shop.

> **Status:** Active prototype (`0.1.0`). Suitable for learning, demos, and as a starting point for production hardening—not a hosted SaaS yet.

---

## Why Seatview?

| Problem | How this repo addresses it |
|--------|------------------------------|
| Flat seat maps don’t convey sight lines | Calibrated plans drive distance, lateral offset, and viewing angle in the preview card |
| Widget must live on the customer’s domain | Cross-origin embed sessions, `postMessage` bridge, and demo checkout on another origin |
| Holds and overselling | PostgreSQL-backed holds (default **8 minutes**), confirm/release APIs |
| Plan changes without breaking old shows | Versioned `layout_snapshot` per published plan; sessions keep their geometry |

---

## Features

- **2D seat map** — Categories, pricing, availability, multi-select, accessibility-minded controls
- **3D seat preview** — Lazy-loaded module; salon overview → eye-height camera; reduced-motion support
- **Business panel** — Sessions, plan editor, publish flow (`/panel`)
- **Embed widget** — iframe-friendly CSP; events for host pages (`embed-bridge.js`)
- **Demo ticket shop** — Standalone origin simulating a real cinema site (`embed/customer-demo/`)
- **Integration tests** — PostgreSQL-backed suites under `api/test/` (S1–S4 flows)

---

## Architecture

```mermaid
flowchart LR
  subgraph customer ["Customer site :4280"]
    Shop[Demo shop + checkout]
  end
  subgraph widget ["Widget origin :4173"]
    UI[Seat map + preview]
    Panel[Operator panel]
  end
  subgraph backend ["API :3000"]
    API[NestJS + TypeORM]
  end
  DB[(PostgreSQL)]

  Shop -->|iframe| UI
  Shop <-->|postMessage| UI
  UI --> API
  Panel --> API
  Shop --> API
  API --> DB
```

| Service | Default URL | Role |
|---------|-------------|------|
| Widget + panel | [http://127.0.0.1:4173](http://127.0.0.1:4173) | Static dev server (`npm run dev`) |
| API | [http://127.0.0.1:3000](http://127.0.0.1:3000) | REST + embed session endpoints |
| Demo shop | [http://127.0.0.1:4280](http://127.0.0.1:4280) | Cross-origin embed acceptance demo |
| PostgreSQL | `127.0.0.1:5432` | `seatview` / `seatview` (see `docker-compose.yml`) |

OpenAPI: [`api/openapi.yaml`](api/openapi.yaml) · API setup details: [`api/README.md`](api/README.md)

---

## Quick start

### Prerequisites

- **Node.js** 20+ (22 recommended)
- **Docker** (for PostgreSQL)
- **npm**

### 1. Database

```bash
npm run db:up
```

Optional one-shot local DB bootstrap:

```bash
npm run db:setup
```

### 2. API

```bash
cd api && npm install
export DATABASE_URL=postgresql://seatview:seatview@127.0.0.1:5432/seatview
npm run start:dev
```

`start:dev` enables schema sync and demo seed (Meridian Cinema · Salon 03, sessions at **19:45** and **22:15**).

From repo root you can also run:

```bash
npm run api:dev
```

### 3. Widget and panel

In a second terminal, from the repo root:

```bash
npm run dev
```

- Widget: [http://127.0.0.1:4173](http://127.0.0.1:4173)  
- Panel: [http://127.0.0.1:4173/panel/#/sessions](http://127.0.0.1:4173/panel/#/sessions)

### 4. Embedded demo (optional)

Third terminal:

```bash
npm run customer:dev
```

Open [http://127.0.0.1:4280](http://127.0.0.1:4280) — the shop loads the widget in an iframe and runs a **demo checkout** on the host origin.

### Suggested demo flow

1. On the demo shop, select seats **A2**, **B6**, or **D11** and tap **View from this seat** (Turkish UI: *Bu koltuktan bak*).
2. Return to the map — selection and scroll position should be preserved; preview does not extend the hold timer.
3. Complete **Demo purchase** / host **Confirm demo order** to see reservation flow end-to-end.

For a calibrated 48-seat hall, publish the plan from the panel and optionally set `DEMO_SESSION_ID` to that session (see environment variables below).

---

## Repository layout

```
seatview-starter/
├── api/                 # NestJS API, migrations, integration tests
├── src/                 # Embeddable widget (seat map, preview, geometry)
├── panel/               # Operator UI (sessions, plan editor)
├── embed/customer-demo/ # Cross-origin ticket shop demo
├── docs/                # Performance and sprint notes
├── scripts/             # DB setup, preview benchmarks
├── dev.mjs              # Widget static server (:4173)
├── docker-compose.yml   # PostgreSQL 16
└── last.md              # Internal sprint log (S4 geometry & acceptance)
```

**Core widget modules**

| Module | Responsibility |
|--------|------------------|
| `app.js` | Selection state, holds, preview entry, embed hooks |
| `hall-loader.js` / `plan-contract.js` | Load published layout from API |
| `geometry-adapter.js` | Single plan → 2D + 3D scene transform |
| `preview-loader.js` / `preview.js` | Lazy 3D preview (canvas projection) |
| `embed-bridge.js` | `postMessage` contract for host pages |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Widget + panel on `:4173` |
| `npm run customer:dev` | Demo shop on `:4280` |
| `npm run api:dev` | API watch mode |
| `npm run api:test` | Integration tests (needs Postgres) |
| `npm run check` | Syntax check on front-end entrypoints |
| `npm run bench:preview` | Preview bundle / lazy-load benchmark |
| `npm run db:up` | Start Postgres via Docker Compose |

---

## Demo credentials

These values come from the seed data (see [`api/README.md`](api/README.md)):

| Item | Value |
|------|--------|
| Business API key | `demo-meridian-api-key` |
| 19:45 session (widget default) | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001` |
| 22:15 session | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002` |
| Environment header | `X-Seatview-Environment: test` (default) |

---

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | API | PostgreSQL connection string |
| `DEMO_SESSION_ID` | Demo shop | Point embed at a specific session |
| `SEATVIEW_WIDGET_ORIGIN` | API / demo | Widget base URL (default `http://127.0.0.1:4173`) |
| `SEATVIEW_API_BASE` | Demo shop | API base URL |
| `CUSTOMER_DEMO_PORT` | Demo shop | Host port (default `4280`) |
| `PORT` | `dev.mjs` | Widget server port (default `4173`) |

---

## Testing

With Postgres running and API dependencies installed:

```bash
npm run api:test
```

Regression fixtures for hall geometry (e.g. seats A2, B6, D11) live under `api/test/fixtures/`. QA scenarios for embed + preview failure modes are documented in [`last.md`](last.md) and [`docs/s4-05-performance-observations.md`](docs/s4-05-performance-observations.md).

---

## Embedding on your site

1. Create an embed session via the API (business key + session id + `hostOrigin`).
2. Load the returned widget URL in an iframe.
3. Import `embed-bridge.js` on the host to listen for `selectionChanged` and checkout-related events.

The demo under `embed/customer-demo/` is the canonical reference for **separate origins**, CSP `frame-ancestors`, and host-side order confirmation.

---

## Roadmap and limitations

**In scope today**

- Versioned plan layouts with optional 3D calibration block
- Hold / confirm / release reservation flow
- Lazy 3D preview with graceful fallback to 2D when load fails (`?previewFail=1` for QA)

**Not in scope (yet)**

- Hosted multi-tenant cloud, payments, or production auth
- Full WebGL / Three.js renderer (current preview uses canvas 2.5D projection)
- Custom 3D venue models and physical obstruction measurement

Internal delivery notes and acceptance checklists: [`last.md`](last.md).

---

## Contributing

Issues and pull requests are welcome. Please run `npm run check` and `npm run api:test` before submitting changes. Keep embed and hold semantics backward-compatible unless discussed in an issue.

---

## License

[MIT](LICENSE) © Tolgahan Bora

---

## Türkçe özet

**Seatview**, sinema ve etkinlik salonları için koltuk haritası, süreli hold, işletme paneli ve müşteri sitesine gömülebilir widget sunan bir referans projedir. Kullanıcı koltuk seçer, isteğe bağlı olarak **o koltuktan perdeye bakış** önizlemesini açar; örnek bilet sitesi farklı origin üzerinde çalışarak gerçek embed senaryosunu gösterir.

**Hızlı deneme:** `npm run db:up` → `cd api && npm i && npm run start:dev` → `npm run dev` → `npm run customer:dev` → tarayıcıda [127.0.0.1:4280](http://127.0.0.1:4280).

Detaylı sprint notları: [`last.md`](last.md).
