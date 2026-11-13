import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shell = process.platform === 'win32';

const panelWatch = spawn('npm', ['run', 'build:watch', '--prefix', 'panel-ui'], {
  cwd: root,
  stdio: 'inherit',
  shell,
});

const server = spawn('node', ['dev.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

function shutdown(signal) {
  panelWatch.kill(signal);
  server.kill(signal);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

panelWatch.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    server.kill();
    process.exit(code ?? 1);
  }
});
server.on('exit', (code) => {
  panelWatch.kill();
  process.exit(code ?? 0);
});
