import { loadHallGeometry } from './hall-loader.js';
import { loadPreviewEngine, stopPreviewEngine } from './preview-loader.js';
import { isAisleGap } from './plan-contract.js';
import { getHall, seatMetrics } from './hall-state.js';
import {
  API_BASE,
  DRAFT_ID,
  EMBED_HOST_ORIGIN,
  IS_EMBED_MODE,
  PREVIEW_FAIL,
  SESSION_ID,
  SESSION_TITLE,
  apiHeaders,
  holdReleasePath,
  sessionHoldsPath,
  sessionSeatsPath,
} from './demo-api.js';
import { postToEmbedHost } from './embed-bridge.js';

const seatMap = document.querySelector('#seat-map');
const dialog = document.querySelector('#preview-dialog');
const previewButton = document.querySelector('#preview-button');
const buyButton = document.querySelector('#buy-button');
const cancelButton = document.querySelector('#cancel-button');
const reserveStatus = document.querySelector('#reserve-status');
const HOLD_STORAGE_KEY = 'seatview-active-hold-id';
const ORDER_STORAGE_KEY = 'seatview-demo-order-key';
const selectedTitle = document.querySelector('#selected-title');
const selectedDetail = document.querySelector('#selected-detail');
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const distance = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const sceneCanvas = document.querySelector('#scene');
const mapPanel = document.querySelector('.map-panel');
const previewLoading = document.querySelector('#preview-loading');
const previewLoadHint = document.querySelector('#preview-load-hint');
const expiresFmt = new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' });
const reducedMotionPreview = matchMedia('(prefers-reduced-motion: reduce)');
let mapScrollSnapshot = 0;
let previewOpening = false;
let selected;
let activeHoldId = sessionStorage.getItem(HOLD_STORAGE_KEY) || undefined;
/** @type {Map<string, { status: string, holdExpiresAt?: string | null, label?: string }>} */
let availability = new Map();
let apiOnline = false;
/** @type {ReturnType<typeof setInterval> | undefined} */
let holdCountdownTimer;
let holdExpiresAtIso;

function embedEmit(type, payload) {
  if (!IS_EMBED_MODE) return;
  postToEmbedHost(type, payload, EMBED_HOST_ORIGIN || 'http://127.0.0.1:4280');
}

function clearHoldCountdown() {
  if (holdCountdownTimer) {
    clearInterval(holdCountdownTimer);
    holdCountdownTimer = undefined;
  }
  holdExpiresAtIso = undefined;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m) + ':' + String(s).padStart(2, '0');
}

function startHoldCountdown(expiresAt) {
  clearHoldCountdown();
  holdExpiresAtIso = expiresAt;
  const tick = () => {
    const left = new Date(expiresAt).getTime() - Date.now();
    if (left <= 0) {
      const expiredHold = activeHoldId;
      clearHoldCountdown();
      rememberHoldId(undefined);
      embedEmit('holdExpired', { holdId: expiredHold ?? null });
      reserveStatus.textContent = 'Tutma süresi doldu — yeniden seçim yapın.';
      loadAvailability().catch(() => {});
      return;
    }
    if (IS_EMBED_MODE) {
      reserveStatus.textContent = 'Ayrıldı · kalan süre ' + formatCountdown(left);
    }
  };
  tick();
  holdCountdownTimer = setInterval(tick, 1000);
}

function emitSelectionState() {
  if (!IS_EMBED_MODE || !selected) return;
  const entry = availability.get(selected.id);
  const priceCents = entry?.price ?? selected.price * 100;
  const currency = entry?.currency ?? 'TRY';
  embedEmit('selectionChanged', {
    sessionId: SESSION_ID,
    seatIds: [selected.id],
    labels: [seatLabel(selected)],
    displayTotal: priceCents / 100,
    currency,
    category: entry?.category ?? selected.category,
  });
}

function seatLabel(seat) {
  return seat.label ?? seat.id;
}

function syncHoldActionButtons() {
  const hasHold = Boolean(apiOnline && activeHoldId);
  if (IS_EMBED_MODE) {
    buyButton.disabled = !hasHold;
    buyButton.textContent = hasHold ? 'Ödemeye geç' : 'Ödemeye geç';
  }
  cancelButton.disabled = !hasHold;
  if (IS_EMBED_MODE && buyButton) {
    buyButton.title = 'Host sayfası checkout; onay müşteri backend’inde yapılır';
  }
}

