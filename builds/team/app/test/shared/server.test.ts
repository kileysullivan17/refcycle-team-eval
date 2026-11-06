import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createAppServer, CSP, type FeatureModule } from '../../src/server.ts';
import { FIXTURES, PLACES, startFakeEngine } from './fixtures.ts';

const cleanup: (() => Promise<unknown> | unknown)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await fn();
});

async function startApp(engineUrl: string, extra: Parameters<typeof createAppServer>[0] = {}) {
  const logsDir = await mkdtemp(join(tmpdir(), 'refcycle-logs-'));
  const server: Server = await createAppServer({ engineUrl, logsDir, features: ['recyclopedia'], ...extra });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise((resolve) => server.close(resolve)));
  cleanup.push(() => rm(logsDir, { recursive: true, force: true }));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, logsDir };
}

test('GET /api/jurisdictions is forwarded unchanged', async () => {
  const engine = await startFakeEngine();
  cleanup.push(() => engine.close());
  const { base } = await startApp(engine.url);
  const direct = await (await fetch(engine.url + '/api/jurisdictions')).text();
  const res = await fetch(base + '/api/jurisdictions');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), direct);
  assert.deepEqual(JSON.parse(direct), PLACES);
});

test('POST /api/ask is forwarded unchanged, status and body', async () => {
  const engine = await startFakeEngine(() => ({ body: FIXTURES.conditional }));
  cleanup.push(() => engine.close());
  const { base } = await startApp(engine.url);
  const body = JSON.stringify({ jurisdiction: 'seattle_wa', query: 'Plastic #2 HDPE' });
  const res = await fetch(base + '/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), FIXTURES.conditional);
  const seen = engine.requests.at(-1)!;
  assert.equal(seen.body, body);
  assert.equal(seen.contentType, 'application/json');
});

test('HTTP 400 bodies from the engine pass through unchanged', async () => {
  const engine = await startFakeEngine();
  cleanup.push(() => engine.close());
  const { base } = await startApp(engine.url);
  const cases: { body: string; type: string }[] = [
    { body: '{"jurisdiction":"seattle_wa"}', type: 'application/json' },
    { body: 'not json', type: 'application/json' },
    { body: '{"jurisdiction":"seattle_wa","query":"x"}', type: 'text/plain' },
    { body: JSON.stringify({ jurisdiction: 'seattle_wa', query: 'x', extra: 1 }), type: 'application/json' },
  ];
  for (const c of cases) {
    const viaApp = await fetch(base + '/api/ask', { method: 'POST', headers: { 'Content-Type': c.type }, body: c.body });
    const direct = await fetch(engine.url + '/api/ask', { method: 'POST', headers: { 'Content-Type': c.type }, body: c.body });
    assert.equal(direct.status, 400);
    assert.equal(viaApp.status, 400);
    assert.equal(await viaApp.text(), await direct.text());
  }
});

test('an unreachable engine gives a JSON 502 for ask and jurisdictions', async () => {
  const { base } = await startApp('http://127.0.0.1:1');
  const ask = await fetch(base + '/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(ask.status, 502);
  assert.match(String((await ask.json()).error), /engine/i);
  const places = await fetch(base + '/api/jurisdictions');
  assert.equal(places.status, 502);
});

test('static files, client routes and 404 JSON', async () => {
  const { base } = await startApp('http://127.0.0.1:1');
  const index = await (await fetch(base + '/')).text();
  assert.match(index, /<div id="app">/);
  for (const route of ['/place', '/recyclopedia', '/recyclopedia/plastic', '/search?q=x', '/item?q=x&origin=search', '/scan', '/scan/confirm', '/locations', '/locations/f-hc-01']) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200, route);
    assert.equal(await res.text(), index, route);
  }
  const js = await fetch(base + '/shared/main.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') ?? '', /javascript/);
  const font = await fetch(base + '/shared/fonts/museomoderno-latin-700-normal.woff2');
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
});

test('a missing feature screen module is a 404 JSON, not index.html (CONTRACTS 2.1)', async () => {
  const { base } = await startApp('http://127.0.0.1:1');
  for (const path of ['/features/not-a-feature/screens.js', '/nope', '/api/nope', '/recyclopedia/a/b']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 404, path);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  }
});

