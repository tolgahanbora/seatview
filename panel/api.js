export const API_BASE = 'http://127.0.0.1:3000';
export const DEMO_API_KEY = 'demo-meridian-api-key';
export const ENVIRONMENT = 'test';

const BUSINESS_NAME = 'Meridian Sineması';

export function apiHeaders(extra = {}) {
  return {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': ENVIRONMENT,
    ...extra,
  };
}

export async function apiGet(path) {
  const response = await fetch(API_BASE + path, { headers: apiHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(response.status + ': ' + text);
  }
  return response.json();
}

export async function apiPatch(path, body) {
  const response = await fetch(API_BASE + path, {
    method: 'PATCH',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 409) {
    const err = new Error('Revizyon çakışması');
    err.code = 'REVISION_CONFLICT';
    err.details = payload;
    throw err;
  }
  if (!response.ok) {
    const message =
      Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || response.statusText;
    throw new Error(message);
  }
  return payload;
}

export async function apiPost(path, body) {
  const response = await fetch(API_BASE + path, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || response.statusText;
    throw new Error(message);
  }
  return payload;
}

export function widgetPreviewUrl(session) {
  const params = new URLSearchParams({ sessionId: session.id, title: session.title });
  return 'http://127.0.0.1:4173/?' + params.toString();
}

export const DEMO_SESSION_SPECS = [
  {
    title: '19:45 · IMAX',
    startsAt: '2026-11-10T19:45:00+03:00',
  },
  {
    title: '22:15 · IMAX',
    startsAt: '2026-11-10T22:15:00+03:00',
  },
];

export function formatSessionTime(startsAt, timezone = 'Europe/Istanbul') {
  const date = new Date(startsAt);
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

export const PANEL_META = { businessName: BUSINESS_NAME, environment: ENVIRONMENT };
