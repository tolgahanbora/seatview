import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

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
  ['/panel', ['panel/index.html', 'text/html']],
  ['/panel/', ['panel/index.html', 'text/html']],
  ['/panel/index.html', ['panel/index.html', 'text/html']],
  ['/panel/panel.css', ['panel/panel.css', 'text/css']],
  ['/panel/panel.js', ['panel/panel.js', 'text/javascript']],
  ['/panel/api.js', ['panel/api.js', 'text/javascript']],
  ['/panel/editor.js', ['panel/editor.js', 'text/javascript']],
  ['/panel/editor-tools.js', ['panel/editor-tools.js', 'text/javascript']],
  ['/panel/editor.css', ['panel/editor.css', 'text/css']],
]);

const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  const path = request.url?.split('?')[0];
  if (path === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const file = files.get(path);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const contents = await readFile(new URL(file[0], import.meta.url));
    const headers = { 'Content-Type': file[1] + '; charset=utf-8' };
    headers['Content-Security-Policy'] =
      "frame-ancestors 'self' http://127.0.0.1:4280 http://localhost:4280";
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(500).end('Could not read the requested file.');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('Seatview demo:  http://127.0.0.1:' + port);
  console.log('İşletme paneli: http://127.0.0.1:' + port + '/panel/#/sessions');
});
