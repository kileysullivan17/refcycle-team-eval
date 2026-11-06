// Calls to the app server. Recycling answers come only from POST /api/ask (X-3).
import { isStream } from './streams.js';

/** The engine can take two provider attempts of up to 60 s each; the client gives up at 150 s. */
export const ASK_TIMEOUT_MS = 150000;

const BEHAVIORS = ['answer', 'abstain', 'clarify', 'conditional'];

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** True only for a response that has the engine's shape; anything else is treated as no answer. */
export function isValidAnswer(a) {
  if (!a || typeof a !== 'object') return false;
  if (!BEHAVIORS.includes(a.behavior)) return false;
  if (typeof a.explanation !== 'string' || !a.explanation) return false;
  if (a.item_interpreted !== null && typeof a.item_interpreted !== 'string') return false;
  if (!isStringArray(a.prep) || !isStringArray(a.rule_ids) || !isStringArray(a.source_urls)) return false;
  if (a.behavior === 'answer' && !isStream(a.stream)) return false;
  if (a.behavior !== 'answer' && a.stream !== null) return false;
  if (a.behavior === 'conditional') {
    if (!Array.isArray(a.conditions) || a.conditions.length < 1) return false;
    if (!a.conditions.every((c) => c && typeof c.if === 'string' && isStream(c.stream))) return false;
  } else if (a.conditions !== null) return false;
  if (a.behavior === 'clarify') {
    if (typeof a.clarifying_question !== 'string' || !a.clarifying_question) return false;
  } else if (a.clarifying_question !== null) return false;
  return true;
}

/**
 * Asks the engine. Resolves to { ok: true, answer } or { ok: false, reason } where reason is
 * 'http' (HTTP 400 or any non-200), 'network', 'timeout', 'invalid' or 'aborted'. It never rejects.
 */
export async function askEngine({ place, query, signal, timeoutMs = ASK_TIMEOUT_MS, fetchFn }) {
  const doFetch = fetchFn || globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort);
  }
  try {
    const response = await doFetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jurisdiction: place, query }),
      signal: controller.signal,
    });
    if (response.status !== 200) return { ok: false, reason: 'http' };
    const answer = await response.json();
    return isValidAnswer(answer) ? { ok: true, answer } : { ok: false, reason: 'invalid' };
  } catch {
    if (timedOut) return { ok: false, reason: 'timeout' };
    if (signal && signal.aborted) return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * The `where` text of the cited rules, from GET /api/sites (G5). Resolves to an array of strings, or
 * null on a 404 or any failure, so the caller hides the block and shows everything else.
 */
export async function fetchWhere({ place, ruleIds, signal, fetchFn }) {
  const doFetch = fetchFn || globalThis.fetch.bind(globalThis);
  try {
    const url = '/api/sites?place=' + encodeURIComponent(place) + '&rule_ids=' + ruleIds.map(encodeURIComponent).join(',');
    const response = await doFetch(url, { signal });
    if (response.status !== 200) return null;
    const body = await response.json();
    if (!body || !Array.isArray(body.rules)) return null;
    const seen = new Set();
    const out = [];
    for (const rule of body.rules) {
      if (rule && typeof rule.where === 'string' && rule.where.trim() && !seen.has(rule.where)) {
        seen.add(rule.where);
        out.push(rule.where);
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Reads GET /api/jurisdictions as { id, name }[] (names as the engine returned them). */
export async function fetchJurisdictions(fetchFn) {
  const doFetch = fetchFn || globalThis.fetch.bind(globalThis);
  const response = await doFetch('/api/jurisdictions');
  if (response.status !== 200) throw new Error('jurisdictions unavailable');
  const list = await response.json();
  if (!Array.isArray(list) || !list.length || !list.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')) {
    throw new Error('jurisdictions malformed');
  }
  return list.map((p) => ({ id: p.id, name: p.name }));
}