test('node_modules, dot files and path traversal are not served', async () => {
  const { base } = await startApp('http://127.0.0.1:1');
  for (const path of ['/node_modules/leaflet/package.json', '/../package.json', '/%2e%2e/package.json', '/shared/../../package.json', '/.env', '/shared/%00', '/shared/']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 404, path);
  }
  // raw request so the client does not normalise the dots away
  const url = new URL(base);
  const raw = await new Promise<string>((resolve, reject) => {
    import('node:net').then(({ connect }) => {
      const socket = connect(Number(url.port), url.hostname, () => socket.write('GET /../package.json HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let data = '';
      socket.on('data', (d) => (data += d));
      socket.on('end', () => resolve(data));
      socket.on('error', reject);
    });
  });
  assert.match(raw.split('\r\n')[0], /404/);
});

test('security headers allow OpenStreetMap tiles, blob and data media, and inline styles; nothing remote else', async () => {
  const { base } = await startApp('http://127.0.0.1:1');
  const res = await fetch(base + '/');
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.equal(csp, CSP);
  const directive = (name: string) => (csp.split('; ').find((d) => d.startsWith(name + ' ')) ?? '').split(' ').slice(1);
  assert.deepEqual(directive('img-src').sort(), ["'self'", 'blob:', 'data:', 'https://tile.openstreetmap.org'].sort());
  assert.ok(directive('media-src').includes('blob:') && directive('media-src').includes('data:'));
  assert.ok(directive('style-src').includes("'unsafe-inline'"));
  assert.deepEqual(directive('script-src'), ["'self'"]);
  assert.deepEqual(directive('connect-src'), ["'self'"]);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('permissions-policy') ?? '', /geolocation=\(\)/);
});

test('POST /api/log/display-swap appends one JSONL line with a timestamp', async () => {
  const { base, logsDir } = await startApp('http://127.0.0.1:1');
  const record = { surface: 'item.explanation', from: 'County of Hawaiʻi', to: 'Hawaiʻi County', count: 2, place: 'hawaii_county_hi' };
  const res = await fetch(base + '/api/log/display-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
  assert.equal(res.status, 204);
  const lines = (await readFile(join(logsDir, 'display-swaps.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  const line = JSON.parse(lines[0]);
  assert.match(line.timestamp, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual({ ...line, timestamp: undefined }, { ...record, timestamp: undefined });
});

test('display-swap rejects malformed records and writes nothing', async () => {
  const { base, logsDir } = await startApp('http://127.0.0.1:1');
  const bad = ['not json', '[]', '{}', JSON.stringify({ surface: 'a', from: 'b', to: 'c', count: 0, place: 'x' }), JSON.stringify({ surface: 'a', from: 'b', to: 'c', count: 1 }), JSON.stringify({ surface: 'a', from: 'b', to: 'c', count: 1, place: 'x'.repeat(9000) })];
  for (const body of bad) {
    const res = await fetch(base + '/api/log/display-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.ok([400, 413].includes(res.status), body.slice(0, 30));
  }
  await assert.rejects(readFile(join(logsDir, 'display-swaps.jsonl'), 'utf8'));
  const get = await fetch(base + '/api/log/display-swap');
  assert.equal(get.status, 404);
});

test('feature modules load in order, a missing one is skipped, a failing one is skipped', async () => {
  const order: string[] = [];
  const mod = (name: string, path: string): FeatureModule => ({
    async handle(req, res, url) {
      order.push(name);
      if (url.pathname !== path) return false;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ from: name }));
      return true;
    },
  });
  const loaded: string[] = [];
  const { base } = await startApp('http://127.0.0.1:1', {
    features: ['first', 'not-a-feature', 'broken', 'third'],
    loadFeature: async (name) => {
      loaded.push(name);
      if (name === 'not-a-feature') return null;
      if (name === 'broken') throw new Error('boom');
      return mod(name, name === 'first' ? '/api/one' : '/api/three');
    },
  });
  assert.deepEqual(loaded, ['first', 'not-a-feature', 'broken', 'third']);
  assert.deepEqual(await (await fetch(base + '/api/three')).json(), { from: 'third' });
  assert.deepEqual(order, ['first', 'third']);
  order.length = 0;
  assert.equal((await fetch(base + '/api/none')).status, 404);
  assert.deepEqual(order, ['first', 'third']);
});

test('own routes win over feature modules', async () => {
  const { base } = await startApp('http://127.0.0.1:1', {
    features: ['greedy'],
    loadFeature: async () => ({
      async handle(_req, res) {
        res.end('feature');
        return true;
      },
    }),
  });
  const res = await fetch(base + '/api/jurisdictions');
  assert.equal(res.status, 502); // forwarded to the (unreachable) engine, not answered by the feature
});
