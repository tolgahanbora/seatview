/** 3D önizleme modülü — ilk «Bu koltuktan bak» isteğinde yüklenir. */

/** @type {import('./preview.js').createPreview | undefined} */
let createPreviewFn;
/** @type {ReturnType<import('./preview.js').createPreview> | undefined} */
let previewEngine;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ forceFail?: boolean }} [options]
 */
export async function loadPreviewEngine(canvas, options = {}) {
  if (options.forceFail) {
    throw new Error('3D önizleme modülü yüklenemedi (simülasyon).');
  }
  if (!createPreviewFn) {
    const started = performance.now();
    const mod = await import('./preview.js');
    createPreviewFn = mod.createPreview;
    const ms = Math.round(performance.now() - started);
    if (typeof globalThis !== 'undefined') {
      globalThis.__seatviewPreviewLoadMs = ms;
      globalThis.__seatviewPreviewOpenCount =
        (globalThis.__seatviewPreviewOpenCount ?? 0) + 1;
    }
  }
  if (!previewEngine) {
    previewEngine = createPreviewFn(canvas);
  }
  return previewEngine;
}

export function stopPreviewEngine() {
  previewEngine?.stop();
}

export function resetPreviewEngineForTests() {
  previewEngine?.stop();
  previewEngine = undefined;
  createPreviewFn = undefined;
}
