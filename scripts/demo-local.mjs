/**
 * Yerel demo: Postgres + API + panel build + widget/panel sunucusu (:4173).
 * Kapatmak için Ctrl+C.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://seatview:seatview@127.0.0.1:5432/seatview';
const shell = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell,
      ...opts,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → çıkış ${code}`)),
    );
  });
}

function waitPort(port, host = '127.0.0.1', timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ port, host });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`PostgreSQL ${host}:${port} hazır değil (${timeoutMs}ms)`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function spawnBg(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell,
    ...opts,
  });
}

console.log('▸ Postgres (Docker)…');
await run('docker', ['compose', 'up', '-d', 'postgres']);
await waitPort(5432);

async function ensureDeps(label, modulesPath, installArgs) {
  try {
    await access(modulesPath);
  } catch {
    console.log(`▸ ${label}…`);
    await run('npm', installArgs);
  }
}

await ensureDeps(
  'API bağımlılıkları',
  fileURLToPath(new URL('../api/node_modules', import.meta.url)),
  ['install', '--prefix', 'api'],
);
await ensureDeps(
  'Panel bağımlılıkları',
  fileURLToPath(new URL('../panel-ui/node_modules', import.meta.url)),
  ['install', '--prefix', 'panel-ui'],
);

console.log('▸ Panel build…');
await run('node', ['scripts/ensure-panel-build.mjs']);

console.log('▸ API (:3000) ve web (:4173) başlatılıyor…\n');

const api = spawnBg('npm', ['run', 'start:dev'], {
  cwd: fileURLToPath(new URL('../api', import.meta.url)),
  env: { ...process.env, DATABASE_URL },
});

const web = spawnBg('node', ['dev.mjs']);

const shutdown = (signal) => {
  api.kill(signal);
  web.kill(signal);
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

api.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    web.kill();
    process.exit(code);
  }
});
web.on('exit', (code) => {
  api.kill();
  process.exit(code ?? 0);
});

console.log('Demo hazır olduğunda:');
console.log('  Widget     http://127.0.0.1:4173');
console.log('  Panel      http://127.0.0.1:4173/panel/sessions');
console.log('  Demo mağaza (ayrı terminal): npm run customer:dev → :4280');