function rememberHoldId(holdId) {
  activeHoldId = holdId;
  if (holdId) sessionStorage.setItem(HOLD_STORAGE_KEY, holdId);
  else sessionStorage.removeItem(HOLD_STORAGE_KEY);
  syncHoldActionButtons();
}

function clearDemoOrderKey() {
  sessionStorage.removeItem(ORDER_STORAGE_KEY);
}

function demoOrderKey() {
  let orderKey = sessionStorage.getItem(ORDER_STORAGE_KEY);
  if (!orderKey) {
    orderKey = 'demo-' + Date.now();
    sessionStorage.setItem(ORDER_STORAGE_KEY, orderKey);
  }
  return orderKey;
}

function heldStatusMessage(seatId) {
  const entry = availability.get(seatId);
  const name = entry?.label ?? seatId;
  let message = name + ' şu an tutulmuş — yeni hold API 409 döner.';
  if (entry?.holdExpiresAt) {
    message += ' Bitiş: ' + expiresFmt.format(new Date(entry.holdExpiresAt)) + '.';
  }
  if (activeHoldId) {
    message += ' «İptal et» ile bırak veya «Demo satın al» ile onayla.';
  }
  return message;
}

async function apiReleaseHold() {
  if (!apiOnline || !activeHoldId) return;
  buyButton.disabled = true;
  cancelButton.disabled = true;
  const response = await fetch(API_BASE + holdReleasePath(activeHoldId), {
    method: 'POST',
    headers: apiHeaders(),
  });
  if (response.status !== 204 && response.status !== 404) {
    throw new Error('Release başarısız (' + response.status + ')');
  }
  clearHoldCountdown();
  rememberHoldId(undefined);
  clearDemoOrderKey();
  reserveStatus.textContent = 'İptal edildi — koltuk tekrar müsait.';
  await loadAvailability();
  if (IS_EMBED_MODE) emitSelectionState();
}

async function apiConfirmHold() {
  if (IS_EMBED_MODE) {
    reserveStatus.textContent = 'Embed modunda onay müşteri backend’inden yapılır (gizli anahtar iframe’de yok).';
    return;
  }
  if (!apiOnline || !activeHoldId) return;
  buyButton.disabled = true;
  cancelButton.disabled = true;
  const orderKey = demoOrderKey();
  reserveStatus.textContent = 'POST /holds/:id/confirm · sipariş ' + orderKey + '…';
  const response = await fetch(API_BASE + '/holds/' + activeHoldId + '/confirm', {
    method: 'POST',
    headers: apiHeaders({ json: true }),
    body: JSON.stringify({ orderKey }),
  });
  if (response.status === 410) {
    rememberHoldId(undefined);
    clearDemoOrderKey();
    await loadAvailability();
    throw new Error('Tutma süresi dolmuş — onaylanamaz (410).');
  }
  if (!response.ok) {
    throw new Error('Confirm başarısız (' + response.status + ')');
  }
  const reservation = await response.json();
  rememberHoldId(undefined);
  reserveStatus.textContent =
    'Demo satın al tamam · rezervasyon ' + reservation.id + ' · sipariş ' + reservation.orderKey;
  await loadAvailability();
}

function seatUnavailable(seatId) {
  const entry = availability.get(seatId);
  if (!entry) return !apiOnline && !DRAFT_ID;
  return entry.status !== 'available';
}

function isOurHeldSeat(seatId) {
  const entry = availability.get(seatId);
  return Boolean(activeHoldId && entry?.status === 'held');
}

function applyAvailabilityToHall() {
  const hall = getHall();
  for (const seat of hall.seats) {
    seat.booked = seatUnavailable(seat.id);
  }
}

