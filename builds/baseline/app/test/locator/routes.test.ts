import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createHandle } from '../../src/features/locator/routes.ts';
import { startApp, type TestApp } from '../helpers/app.ts';
import { writeSiteFixtures } from '../helpers/site-fixtures.ts';

describe('GET /api/sites', () => {
  let app: TestApp;
  let broken: TestApp;
  before(async () => {
    const f = await writeSiteFixtures();
    app = await startApp({ modules: [{ handle: createHandle(f.rulesDir, f.csv) }] });
    broken = await startApp({ modules: [{ handle: createHandle(f.rulesDir, f.dir + '/missing.csv') }] });
  });
  after(async () => {
    await app.close();
    await broken.close();
  });

  it('returns rules, sites and the official source', async () => {
    const r = await fetch(`${app.url}/api/sites?place=test_place&rule_ids=t-1`);
    assert.equal(r.status, 200);
    const body = (await r.json()) as { rules: unknown[]; sites: Array<{ facility_id: string }>; official_source: { title: string } };
    assert.deepEqual(body.sites.map((s) => s.facility_id), ['f-2', 'f-1']);
    assert.equal(body.rules.length, 1);
    assert.equal(body.official_source.title, 'Official recycling information');
  });

  it('treats an empty rule_ids as no rules and a missing one as all', async () => {
    const none = (await (await fetch(`${app.url}/api/sites?place=test_place&rule_ids=`)).json()) as { sites: unknown[] };
    assert.equal(none.sites.length, 0);
    const all = (await (await fetch(`${app.url}/api/sites?place=test_place`)).json()) as { sites: unknown[] };
    assert.ok(all.sites.length > 0);
  });

  it('answers 400 for an unknown place', async () => {
    assert.equal((await fetch(`${app.url}/api/sites?place=nowhere`)).status, 400);
    assert.equal((await fetch(`${app.url}/api/sites`)).status, 400);
  });

  it('answers 500 with a fixed body when data cannot be loaded', async () => {
    const r = await fetch(`${broken.url}/api/sites?place=test_place`);
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: 'Site data could not be loaded' });
  });
});
