import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const panelDistRoot = path.join(repoRoot, 'panel-ui', 'dist');

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/src/app.js', ['src/app.js', 'text/javascript']],
  ['/src/hall.js', ['src/hall.js', 'text/javascript']],
  ['/src/preview.js', ['src/preview.js', 'text/javascript']],
  ['/src/demo-api.js', ['src/demo-api.js', 'text/javascript']],
  ['/src/hall-loader.js', ['src/hall-loader.js', 'text/javascript']],
  ['/src/hall-state.js', ['src/hall-state.js', 'text/javascript']],
  ['/src/plan-contract.js', ['src/plan-contract.js', 'text/javascript']],
  ['/src/embed-bridge.js', ['src/embed-bridge.js', 'text/javascript']],
  ['/src/geometry-adapter.js', ['src/geometry-adapter.js', 'text/javascript']],
  ['/src/geometry-math.js', ['src/geometry-math.js', 'text/javascript']],
  ['/src/preview-loader.js', ['src/preview-loader.js', 'text/javascript']],
  ['/src/preview.js', ['src/preview.js', 'text/javascript']],
]);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const API_TARGET = process.env.SEATVIEW_API_ORIGIN || 'http://127.0.0.1:3000';
const CSP_PANEL =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:3000 http://localhost:3000; frame-ancestors 'self'";
const CSP_WIDGET =
  "frame-ancestors 'self' http://127.0.0.1:4280 http://localhost:4280";

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function proxyApi(request, response, urlPath) {
  const upstream = API_TARGET + urlPath.replace(/^\/api-seatview/, '');
  const headers = { ...request.headers, host: new URL(API_TARGET).host };
  delete headers['connection'];
  delete headers['content-length'];

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await readBody(request);
    headers['content-length'] = String(body.length);
  }

  try {
    const upstreamRes = await fetch(upstream, {
      method: request.method,
      headers,
      body: body?.length ? body : undefined,
    });
    const outHeaders = {};
    upstreamRes.headers.forEach((value, key) => {
      if (key === 'transfer-encoding') return;
      outHeaders[key] = value;
    });
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    response.writeHead(upstreamRes.status, outHeaders);
    response.end(request.method === 'HEAD' ? undefined : buf);
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(
      'API proxy hatası: ' + (error instanceof Error ? error.message : 'bilinmeyen') +
        '\n`npm run api:dev` çalışıyor mu?',
    );
  }
}

function safePanelPath(urlPath) {
  let suffix = urlPath.slice('/panel'.length);
  if (!suffix || suffix === '/') suffix = '/index.html';
  const resolved = path.normalize(path.join(panelDistRoot, suffix));
  if (!resolved.startsWith(panelDistRoot)) return null;
  return resolved;
}

async function servePanel(request, response, urlPath) {
  if (!urlPath.startsWith('/panel')) return false;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return true;
  }

  const filePath = safePanelPath(urlPath);
  if (filePath) {
    try {
      const info = await stat(filePath);
      if (info.isFile()) {
        const ext = path.extname(filePath);
        const contents = await readFile(filePath);
        response.writeHead(200, {
          'Content-Type': (MIME[ext] || 'application/octet-stream') + '; charset=utf-8',
          'Content-Security-Policy': CSP_PANEL,
        });
        response.end(request.method === 'HEAD' ? undefined : contents);
        return true;
      }
    } catch {
      // SPA fallback
    }
  }

  try {
    const index = path.join(panelDistRoot, 'index.html');
    const contents = await readFile(index);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_PANEL,
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
    return true;
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(
      'ReUI panel henüz derlenmedi. Çalıştırın: npm run panel:build\n' +
        '(veya `npm run dev` — ilk seferde otomatik derler)',
    );
    return true;
  }
}

const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  const urlPath = request.url?.split('?')[0] ?? '/';

  if (urlPath === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }

  if (urlPath.startsWith('/api-seatview')) {
    await proxyApi(request, response, urlPath);
    return;
  }

  if (await servePanel(request, response, urlPath)) {
    return;
  }

  const file = files.get(urlPath);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const contents = await readFile(new URL(file[0], import.meta.url));
    const headers = { 'Content-Type': file[1] + '; charset=utf-8' };
    headers['Content-Security-Policy'] = CSP_WIDGET;
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(500).end('Could not read the requested file.');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('Seatview demo:  http://127.0.0.1:' + port);
  console.log('İşletme paneli: http://127.0.0.1:' + port + '/panel/sessions');
  console.log('Panel HMR:      npm run panel:dev (ayrı :5174, geliştirme için)');
});
