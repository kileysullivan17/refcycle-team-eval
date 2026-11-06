// The screens against the real packs and the real CSV: invariants only (no counts, no coordinates).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, resetDom } from './fake-dom.ts';
import { makeEnv, fakeLeaflet } from './screens-helpers.ts';
import { loadSiteData, type SiteData } from '../../src/features/locator/sites.ts';
// @ts-expect-error plain JS module without types
import * as screens from '../../public/features/locator/screens.js';

let data: SiteData;
beforeEach(async () => {
  data = await loadSiteData();
  screens.hooks.now = () => new Date(2026, 10, 5);
  screens.hooks.loadLeaflet = async () => fakeLeaflet().L;
});
afterEach(() => resetDom());

async function render(place: string, path: string, query: Record<string, string>, params: Record<string, string> = {}) {
  const env = makeEnv(data, place);
  const cleanup = screens.mount({ path, params, query }, env.container, env.ctx);
  await cleanup.settled();
  return env;
}

const FORBIDDEN = /Big Island Biodiesel|County of Hawai|withheld \(|not listed|internal_notes|Coordinates entered/i;

test('LOC-3, X-2, X-8: no withheld business name, county spelling, withheld address or internal note on any screen', async () => {
  for (const place of data.packs.keys()) {
    for (const view of ['list', 'map']) {
      const env = await render(place, '/locations', { view });
      assert.ok(!FORBIDDEN.test(env.container.textContent), `${place} ${view}`);
    }
    for (const f of data.facilities.filter((x) => x.place === place && x.rule_ids.length)) {
      const env = await render(place, `/locations/${f.facility_id}`, {}, { facilityId: f.facility_id });
      assert.ok(!FORBIDDEN.test(env.container.textContent), `${place} ${f.facility_id}`);
      assert.ok(byClass(env.container, 'loc-detail').length === 1, f.facility_id);
    }
    for (const rule of data.packs.get(place)!.rules) {
      const env = await render(place, '/locations', { item: rule.id, rule_ids: rule.id });
      assert.ok(!FORBIDDEN.test(env.container.textContent), `${place} ${rule.id}`);
    }
  }
});

test('LOC-3: the hc-oil-015 where text shows the public description', async () => {
  const env = await render('hawaii_county_hi', '/locations', { item: 'cooking oil', rule_ids: 'hc-oil-015' });
  assert.match(env.container.textContent, /a local biodiesel company/);
  assert.ok(!/Big Island Biodiesel/.test(env.container.textContent));
});

test('LOC-5: location-limited items show the single site and say it is the only place', async () => {
  for (const rule of ['hc-plastic-011', 'hc-plastic-012']) {
    const env = await render('hawaii_county_hi', '/locations', { item: 'bottles', rule_ids: rule });
    assert.equal(byClass(env.container, 'loc-card').length, 1);
    assert.match(env.container.textContent, /The only place that takes this item/);
    assert.match(env.container.textContent, /phone report, 2026-11-03/);
  }
});

test('LOC-11: a rule id from another place shows the no-place message with the official source', async () => {
  const env = await render('seattle_wa', '/locations', { item: 'x', rule_ids: 'hc-plastic-011' });
  assert.match(env.container.textContent, /The rules for this place don't name a place for this item/);
});
