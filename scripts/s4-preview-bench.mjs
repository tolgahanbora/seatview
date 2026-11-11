#!/usr/bin/env node
/**
 * Yerel önizleme modülü boyutu ve soğuk import süresi (tarayıcı perform API’sine ek).
 * Gerçek cihaz ölçümleri: docs/s4-05-performance-observations.md
 */
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = ['src/preview.js', 'src/preview-loader.js'];

const sizes = await Promise.all(
  files.map(async (rel) => {
    const p = root + '/' + rel;
    const s = await stat(p);
    return { file: rel, bytes: s.size };
  }),
);

const t0 = performance.now();
await import(root + '/src/preview.js');
const importMs = Math.round(performance.now() - t0);

const appJs = await readFile(root + '/src/app.js', 'utf8');
const eagerPreview = appJs.includes("from './preview.js'");

console.log(JSON.stringify({
  recordedAt: new Date().toISOString(),
  environment: 'node-cold-import',
  eagerPreviewInAppJs: eagerPreview,
  transferBytes: sizes,
  previewImportMs: importMs,
  note: 'Tarayıcıda window.__seatviewPreviewLoadMs ve 10× aç/kapat için kabul demosunu izleyin.',
}, null, 2));
