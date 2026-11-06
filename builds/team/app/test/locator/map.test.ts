import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, byTag, byText, resetDom } from './fake-dom.ts';
import { fixtureData } from './fixtures.ts';
import { fakeLeaflet, makeEnv, type Env } from './screens-helpers.ts';
// @ts-expect-error plain JS module without types
import * as screens from '../../public/features/locator/screens.js';

let env: Env;
let leaflet: ReturnType<typeof fakeLeaflet>;
let loads: number;
beforeEach(() => {
  screens.hooks.now = () => new Date(2026, 10, 5);
  leaflet = fakeLeaflet();
  loads = 0;
  screens.hooks.loadLeaflet = async () => {
    loads += 1;
    return leaflet.L;
  };
});
afterEach(() => resetDom());

async function open(query: Record<string, string> = {}, data = fixtureData()) {
  env = makeEnv(data);
  const cleanup = screens.mount({ path: '/locations', params: {}, query }, env.container, env.ctx);
  await cleanup.settled();
  return cleanup;
}
const text = () => env.container.textContent;
const cards = () => byClass(env.container, 'loc-card').map((c) => c.getAttribute('data-facility'));

function twoPins() {
  const data = fixtureData();
  const f2 = data.facilities.find((f) => f.facility_id === 'f-2')!;
  f2.pin = { lat: 47.6, lng: -122.35 };
  return data;
}

test('LOC-13: markers only for pinned records, a note for the rest, OSM tiles with attribution', async () => {
  await open({ view: 'map' }, twoPins());
  assert.equal(loads, 1);
  assert.equal(leaflet.log.maps.length, 1);
  assert.equal(leaflet.log.markers.length, 2, 'f-1 and f-2 only; category and half-pinned records get no marker');
  assert.deepEqual(leaflet.log.markers.map((m) => m.latlng).sort(), [[47.5, -122.3], [47.6, -122.35]]);
  const tile = leaflet.log.tiles[0];
  assert.equal(tile.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.match(tile.opts.attribution, /href="https:\/\/www\.openstreetmap\.org\/copyright"/);
  assert.match(tile.opts.attribution, /© OpenStreetMap contributors/);
  assert.match(text(), /places have no map pin and appear only in the list/);
  assert.ok(leaflet.log.maps[0].bounds, 'fits the pins');
});

test('a single pin centers the map on it', async () => {
  await open({ view: 'map' });
  assert.equal(leaflet.log.markers.length, 1);
  assert.deepEqual(leaflet.log.maps[0].view, [[47.5, -122.3], 14]);
});

test('marker popup names the site and opens its detail screen', async () => {
  await open({ view: 'map' });
  const popup = leaflet.log.markers[0].popup;
  assert.match(popup.textContent, /Zeta Pinned Station/);
  const a = byTag(popup, 'a')[0];
  const e = a.click();
  assert.equal(e.defaultPrevented, true);
  assert.deepEqual(env.navigations, ['/locations/f-1']);
});

test('no pinned records: the message and the List button, and the map library is never loaded', async () => {
  await open({ view: 'map', material: 'metal' });
  assert.match(text(), /No mapped locations yet; see the list/);
  assert.equal(loads, 0);
  assert.equal(leaflet.log.maps.length, 0);
  assert.ok(byText(env.container, 'button', 'List').length >= 1);
  byText(env.container, 'button', 'List')[0].click();
  assert.deepEqual(cards(), ['f-7']);
});

test('list view never loads the map library', async () => {
  await open();
  assert.equal(loads, 0);
});

test('LOC-1: Map and List buttons switch views over the same records', async () => {
  const cleanup = await open({}, twoPins());
  const listIds = cards();
  assert.ok(listIds.length > 2);
  byText(env.container, 'button', 'Map')[0].click();
  await cleanup.settled();
  assert.equal(byClass(env.container, 'loc-card').length, 0);
  assert.equal(leaflet.log.markers.length, 2);
  assert.equal(env.dom.urls.at(-1), '/locations?view=map');
  const pressed = byClass(env.container, 'loc-toggle-btn').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  assert.deepEqual(pressed, ['Map']);
  // the markers are exactly the pinned records of the list
  assert.equal(leaflet.log.removed, 0);
  byText(env.container, 'button', 'List')[0].click();
  await cleanup.settled();
  assert.equal(leaflet.log.removed, 1, 'leaving the map removes it');
  assert.deepEqual(cards(), listIds);
  assert.equal(env.dom.urls.at(-1), '/locations');
});

test('LOC-18: the filter applies to the map too', async () => {
  const cleanup = await open({ view: 'map' }, twoPins());
  assert.equal(leaflet.log.markers.length, 2);
  const select = byTag(env.container, 'select')[0];
  select.value = 'paint';
  select.dispatch('change');
  await cleanup.settled();
  assert.match(text(), /No mapped locations yet; see the list/);
  select.value = 'batteries';
  select.dispatch('change');
  await cleanup.settled();
  assert.equal(leaflet.log.markers.length, 2 + 1, 'only f-1 carries batteries with a pin');
});

test('cleanup removes the map', async () => {
  const cleanup = await open({ view: 'map' });
  cleanup();
  assert.equal(leaflet.log.removed, 1);
  assert.equal(env.container.children.length, 0);
});

test('a map library that fails to load leaves a message and the list one tap away', async () => {
  screens.hooks.loadLeaflet = async () => {
    throw new Error('offline');
  };
  await open({ view: 'map' });
  assert.match(text(), /The map could not be loaded/);
  assert.ok(byText(env.container, 'button', 'List').length >= 1);
});

test('item context on the map: only the cited rule sites', async () => {
  await open({ view: 'map', item: 'tires', rule_ids: 'r-official' }, twoPins());
  assert.equal(leaflet.log.markers.length, 2);
  assert.match(text(), /Where to take: tires/);
});
