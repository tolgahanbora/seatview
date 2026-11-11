/** @typedef {'ready' | 'selectionChanged' | 'checkoutRequested' | 'holdExpired' | 'error'} EmbedEventType */

export const EMBED_CONTRACT = 'embed.v1';
const CHANNEL = 'seatview-embed';

/**
 * @param {unknown} data
 * @returns {data is { channel: string, contractVersion: string, type: EmbedEventType, payload: Record<string, unknown> }}
 */
export function isEmbedMessage(data) {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    /** @type {Record<string, unknown>} */ (data).channel === CHANNEL &&
    /** @type {Record<string, unknown>} */ (data).contractVersion === EMBED_CONTRACT &&
    typeof /** @type {Record<string, unknown>} */ (data).type === 'string'
  );
}

/**
 * Widget (iframe) → host postMessage.
 * @param {EmbedEventType} type
 * @param {Record<string, unknown>} payload
 * @param {string} targetOrigin
 */
export function postToEmbedHost(type, payload, targetOrigin) {
  if (!globalThis.parent || globalThis.parent === globalThis) return;
  const origin = targetOrigin && targetOrigin !== '*' ? targetOrigin : 'http://127.0.0.1:4280';
  globalThis.parent.postMessage(
    { channel: CHANNEL, contractVersion: EMBED_CONTRACT, type, payload },
    origin,
  );
}

/**
 * @param {string} expectedWidgetOrigin
 * @param {(type: EmbedEventType, payload: Record<string, unknown>, event: MessageEvent) => void} onEvent
 * @returns {() => void}
 */
export function listenForEmbedWidget(expectedWidgetOrigin, onEvent) {
  const handler = (event) => {
    if (event.origin !== expectedWidgetOrigin) return;
    if (!event.source) return;
    if (!isEmbedMessage(event.data)) return;
    onEvent(event.data.type, event.data.payload ?? {}, event);
  };
  globalThis.addEventListener('message', handler);
  return () => globalThis.removeEventListener('message', handler);
}