function refreshSeatButtons() {
  const hall = getHall();
  for (const seat of hall.seats) {
    const button = seatMap.querySelector('[data-seat="' + seat.id + '"]');
    if (!button) continue;
    const unavailable = seatUnavailable(seat.id) && !isOurHeldSeat(seat.id);
    button.disabled = unavailable;
    const entry = availability.get(seat.id);
    const tag = unavailable ? (entry?.status === 'blocked' ? 'Kapalı' : 'Dolu') : seat.category;
    button.setAttribute('aria-label', seatLabel(seat) + ' · ' + tag);
  }
  if (selected && seatUnavailable(selected.id) && !isOurHeldSeat(selected.id)) {
    selected = undefined;
    selectedTitle.textContent = 'Koltuk seçilmedi';
    selectedDetail.textContent = 'Planın üzerinde boş bir koltuğa dokun.';
    previewButton.disabled = true;
  } else if (selected) {
    previewButton.disabled = false;
  }
  syncHoldActionButtons();
}

async function apiHoldSeat(seatId) {
  if (!apiOnline || !SESSION_ID) return null;
  const response = await fetch(API_BASE + sessionHoldsPath(SESSION_ID), {
    method: 'POST',
    headers: apiHeaders({ json: true }),
    body: JSON.stringify({ seatIds: [seatId] }),
  });
  if (response.status === 409) {
    await loadAvailability({ keepStatus: true });
    reserveStatus.textContent = heldStatusMessage(seatId);
    return null;
  }
  if (response.status === 403) {
    embedEmit('error', { code: 'sales_closed', message: 'Seans satışa kapalı' });
    throw new Error('Seans satışa kapalı (403).');
  }
  if (!response.ok) {
    embedEmit('error', { code: 'hold_failed', message: 'Tutma başarısız ' + response.status });
    throw new Error('Tutma başarısız (' + response.status + ')');
  }
  return response.json();
}

async function attachHold(seatId) {
  if (!apiOnline || !SESSION_ID) return null;
  if (activeHoldId) {
    await apiReleaseHold();
  }
  const hold = await apiHoldSeat(seatId);
  if (!hold) return null;
  rememberHoldId(hold.id);
  clearDemoOrderKey();
  const name = getHall().seats.find((s) => s.id === seatId);
  reserveStatus.textContent =
    seatLabel(name ?? { id: seatId }) +
    ' · 8 dk tutuldu · bitiş ' +
    expiresFmt.format(new Date(hold.expiresAt));
  startHoldCountdown(hold.expiresAt);
  emitSelectionState();
  await loadAvailability({ keepStatus: true });
  return hold;
}

