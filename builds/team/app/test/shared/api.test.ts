import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createAppServer } from '../../src/server.ts';
import { FIXTURES, startFakeEngine } from './fixtures.ts';
import { byTestId, findAll, installFakeDom, loadClient, until } from './fake-dom.ts';

const closers: (() => Promise<void> | void)[] = [];
after(async () => {
  for (const c of closers) await c();
});

async function appBase(engineUrl: string) {
  const server = await createAppServer({ engineUrl, features: ['recyclopedia'] });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  closers.push(() => new Promise<void>((r) => server.close(() => r())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const res = (status: number, body: unknown) => ({ status, json: async () => body });

test('the client timeout constant is 150 seconds', async () => {
  const api = await loadClient('shared/api.js');
  assert.equal(api.ASK_TIMEOUT_MS, 150000);
});

test('askEngine posts jurisdiction and query as JSON and returns a valid answer', async () => {
  const api = await loadClient('shared/api.js');
  let seen: any;
  const out = await api.askEngine({ place: 'austin_tx', query: 'milk jug', fetchFn: async (url: string, init: any) => ((seen = { url, init }), res(200, FIXTURES.recycle)) });
  assert.equal(out.ok, true);
  assert.deepEqual(out.answer, FIXTURES.recycle);
  assert.equal(seen.url, '/api/ask');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), { jurisdiction: 'austin_tx', query: 'milk jug' });
});

test('HTTP 400, other statuses, network failure and malformed answers are all "no answer" (X-7)', async () => {
  const api = await loadClient('shared/api.js');
  const reasons: [() => Promise<any>, string][] = [
    [async () => res(400, { error: 'bad' }), 'http'],
    [async () => res(502, { error: 'down' }), 'http'],
    [async () => { throw new TypeError('fetch failed'); }, 'network'],
    [async () => res(200, { behavior: 'answer' }), 'invalid'],
    [async () => res(200, { ...FIXTURES.recycle, stream: 'mystery_bin' }), 'invalid'],
    [async () => res(200, { ...FIXTURES.recycle, stream: null }), 'invalid'],
    [async () => res(200, { ...FIXTURES.abstain, stream: 'garbage' }), 'invalid'],
    [async () => res(200, { ...FIXTURES.conditional, conditions: null }), 'invalid'],
    [async () => res(200, { ...FIXTURES.clarify, clarifying_question: null }), 'invalid'],
    [async () => res(200, null), 'invalid'],
  ];
  for (const [fetchFn, reason] of reasons) {
    const out = await api.askEngine({ place: 'seattle_wa', query: 'x', fetchFn });
    assert.deepEqual(out, { ok: false, reason });
  }
});

test('the timeout gives "no answer" (shortened here; the real value is asserted above)', async () => {
  const api = await loadClient('shared/api.js');
  const started = Date.now();
  const out = await api.askEngine({
    place: 'seattle_wa',
    query: 'x',
    timeoutMs: 40,
    fetchFn: (_u: string, init: any) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  });
  assert.deepEqual(out, { ok: false, reason: 'timeout' });
  assert.ok(Date.now() - started < 1000);
});

test('an aborted request reports "aborted" so the page can ignore it', async () => {
  const api = await loadClient('shared/api.js');
  const controller = new AbortController();
  const promise = api.askEngine({
    place: 'seattle_wa',
    query: 'x',
    signal: controller.signal,
    fetchFn: (_u: string, init: any) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  });
  controller.abort();
  assert.deepEqual(await promise, { ok: false, reason: 'aborted' });
});

test('fetchWhere returns the where text of the cited rules, and null on 404 or any failure (G5)', async () => {
  const api = await loadClient('shared/api.js');
  let url = '';
  const ok = await api.fetchWhere({
    place: 'hawaii_county_hi',
    ruleIds: ['a-1', 'b-2'],
    fetchFn: async (u: string) => ((url = u), res(200, { rules: [{ rule_id: 'a-1', where: 'Site A' }, { rule_id: 'b-2', where: null }, { rule_id: 'c-3', where: 'Site A' }, { rule_id: 'd-4', where: '  ' }], sites: [] })),
  });
  assert.equal(url, '/api/sites?place=hawaii_county_hi&rule_ids=a-1,b-2');
  assert.deepEqual(ok, ['Site A']);
  assert.equal(await api.fetchWhere({ place: 'x', ruleIds: ['a'], fetchFn: async () => res(404, { error: 'Not found' }) }), null);
  assert.equal(await api.fetchWhere({ place: 'x', ruleIds: ['a'], fetchFn: async () => res(500, {}) }), null);
  assert.equal(await api.fetchWhere({ place: 'x', ruleIds: ['a'], fetchFn: async () => res(200, { nope: 1 }) }), null);
  assert.equal(await api.fetchWhere({ place: 'x', ruleIds: ['a'], fetchFn: async () => { throw new Error('down'); } }), null);
});

test('fetchJurisdictions reads the engine list unchanged and rejects a bad one', async () => {
  const api = await loadClient('shared/api.js');
  const list = await api.fetchJurisdictions(async () => res(200, [{ id: 'a', name: 'County of Hawaiʻi, HI', extra: 1 }]));
  assert.deepEqual(list, [{ id: 'a', name: 'County of Hawaiʻi, HI' }]);
  await assert.rejects(api.fetchJurisdictions(async () => res(502, {})));
  await assert.rejects(api.fetchJurisdictions(async () => res(200, [])));
  await assert.rejects(api.fetchJurisdictions(async () => res(200, [{ id: 1 }])));
});

// ---- Through the real app server and a fake engine ----

async function itemThroughServer(base: string, query: Record<string, string>, place = 'hawaii_county_hi') {
  const env = installFakeDom('/item');
  const api = await loadClient('shared/api.js');
  const item = await loadClient('shared/item.js');
  const { displayText } = await loadClient('shared/display-text.js');
  const prefixed = (url: string, init?: any) => fetch(base + url, init);
  const titles: string[] = [];
  const ctx = { place, places: [], displayText, navigate: () => undefined, setTitle: (t: string) => void titles.push(t), onPlaceChange: () => () => undefined };
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);
  const cleanup = item.mount({ path: '/item', params: {}, query }, container, ctx, {
    askEngine: (a: any) => api.askEngine({ ...a, fetchFn: prefixed }),
    fetchWhere: (a: any) => api.fetchWhere({ ...a, fetchFn: prefixed }),
    loadCatalog: async () => (await fetch(base + '/api/catalog')).json(),
  });
  const state = () => container.children[0]?.getAttribute('data-state');
  await until(() => state() !== 'loading');
  return { env, container, titles, state, cleanup };
}

