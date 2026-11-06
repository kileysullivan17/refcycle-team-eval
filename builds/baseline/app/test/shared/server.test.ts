import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { answer, JURISDICTIONS, startFakeEngine, type FakeEngine } from '../helpers/fake-engine.ts';
import { startApp, type TestApp } from '../helpers/app.ts';

describe('app server', () => {
  let engine: FakeEngine;
  let app: TestApp;
  before(async () => {
    engine = await startFakeEngine((j, q) => (q === 'bad' ? { status: 400, body: { error: 'nope' } } : answer(j, { item_interpreted: q })));
    app = await startApp({ engineUrl: engine.url, modules: [] });
  });
  after(async () => {
    await app.close();
    await engine.close();
  });

  it('forwards GET /api/jurisdictions unchanged', async () => {
    const r = await fetch(`${app.url}/api/jurisdictions`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), JURISDICTIONS);
  });

  it('forwards POST /api/ask body and relays status and body', async () => {
    const body = JSON.stringify({ jurisdiction: 'seattle_wa', query: 'cardboard' });
    const r = await fetch(`${app.url}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as { item_interpreted: string }).item_interpreted, 'cardboard');
    assert.equal(engine.calls.at(-1)?.raw, body);
    const bad = await fetch(`${app.url}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jurisdiction: 'seattle_wa', query: 'bad' }) });
    assert.equal(bad.status, 400);
  });

  it('answers 502 when the engine cannot be reached', async () => {
    const dead = await startApp({ engineUrl: 'http://127.0.0.1:1', modules: [] });
    const r = await fetch(`${dead.url}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 502);
    await dead.close();
  });

  it('serves the shell for every client route and 404 JSON for anything else', async () => {
    for (const p of ['/', '/place', '/item?entry=x', '/recyclopedia', '/recyclopedia/plastic', '/search?q=a', '/scan', '/scan/confirm', '/locations', '/locations/f-1']) {
      const r = await fetch(`${app.url}${p}`);
      assert.equal(r.status, 200, p);
      assert.match(await r.text(), /<div id="app"/, p);
    }
    const nf = await fetch(`${app.url}/nothing-here`);
    assert.equal(nf.status, 404);
    assert.deepEqual(await nf.json(), { error: 'Not found' });
    const api = await fetch(`${app.url}/api/nothing`);
    assert.equal(api.status, 404);
  });

  it('does not serve files outside public/', async () => {
    for (const p of ['/../package.json', '/%2e%2e/package.json', '/shared/../../package.json']) {
      const r = await fetch(`${app.url}${p}`);
      assert.equal(r.status, 404, p);
    }
  });

  it('sets security headers', async () => {
    const r = await fetch(`${app.url}/`);
    assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  it('logs a display swap with a timestamp and rejects malformed records', async () => {
    const rec = { surface: 'item.title', from: 'County of Hawaiʻi', to: 'Hawaiʻi County', count: 2, place: 'hawaii_county_hi' };
    const r = await fetch(`${app.url}/api/log/display-swap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
    assert.equal(r.status, 200);
    const line = (await readFile(path.join(app.logsDir, 'display-swaps.jsonl'), 'utf8')).trim().split('\n').at(-1)!;
    const parsed = JSON.parse(line);
    assert.equal(parsed.from, rec.from);
    assert.ok(parsed.time);
    const bad = await fetch(`${app.url}/api/log/display-swap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec, extra: 1 }) });
    assert.equal(bad.status, 400);
  });
});