async function loadAvailability(options = {}) {
  if (!SESSION_ID) {
    apiOnline = false;
    if (!options.keepStatus) {
      reserveStatus.textContent = DRAFT_ID
        ? 'Taslak önizleme — aynı geometri; rezervasyon için seans linki kullanın.'
        : 'Seans kimliği yok.';
    }
    return;
  }
  if (!options.keepStatus) {
    reserveStatus.textContent = 'Müsaitlik API\'den yükleniyor…';
  }
  try {
    const response = await fetch(API_BASE + sessionSeatsPath(SESSION_ID), {
      headers: apiHeaders(),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    availability = new Map(payload.seats.map((seat) => [seat.seatId, seat]));
    apiOnline = true;
    applyAvailabilityToHall();
    refreshSeatButtons();
    if (!options.keepStatus) {
      reserveStatus.textContent = 'Canlı envanter bağlı.';
    }
  } catch {
    apiOnline = false;
    reserveStatus.textContent =
      'API ulaşılamıyor. `npm run db:up` ve `npm run api:dev` komutlarını çalıştır.';
    syncHoldActionButtons();
  }
}

function selectSeat(seat) {
  if (seatUnavailable(seat.id) && !isOurHeldSeat(seat.id)) return;
  const previous = selected && seatMap.querySelector('[data-seat="' + selected.id + '"]');
  previous?.setAttribute('aria-pressed', 'false');
  selected = seat;
  seatMap.querySelector('[data-seat="' + seat.id + '"]').setAttribute('aria-pressed', 'true');
  selectedTitle.textContent = seat.row + ' sırası · ' + seatLabel(seat);
  const entry = availability.get(seat.id);
  const displayPrice = entry?.price != null ? entry.price / 100 : seat.price;
  selectedDetail.textContent = seat.category + ' · ' + money.format(displayPrice);
  previewButton.disabled = false;
  syncHoldActionButtons();
  emitSelectionState();
}

function buildSeatMap() {
  seatMap.textContent = '';
  const hall = getHall();
  const minCol = {};
  for (const seat of hall.seats) {
    minCol[seat.row] = Math.min(minCol[seat.row] ?? seat.column, seat.column);
  }

  for (const seat of hall.seats) {
    if (seat.column === minCol[seat.row]) {
      const label = document.createElement('span');
      label.className = 'row-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = seat.row;
      seatMap.append(label);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'seat';
    button.dataset.seat = seat.id;
    button.dataset.aisle = String(isAisleGap(hall, seat.column));
    button.dataset.recliner = String(seat.recliner);
    button.disabled = seat.booked;
    button.setAttribute('aria-label', seatLabel(seat) + ' · ' + (seat.booked ? 'Dolu' : seat.category));
    button.setAttribute('aria-pressed', 'false');
    button.textContent = seat.label ? seat.label.replace(seat.row, '') : String(seat.column);
    button.addEventListener('click', () => {
      selectSeat(seat);
      if (!SESSION_ID) {
        openPreview();
        return;
      }
      attachHold(seat.id).catch((error) => {
        reserveStatus.textContent = error instanceof Error ? error.message : 'Tutma hatası';
      });
    });
    seatMap.append(button);
  }
}

function buildQuickSeats() {
  const quickRoot = document.querySelector('#quick-seats');
  quickRoot.textContent = '';
  const hall = getHall();
  const wanted = ['A2', 'B6', 'D11'];
  const picks = wanted
    .map((label) => hall.seats.find((s) => seatLabel(s) === label))
    .filter(Boolean);
  const seats = picks.length ? picks : hall.seats.slice(0, 3);

  for (const seat of seats) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = seatLabel(seat);
    button.addEventListener('click', async () => {
      if (seatUnavailable(seat.id) && !isOurHeldSeat(seat.id)) return;
      if (!SESSION_ID) {
        selectSeat(seat);
        openPreview();
        return;
      }
      if (!apiOnline) {
        reserveStatus.textContent = 'API gerekli — npm run api:dev';
        return;
      }
      selectSeat(seat);
      try {
        const hold = await attachHold(seat.id);
        if (hold) openPreview();
      } catch (error) {
        reserveStatus.textContent = error instanceof Error ? error.message : 'Tutma hatası';
      }
    });
    quickRoot.append(button);
  }
}

function restoreMapAfterPreview() {
  if (mapPanel) mapPanel.scrollTop = mapScrollSnapshot;
  refreshSeatButtons();
  if (selected) {
    const seatButton = seatMap.querySelector('[data-seat="' + selected.id + '"]');
    seatButton?.setAttribute('aria-pressed', 'true');
    seatButton?.scrollIntoView({ block: 'nearest', behavior: reducedMotionPreview.matches ? 'auto' : 'smooth' });
  }
  previewButton.focus({ preventScroll: true });
}

function populatePreviewDialog() {
  const hall = getHall();
  const metrics = seatMetrics(selected);
  const metricsBlock = document.querySelector('#preview-metrics');
  const eyebrow = document.querySelector('#preview-eyebrow');
  document.querySelector('#view-tag').textContent = seatLabel(selected) + ' koltuğundan görüş';
  document.querySelector('#preview-title').textContent = selectedTitle.textContent;
  document.querySelector('#preview-category').textContent = selectedDetail.textContent;
  if (metrics && hall.viewCalibrated) {
    eyebrow.textContent = 'KOLTUK GÖRÜŞÜ · KALİBRE 3D SİMÜLASYON';
    metricsBlock.hidden = false;
    document.querySelector('#metric-distance').textContent = distance.format(metrics.distance) + ' m';
    document.querySelector('#metric-angle').textContent = metrics.screenAngle + '°';
    document.querySelector('#metric-offset').textContent =
      distance.format(metrics.offset) + ' m ' + metrics.side;
  } else {
    eyebrow.textContent = '3D SİMÜLASYON · salon şablonu (ölçü yok)';
    metricsBlock.hidden = true;
  }
}

async function openPreview() {
  if (!selected || dialog.open || previewOpening) return;
  previewOpening = true;
  mapScrollSnapshot = mapPanel?.scrollTop ?? 0;
  const selectedId = selected.id;
  previewButton.disabled = true;
  previewLoading.hidden = false;
  previewLoadHint.hidden = false;
  previewLoadHint.textContent = reducedMotionPreview.matches
    ? 'Hareket azaltma: doğrudan göz hizası.'
    : 'Salon özeti → göz hizası geçişi…';
  dialog.showModal();
  populatePreviewDialog();

  try {
    const engine = await loadPreviewEngine(sceneCanvas, { forceFail: PREVIEW_FAIL });
    if (selected?.id !== selectedId) {
      dialog.close();
      return;
    }
    const loadMs = globalThis.__seatviewPreviewLoadMs;
    if (loadMs != null && previewLoadHint) {
      previewLoadHint.textContent += ' Modül ' + loadMs + ' ms.';
    }
    engine.start(selected);
    document.querySelector('#close-preview')?.focus();
  } catch (error) {
    stopPreviewEngine();
    dialog.close();
    const message = error instanceof Error ? error.message : '3D yüklenemedi';
    reserveStatus.textContent = message + ' — 2D harita ve checkout kullanılabilir.';
    embedEmit('error', { code: 'preview_load_failed', message });
  } finally {
    previewLoading.hidden = true;
    previewLoadHint.hidden = true;
    previewOpening = false;
    syncHoldActionButtons();
  }
}

previewButton.addEventListener('click', () => {
  openPreview().catch(() => {});
});
buyButton.addEventListener('click', () => {
  if (IS_EMBED_MODE && activeHoldId) {
    embedEmit('checkoutRequested', {
      holdId: activeHoldId,
      sessionId: SESSION_ID,
      seatIds: selected ? [selected.id] : [],
      expiresAt: holdExpiresAtIso,
    });
    reserveStatus.textContent = 'Checkout isteği host sayfasına iletildi.';
    return;
  }
  apiConfirmHold().catch((error) => {
    reserveStatus.textContent = error instanceof Error ? error.message : 'Satın alma hatası';
    syncHoldActionButtons();
  });
});
cancelButton.addEventListener('click', () => {
  apiReleaseHold().catch((error) => {
    reserveStatus.textContent = error instanceof Error ? error.message : 'İptal hatası';
    syncHoldActionButtons();
  });
});
function closePreviewDialog() {
  stopPreviewEngine();
  if (dialog.open) dialog.close();
}

document.querySelector('#close-preview').addEventListener('click', closePreviewDialog);
document.querySelector('#change-seat').addEventListener('click', closePreviewDialog);
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closePreviewDialog();
});
dialog.addEventListener('close', () => {
  stopPreviewEngine();
  restoreMapAfterPreview();
});

