export const API_BASE = 'http://127.0.0.1:3000';
export const DEMO_API_KEY = 'demo-meridian-api-key';
export const DEFAULT_SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001';

const params = new URLSearchParams(globalThis.location?.search ?? '');
const SESSION_STORAGE_KEY = 'seatview-current-session-id';

export const DRAFT_ID = params.get('draftId') || '';
export const SESSION_ID = DRAFT_ID
  ? ''
  : params.get('sessionId') || DEFAULT_SESSION_ID;
export const SESSION_TITLE = params.get('title') || '';

/** @deprecated SESSION_ID kullanın */
export const DEMO_SESSION_ID = SESSION_ID;

if (typeof sessionStorage !== 'undefined' && SESSION_ID) {
  const previous = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (previous !== SESSION_ID) {
    sessionStorage.removeItem('seatview-active-hold-id');
    sessionStorage.removeItem('seatview-demo-order-key');
    sessionStorage.setItem(SESSION_STORAGE_KEY, SESSION_ID);
  }
}

export const WIDGET_ENVIRONMENT = 'test';
export const PREVIEW_FAIL = params.get('previewFail') === '1';
export const EMBED_TOKEN = params.get('embedToken') || '';
export const EMBED_HOST_ORIGIN = params.get('embedHost') || '';
export const IS_EMBED_MODE = Boolean(EMBED_TOKEN);
export const WIDGET_ORIGIN =
  typeof globalThis.location !== 'undefined' ? globalThis.location.origin : 'http://127.0.0.1:4173';

/** @returns {Record<string, string>} */
export function apiHeaders(options = {}) {
  const headers = { 'X-Seatview-Environment': WIDGET_ENVIRONMENT };
  if (IS_EMBED_MODE) {
    headers.Authorization = 'Bearer ' + EMBED_TOKEN;
  } else {
    headers['X-Business-Api-Key'] = DEMO_API_KEY;
  }
  if (options.json) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export function sessionSeatsPath(sessionId) {
  return IS_EMBED_MODE
    ? '/embed/sessions/' + sessionId + '/seats'
    : '/sessions/' + sessionId + '/seats';
}

export function sessionLayoutPath(sessionId) {
  return IS_EMBED_MODE
    ? '/embed/sessions/' + sessionId + '/layout'
    : '/sessions/' + sessionId + '/layout';
}

export function sessionHoldsPath(sessionId) {
  return IS_EMBED_MODE
    ? '/embed/sessions/' + sessionId + '/holds'
    : '/sessions/' + sessionId + '/holds';
}

export function holdReleasePath(holdId) {
  return IS_EMBED_MODE ? '/embed/holds/' + holdId + '/release' : '/holds/' + holdId + '/release';
}
