// Pure rules for the item page (CONTRACTS 8). No DOM here, so every state can be tested directly.

export const STREAMS = ['recycle_bin', 'compost_bin', 'garbage', 'drop_off_special', 'deposit_return'];
export const BEHAVIORS = ['answer', 'abstain', 'clarify', 'conditional'];

/** G5 */
export const STREAM_LABELS = {
  recycle_bin: 'Recycling',
  compost_bin: 'Compost',
  garbage: 'Garbage',
  drop_off_special: 'Special drop-off',
  deposit_return: 'Deposit return',
};

export const MAX_QUERY = 2000;

const isStr = (v) => typeof v === 'string';
const isStrList = (v) => Array.isArray(v) && v.every(isStr);

/**
 * Checks an /api/ask response against the fields the screen relies on. Returns the response or null.
 * A response that does not fit is shown as the error state, never guessed at (X-7).
 */
export function validateAnswer(a) {
  if (!a || typeof a !== 'object') return null;
  if (!BEHAVIORS.includes(a.behavior)) return null;
  if (!isStr(a.explanation) || !isStrList(a.prep) || !isStrList(a.rule_ids) || !isStrList(a.source_urls)) return null;
  if (a.item_interpreted !== null && a.item_interpreted !== undefined && !isStr(a.item_interpreted)) return null;
  if (a.behavior === 'answer' && !STREAMS.includes(a.stream)) return null;
  if (a.behavior !== 'answer' && a.stream !== null && a.stream !== undefined) return null;
  if (a.behavior === 'conditional') {
    if (!Array.isArray(a.conditions) || a.conditions.length < 1) return null;
    if (!a.conditions.every((c) => c && isStr(c.if) && STREAMS.includes(c.stream))) return null;
  }
  if (a.behavior === 'clarify' && !(isStr(a.clarifying_question) && a.clarifying_question.trim())) return null;
  return a;
}

/** The one display state for a response (CONTRACTS 8). */
export function stateFor(a) {
  if (a.behavior === 'answer') {
    if (a.stream === 'garbage') return 'card-yellow';
    if (a.stream === 'drop_off_special') return 'card-red';
    return 'card-blue'; // recycle_bin, compost_bin, deposit_return (X-10)
  }
  if (a.behavior === 'clarify') return 'referee-check-clarify';
  if (a.behavior === 'conditional') return 'referee-check-conditional';
  return 'referee-check-abstain';
}

/** Dispose shows on the red card, on the blue card for deposit_return, and on conditional answers with a special or deposit case (G19). */
export function showDispose(a) {
  if (a.behavior === 'answer') return a.stream === 'drop_off_special' || a.stream === 'deposit_return';
  if (a.behavior === 'conditional') return a.conditions.some((c) => c.stream === 'drop_off_special' || c.stream === 'deposit_return');
  return false;
}

/** /locations?item=<query>&rule_ids=<ids> (CON-2). For a conditional answer the cases ride along so the locator can group by case (G19). */
export function disposeHref(query, a) {
  const p = new URLSearchParams();
  p.set('item', query);
  p.set('rule_ids', a.rule_ids.join(','));
  if (a.behavior === 'conditional') for (const c of a.conditions) p.append('case', `${c.stream}|${c.if}`);
  return `/locations?${p.toString()}`;
}

/** G20: the engine keeps no state, so a reply becomes: the query sent so far, a space, the reply. Returns null when it will not fit. */
export function clarifyQuery(sentQuery, reply) {
  const r = String(reply ?? '').trim();
  if (!r) return null;
  const q = `${sentQuery} ${r}`;
  return q.length > MAX_QUERY ? null : q;
}

/** G14 */
export function titleFor(a, query) {
  const t = a.item_interpreted;
  return t && t.trim() ? t : query;
}

export function streamLabel(stream) {
  return STREAM_LABELS[stream] ?? '';
}
