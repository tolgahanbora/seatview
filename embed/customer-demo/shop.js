import { listenForEmbedWidget } from '/vendor/embed-bridge.js';

function businessKeyFingerprint() {
  return ['demo', 'meridian', 'api', 'key'].join('-');
}

const frame = document.querySelector('#seatview-frame');
const selectionSummary = document.querySelector('#selection-summary');
const holdCountdown = document.querySelector('#hold-countdown');
const checkoutStatus = document.querySelector('#checkout-status');
const hostCheckout = document.querySelector('#host-checkout');
const hostForbidden = document.querySelector('#host-forbidden');
const vipBanner = document.querySelector('#vip-banner');
const hostOriginEl = document.querySelector('#host-origin');
const checkNoKey = document.querySelector('#check-no-key');

/** @type {{ holdId?: string, orderKey?: string, expiresAt?: string, seatIds?: string[] }} */
let checkout = {};

let widgetOrigin = 'http://127.0.0.1:4173';
/** @type {ReturnType<typeof setInterval> | undefined} */
let countdownTimer;

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function startCountdown(expiresAt) {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!expiresAt) {
    holdCountdown.hidden = true;
    return;
  }
  holdCountdown.hidden = false;
  const tick = () => {
    const left = new Date(expiresAt).getTime() - Date.now();
    if (left <= 0) {
      holdCountdown.textContent = 'Tutma süresi doldu.';
      hostCheckout.disabled = true;
      if (countdownTimer) clearInterval(countdownTimer);
      return;
    }
    holdCountdown.textContent = 'Kalan süre: ' + formatCountdown(left);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function verifyNoSecretInPage() {
  const html = document.documentElement.innerHTML;
  const scripts = [...document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src'))
    .join(' ');
  const fingerprint = businessKeyFingerprint();
  const leaked = html.includes(fingerprint) || scripts.includes(fingerprint);
  checkNoKey.textContent = leaked
    ? 'UYARI: anahtar izi bulundu (olmamalı).'
    : 'İşletme API anahtarı sayfa kaynağında yok ✓';
  checkNoKey.style.color = leaked ? '#e88' : '#7dcea0';
}

async function bootstrap() {
  hostOriginEl.textContent = location.origin;
  verifyNoSecretInPage();

  const response = await fetch('/api/bootstrap');
  const data = await response.json();
  if (!response.ok) {
    checkoutStatus.textContent = data.message || 'Bootstrap hatası';
    return;
  }

  widgetOrigin = data.widgetOrigin || widgetOrigin;
  vipBanner.textContent =
    data.vipLabel + ' · D7 satışa kapalı · seans ' + data.sessionId.slice(0, 8) + '…';
  frame.src = data.widgetUrl;

  listenForEmbedWidget(widgetOrigin, (type, payload) => {
    if (type === 'ready') {
      checkoutStatus.textContent = 'Widget hazır.';
    }
    if (type === 'selectionChanged') {
      const labels = /** @type {string[]} */ (payload.labels ?? []);
      const total = Number(payload.displayTotal ?? 0);
      const currency = String(payload.currency ?? 'TRY');
      selectionSummary.textContent =
        labels.join(', ') + ' · ' + formatMoney(total, currency);
    }
    if (type === 'checkoutRequested') {
      checkout = {
        holdId: String(payload.holdId ?? ''),
        seatIds: /** @type {string[]} */ (payload.seatIds ?? []),
        expiresAt: String(payload.expiresAt ?? ''),
      };
      hostCheckout.disabled = !checkout.holdId;
      startCountdown(checkout.expiresAt);
      checkoutStatus.textContent =
        'Hold ' + checkout.holdId.slice(0, 8) + '… · ödeme için onaylayın.';
    }
    if (type === 'holdExpired') {
      hostCheckout.disabled = true;
      checkout = {};
      checkoutStatus.textContent = 'Hold süresi doldu — widget’ta yeniden seçin.';
    }
    if (type === 'error') {
      checkoutStatus.textContent = String(payload.message ?? 'Widget hatası');
    }
  });
}

hostCheckout.addEventListener('click', async () => {
  if (!checkout.holdId) return;
  hostCheckout.disabled = true;
  checkoutStatus.textContent = 'Müşteri backend confirm çağırıyor…';
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holdId: checkout.holdId }),
  });
  const body = await response.json();
  if (!response.ok) {
    checkoutStatus.textContent = body.message || 'Onay başarısız (' + response.status + ')';
    hostCheckout.disabled = false;
    return;
  }
  checkout.orderKey = body.orderKey;
  checkoutStatus.textContent =
    'Rezervasyon ' + body.id + ' · koltuklar ' + (body.seatIds || []).join(', ');

  const retry = await fetch('/api/checkout/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holdId: checkout.holdId, orderKey: body.orderKey }),
  });
  const retryBody = await retry.json();
  if (retry.ok && retryBody.id === body.id) {
    checkoutStatus.textContent += ' · idempotent tekrar OK';
  }
});

hostForbidden.addEventListener('click', async () => {
  const response = await fetch('/api/embed-forbidden-test');
  const body = await response.json();
  checkoutStatus.textContent =
    response.status === 403
      ? 'Beklendiği gibi izinsiz origin reddedildi (403).'
      : 'Beklenmeyen: ' + response.status + ' ' + (body.message || '');
});

bootstrap().catch((error) => {
  checkoutStatus.textContent = error instanceof Error ? error.message : 'Yükleme hatası';
});