async function bootstrap() {
  if (IS_EMBED_MODE) {
    document.body.classList.add('embed-mode');
    const masthead = document.querySelector('.masthead');
    const panelLink = document.querySelector('#panel-link');
    if (panelLink) panelLink.hidden = true;
    if (masthead) masthead.style.display = 'none';
    const intro = document.querySelector('.intro');
    if (intro) intro.classList.add('embed-compact');
  }

  if (SESSION_TITLE) {
    document.title = 'Seatview · ' + SESSION_TITLE;
    const showtime = document.querySelector('.showtime');
    if (showtime) showtime.textContent = SESSION_TITLE;
  }

  const sessionLink = document.querySelector('#panel-link');
  if (sessionLink) {
    sessionLink.href = 'http://127.0.0.1:4173/panel/#/sessions';
  }

  try {
    const geo = await loadHallGeometry();
    const introEyebrow = document.querySelector('.intro .eyebrow');
    if (introEyebrow) {
      introEyebrow.textContent =
        geo.mode === 'draft'
          ? 'TASLAK ÖNİZLEME'
          : geo.mode === 'session'
            ? 'CANLI SEANS · API PLANI'
            : 'MERIDIAN SİNEMASI / SALON 03';
    }
    buildSeatMap();
    syncHoldActionButtons();
    await loadAvailability();
    buildQuickSeats();
    if (IS_EMBED_MODE && SESSION_ID) {
      embedEmit('ready', { sessionId: SESSION_ID });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan yüklenemedi';
    reserveStatus.textContent = message;
    embedEmit('error', { code: 'bootstrap_failed', message });
  }
}

bootstrap();
