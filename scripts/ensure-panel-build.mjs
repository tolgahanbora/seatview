import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const index = fileURLToPath(new URL('../panel-ui/dist/index.html', import.meta.url));

try {
  await access(index);
  process.exit(0);
} catch {
  // dist yok — bir kez derle
}

console.log('panel-ui/dist bulunamadı — npm run panel:build çalışıyor…');

await new Promise((resolve, reject) => {
  const child = spawn('npm', ['run', 'panel:build'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', reject);
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`panel:build çıkış ${code}`))));
});
