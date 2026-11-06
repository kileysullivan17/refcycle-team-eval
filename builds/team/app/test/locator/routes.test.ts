import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { configure, handle } from '../../src/features/locator/routes.ts';
import { fixtureData } from './fixtures.ts';

let server: http.Server;
let base = '';

before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!(await handle(req, res, url))) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"Not found"}');
    }
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  configure();
  server.close();
});

async function get(path: string, method = 'GET') {
  const r = await fetch(base + path, { method });
  return { status: r.status, body: await r.json() };
}

test('GET /api/sites returns rules, sites and official_source', async () => {
  configure(async () => fixtureData());
  const { status, body } = await get('/api/sites?place=fix_a');
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body).sort(), ['official_source', 'rules', 'sites']);
  assert.ok(body.sites.length > 0);
  assert.ok(!JSON.stringify(body).includes('internal_notes'));
});

test('rule_ids and material parameters', async () => {
  configure(async () => fixtureData());
  const a = await get('/api/sites?place=fix_a&rule_ids=r-limited,r-official');
  assert.deepEqual(a.body.rules.map((r: { rule_id: string }) => r.rule_id), ['r-limited', 'r-official']);
  const empty = await get('/api/sites?place=fix_a&rule_ids=');
  assert.deepEqual(empty.body.sites, []);
  assert.equal(empty.body.official_source.url, 'https://example.org/fix_a/official');
  const m = await get('/api/sites?place=fix_a&material=paint');
  assert.deepEqual(m.body.sites.map((s: { facility_id: string }) => s.facility_id).sort(), ['f-3', 'f-8', 'f-9']);
});

test('bad requests', async () => {
  configure(async () => fixtureData());
  assert.equal((await get('/api/sites')).status, 400);
  assert.equal((await get('/api/sites?place=nowhere')).status, 400);
});

test('other paths and methods are not handled', async () => {
  configure(async () => fixtureData());
  assert.equal((await get('/api/other?place=fix_a')).status, 404);
  assert.equal((await get('/api/sites?place=fix_a', 'POST')).status, 404);
});

test('a load failure is a 500 with a fixed body and no detail', async () => {
  configure(async () => {
    throw new Error('secret detail about /some/path');
  });
  const log = console.error;
  console.error = () => {};
  try {
    const { status, body } = await get('/api/sites?place=fix_a');
    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'Site data could not be loaded' });
  } finally {
    console.error = log;
  }
});

test('the real data answers for each place', async () => {
  configure();
  for (const place of ['seattle_wa', 'austin_tx', 'hawaii_county_hi']) {
    const { status, body } = await get(`/api/sites?place=${place}`);
    assert.equal(status, 200);
    assert.ok(body.sites.length > 0);
  }
  const hc = await get('/api/sites?place=hawaii_county_hi&rule_ids=hc-plastic-011');
  assert.deepEqual(hc.body.sites.map((s: { facility_id: string }) => s.facility_id), ['f-hc-06']);
  assert.equal(hc.body.sites[0].only_site, true);
  const wrong = await get('/api/sites?place=seattle_wa&rule_ids=hc-plastic-011');
  assert.deepEqual(wrong.body.rules, []);
  assert.deepEqual(wrong.body.sites, []);
});
