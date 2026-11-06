// Client calls to the app's own API. Every failure is reported as an Error with a short message; callers show the "no answer" state.
import { validateAnswer } from './item-model.js';

export const ASK_TIMEOUT_MS = 150000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, init = {}, timeoutMs = 30000, outerSignal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctl.abort(outerSignal.reason);
  if (outerSignal) {
    if (outerSignal.aborted) ctl.abort(outerSignal.reason);
    else outerSignal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const res = await fetch(path, { ...init, signal: ctl.signal });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) throw new ApiError((body && body.error) || `HTTP ${res.status}`, res.status);
    return body;
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onAbort);
  }
}

/** True when a request was cancelled on purpose (a screen was left or the place changed). A timeout is not a cancel. */
export const isAbort = (e) => !!e && e.name === 'AbortError';

export function fetchJurisdictions() {
  return request('/api/jurisdictions');
}

/** POST /api/ask. Throws ApiError on HTTP 400, network failure, timeout or a response that does not fit the contract (X-7). */
export async function ask(place, query, signal, timeoutMs = ASK_TIMEOUT_MS) {
  const body = await request(
    '/api/ask',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jurisdiction: place, query }) },
    timeoutMs,
    signal,
  );
  const valid = validateAnswer(body);
  if (!valid) throw new ApiError('Unexpected response', 200);
  return valid;
}

let catalogPromise = null;
export function getCatalog() {
  catalogPromise ??= request('/api/catalog').catch((e) => {
    catalogPromise = null;
    throw e;
  });
  return catalogPromise;
}

/** GET /api/sites. ruleIds undefined means every linked record for the place. */
export function getSites(place, { ruleIds, material, signal } = {}) {
  const p = new URLSearchParams({ place });
  if (ruleIds !== undefined) p.set('rule_ids', ruleIds.join(','));
  if (material) p.set('material', material);
  return request(`/api/sites?${p.toString()}`, {}, 30000, signal);
}

export function identify(image, signal) {
  return request(
    '/api/identify',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) },
    90000,
    signal,
  );
}

/** Fire and forget; logging never blocks display. */
export function logSwap(record) {
  try {
    fetch('/api/log/display-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record), keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}
