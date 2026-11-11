import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.CUSTOMER_DEMO_PORT || 4280);
const HOST = process.env.CUSTOMER_DEMO_HOST || '127.0.0.1';
const SEATVIEW_API = process.env.SEATVIEW_API_BASE || 'http://127.0.0.1:3000';
const BUSINESS_API_KEY = process.env.SEATVIEW_BUSINESS_API_KEY || 'demo-meridian-api-key';
const SESSION_ID =
  process.env.DEMO_SESSION_ID || 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001';
const HOST_ORIGIN = `http://${HOST}:${PORT}`;
const ENVIRONMENT = 'test';

const demoRoot = new URL('.', import.meta.url);
const repoRoot = new URL('../../', import.meta.url);

const staticFiles = new Map([
  ['/', [new URL('index.html', demoRoot), 'text/html']],
  ['/index.html', [new URL('index.html', demoRoot), 'text/html']],
  ['/shop.css', [new URL('shop.css', demoRoot), 'text/css']],
  ['/shop.js', [new URL('shop.js', demoRoot), 'text/javascript']],
  ['/vendor/embed-bridge.js', [new URL('src/embed-bridge.js', repoRoot), 'text/javascript']],
]);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function seatview(path, options = {}) {
  const headers = {
    'X-Business-Api-Key': BUSINESS_API_KEY,
    'X-Seatview-Environment': ENVIRONMENT,
    ...(options.headers ?? {}),
  };
  const response = await fetch(SEATVIEW_API + path, { ...options, headers });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = { message: text };
  }
  return { status: response.status, data };
}

async function prepareDemoSales() {
  await seatview(`/sessions/${SESSION_ID}/sales`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      salesOpen: true,
      blockedSeatIds: ['D7'],
      categoryPrices: [
        { category: 'Standart', amountCents: 52000, currency: 'TRY' },
        { category: 'Recliner', amountCents: 65000, currency: 'TRY' },
      ],
    }),
  });
}

async function createEmbedSession(hostOrigin) {
  return seatview('/embed-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION_ID, hostOrigin }),
  });
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (request.method === 'GET' && request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/bootstrap') {
    try {
      await prepareDemoSales();
      const embed = await createEmbedSession(HOST_ORIGIN);
      if (embed.status !== 201) {
        json(response, embed.status, embed.data);
        return;
      }
      json(response, 200, {
        sessionId: SESSION_ID,
        widgetUrl: embed.data.widgetUrl,
        expiresAt: embed.data.expiresAt,
        widgetOrigin: process.env.SEATVIEW_WIDGET_ORIGIN || 'http://127.0.0.1:4173',
        hostOrigin: HOST_ORIGIN,
        demoSeat: 'D8',
        vipLabel: 'VIP sıra D · 520 ₺',
      });
    } catch (error) {
      json(response, 502, {
        message: error instanceof Error ? error.message : 'Bootstrap başarısız',
      });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/checkout') {
    let body = {};
    try {
      const raw = await readRequestBody(request);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      json(response, 400, { message: 'Geçersiz JSON' });
      return;
    }
    const holdId = body.holdId;
    if (!holdId) {
      json(response, 400, { message: 'holdId gerekli' });
      return;
    }
    const orderKey = body.orderKey || 'shop-' + randomUUID();
    const confirm = await seatview(`/holds/${holdId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderKey }),
    });
    json(response, confirm.status, { ...confirm.data, orderKey });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/checkout/retry') {
    let body = {};
    try {
      const raw = await readRequestBody(request);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      json(response, 400, { message: 'Geçersiz JSON' });
      return;
    }
  if (!body.holdId || !body.orderKey) {
      json(response, 400, { message: 'holdId ve orderKey gerekli' });
      return;
    }
    const confirm = await seatview(`/holds/${body.holdId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderKey: body.orderKey }),
    });
    json(response, confirm.status, confirm.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/embed-forbidden-test') {
    const evil = await createEmbedSession('http://evil.example:9999');
    json(response, evil.status, evil.data);
    return;
  }

  const file = staticFiles.get(url.pathname);
  if (file && request.method === 'GET') {
    try {
      const contents = await readFile(file[0]);
      response.writeHead(200, {
        'Content-Type': file[1] + '; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(contents);
      return;
    } catch {
      response.writeHead(500).end('Static okunamadı');
      return;
    }
  }

  response.writeHead(404).end('Not found');
}).listen(PORT, HOST, () => {
  console.log('Örnek müşteri sitesi: http://' + HOST + ':' + PORT);
  console.log('Seatview API: ' + SEATVIEW_API + ' (anahtar yalnızca bu süreçte)');
});

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}