test('end to end: an entry sends its query and the stored place through the app to the engine (RC-4)', async () => {
  const engine = await startFakeEngine(() => ({ body: FIXTURES.conditional }));
  closers.push(() => engine.close());
  const base = await appBase(engine.url);
  const page = await itemThroughServer(base, { entry: 'plastic-2' });
  try {
    assert.equal(page.state(), 'referee-check-conditional');
    const ask = engine.requests.filter((r) => r.url === '/api/ask');
    assert.equal(ask.length, 1);
    assert.deepEqual(JSON.parse(ask[0].body), { jurisdiction: 'hawaii_county_hi', query: 'Plastic #2 HDPE' });
    // /api/sites is not served by this slice: the block is hidden and everything else shows
    assert.equal(byTestId(page.container, 'where')!.hidden, true);
    assert.ok(byTestId(page.container, 'explanation'));
  } finally {
    page.env.restore();
  }
});

test('end to end: free text goes to the engine as typed (RC-9)', async () => {
  const engine = await startFakeEngine(() => ({ body: FIXTURES.garbage }));
  closers.push(() => engine.close());
  const base = await appBase(engine.url);
  const page = await itemThroughServer(base, { q: 'old garden hose', origin: 'search' }, 'austin_tx');
  try {
    assert.equal(page.state(), 'card-yellow');
    assert.deepEqual(JSON.parse(engine.requests.find((r) => r.url === '/api/ask')!.body), { jurisdiction: 'austin_tx', query: 'old garden hose' });
  } finally {
    page.env.restore();
  }
});

test('end to end: an engine HTTP 400 and an unreachable engine both give the error state (X-7)', async () => {
  const engine = await startFakeEngine(() => ({ status: 400, body: { error: 'bad' } }));
  closers.push(() => engine.close());
  const base = await appBase(engine.url);
  const bad = await itemThroughServer(base, { q: 'x', origin: 'search' });
  try {
    assert.equal(bad.state(), 'error');
    assert.equal(bad.container.children[0].textContent, 'No answer available right nowRetry');
  } finally {
    bad.env.restore();
  }
  const down = await itemThroughServer(await appBase('http://127.0.0.1:1'), { q: 'x', origin: 'search' });
  try {
    assert.equal(down.state(), 'error');
    assert.equal(findAll(down.container, (n) => n.tagName === 'a').length, 0);
  } finally {
    down.env.restore();
  }
});

test('end to end: an engine abstention (provider failure) is shown like any abstention (X-6)', async () => {
  const engine = await startFakeEngine(() => ({ body: { ...FIXTURES.abstain, explanation: 'We could not produce a verified answer from the local rules. Please try again or check the official source.' } }));
  closers.push(() => engine.close());
  const base = await appBase(engine.url);
  const page = await itemThroughServer(base, { q: 'x', origin: 'search' });
  try {
    assert.equal(page.state(), 'referee-check-abstain');
    assert.equal(byTestId(page.container, 'verdict-card'), null);
  } finally {
    page.env.restore();
  }
});
