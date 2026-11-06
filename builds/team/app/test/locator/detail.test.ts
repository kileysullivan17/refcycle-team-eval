import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, byTag, resetDom } from './fake-dom.ts';
import { fixtureData } from './fixtures.ts';
import { makeEnv, type Env } from './screens-helpers.ts';
// @ts-expect-error plain JS module without types
import * as screens from '../../public/features/locator/screens.js';

let env: Env;
beforeEach(() => {
  screens.hooks.now = () => new Date(2026, 10, 5);
});
afterEach(() => resetDom());

async function open(id: string, data = fixtureData()) {
  env = makeEnv(data);
  const cleanup = screens.mount({ path: `/locations/${id}`, params: { facilityId: id }, query: {} }, env.container, env.ctx);
  await cleanup.settled();
  return cleanup;
}
const text = () => env.container.textContent;

test('LOC-9: lists the applies_to items of each linked rule and nothing from other rules', async () => {
  await open('f-3'); // linked to r-official and r-obs
  assert.match(text(), /r-official item one/);
  assert.match(text(), /r-official item two/);
  assert.match(text(), /r-obs item one/);
  assert.ok(!/r-limited item|r-silent item|r-old item|r-howto item/.test(text()));
  const blocks = byClass(env.container, 'loc-rule').map((b) => b.getAttribute('data-rule'));
  assert.deepEqual(blocks, ['r-official', 'r-obs']);
});

test('LOC-5: a site behind a location-limited rule says it is the only place', async () => {
  await open('f-4');
  assert.match(text(), /This is the only place that takes this item\./);
  assert.match(text(), /Applies to: r-limited item one; r-limited item two/);
  assert.match(text(), /Source: phone report, 2026-11-03/);
  assert.ok(!/withheld/.test(text()));
});

test('a site not behind a limited rule does not claim to be the only place', async () => {
  await open('f-1');
  assert.ok(!/only place/i.test(text()));
  assert.match(text(), /1 Main St, Fixture/);
  assert.match(text(), /\$16 per load, 4 tires max\./);
  assert.match(text(), /checked 2026-11-05/);
  assert.deepEqual(env.titles.at(-1), 'Zeta Pinned Station');
});

test('detail for how_to and category records has no address and shows the source', async () => {
  await open('f-6');
  assert.ok(byClass(env.container, 'loc-address').length === 0);
  assert.ok(byTag(env.container, 'a').some((a) => a.getAttribute('href') === 'https://example.org/curb'));
  await open('f-7');
  assert.ok(!/not listed/.test(text()));
});

test('events on the detail screen: tentative, then check the source', async () => {
  await open('f-8');
  assert.match(text(), /Tentative/);
  assert.match(text(), /location to be announced/);
  screens.hooks.now = () => new Date(2027, 2, 7);
  await open('f-8');
  assert.match(text(), /Check the source for the next event/);
  assert.ok(!/Tentative 2027-03-06/.test(text()));
});

test('a record whose only rule rests on a superseded source is not found', async () => {
  await open('f-12');
  assert.match(text(), /could not find that location/);
});

test('an unknown id is not found and offers the list', async () => {
  await open('f-nope');
  assert.match(text(), /could not find that location/);
  assert.ok(byTag(env.container, 'a').some((a) => a.getAttribute('href') === '/locations'));
});

test('a field-source rule without a source label is noted with its date', async () => {
  const data = fixtureData();
  const f = data.facilities.find((x) => x.facility_id === 'f-4')!;
  f.source_label = null;
  await open('f-4', data);
  assert.match(text(), /Based on a field report dated 2026-11-03; not a published page\./);
});

test('detail text passes through displayText and is inserted as text', async () => {
  const data = fixtureData();
  data.packs.get('fix_a')!.rules.find((r) => r.id === 'r-official')!.where = 'Call Big Island Biodiesel <b>now</b>';
  await open('f-1', data);
  assert.ok(!/Big Island Biodiesel/.test(text()));
  assert.match(text(), /<b>now<\/b>/);
});

test('changing the place leaves the detail screen', async () => {
  await open('f-1');
  env.firePlaceChange();
  assert.deepEqual(env.navigations, ['/locations']);
});
