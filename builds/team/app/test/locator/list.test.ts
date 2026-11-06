import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, byTag, byText, resetDom, type FakeNode } from './fake-dom.ts';
import { fixtureData } from './fixtures.ts';
import { makeEnv, type Env } from './screens-helpers.ts';
// @ts-expect-error plain JS module without types
import * as screens from '../../public/features/locator/screens.js';

let env: Env;
beforeEach(() => {
  screens.hooks.now = () => new Date(2026, 10, 5);
});
afterEach(() => resetDom());

async function open(query: Record<string, string> = {}, place = 'fix_a') {
  env = makeEnv(fixtureData(), place);
  const cleanup = screens.mount({ path: '/locations', params: {}, query }, env.container, env.ctx);
  await cleanup.settled();
  return cleanup;
}
const text = () => env.container.textContent;
const cards = () => byClass(env.container, 'loc-card');
const cardFor = (id: string) => cards().find((c) => c.getAttribute('data-facility') === id)!;

test('LOC-12: no rule_ids lists every linked record for the place, sorted by name', async () => {
  await open();
  assert.match(env.calls[0], /^\/api\/sites\?place=fix_a$/);
  const ids = cards().map((c) => c.getAttribute('data-facility'));
  assert.ok(!ids.includes('f-10') && !ids.includes('f-11'));
  const names = byClass(env.container, 'loc-name').map((n) => n.textContent.toLowerCase());
  assert.deepEqual(names, [...names].sort());
  assert.deepEqual(env.titles, ['Locations']);
  assert.ok(!/No mapped|only place/i.test(text()));
});

test('site card: address, notes as written, takes, source link and checked date', async () => {
  await open();
  const t = cardFor('f-1').textContent;
  assert.match(t, /Zeta Pinned Station/);
  assert.match(t, /1 Main St, Fixture/);
  assert.match(t, /\$16 per load, 4 tires max\./);
  assert.match(t, /Takes: tires; batteries/);
  assert.match(t, /checked 2026-11-05/);
  const link = byTag(cardFor('f-1'), 'a').find((a) => a.getAttribute('href') === 'https://example.org/zeta')!;
  assert.ok(link);
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
});

test('LOC-15 how_to and LOC-16 category entries have no address, with notes and source', async () => {
  await open();
  const how = cardFor('f-6');
  assert.match(how.textContent, /How to/);
  assert.match(how.textContent, /Fee applies\./);
  assert.ok(byClass(how, 'loc-address').length === 0);
  assert.ok(byTag(how, 'a').some((a) => a.getAttribute('href') === 'https://example.org/curb'));
  const cat = cardFor('f-7');
  assert.match(cat.textContent, /Several places/);
  assert.ok(byClass(cat, 'loc-address').length === 0);
  assert.ok(byTag(cat, 'a').some((a) => a.getAttribute('href') === 'https://example.org/bins'));
});

test('withheld and not listed addresses are not shown; location to be announced is', async () => {
  await open();
  assert.ok(!/withheld|not listed/i.test(text()));
  assert.match(cardFor('f-8').textContent, /location to be announced/);
});

test('LOC-7: field sources show their kind and date', async () => {
  await open();
  assert.match(cardFor('f-4').textContent, /Source: phone report, 2026-11-03/);
});

test('LOC-17: events are tentative with notes, checked date and source; after the last date they say check the source', async () => {
  await open();
  let ev = cardFor('f-8');
  assert.match(ev.textContent, /Tentative/);
  assert.match(ev.textContent, /Tentative 2027-03-06\./);
  assert.match(ev.textContent, /checked 2026-09-10/);
  assert.ok(byTag(ev, 'a').some((a) => a.getAttribute('href') === 'https://example.org/events'));

  screens.hooks.now = () => new Date(2027, 2, 6); // the last date itself
  await open();
  assert.match(cardFor('f-8').textContent, /Tentative/);
  assert.ok(!/Check the source for the next event/.test(cardFor('f-8').textContent));

  screens.hooks.now = () => new Date(2027, 2, 7); // one day later
  await open();
  ev = cardFor('f-8');
  assert.match(ev.textContent, /Check the source for the next event/);
  assert.ok(!/Tentative 2027-03-06/.test(ev.textContent));
  assert.ok(byTag(ev, 'a').some((a) => a.getAttribute('href') === 'https://example.org/events'));
  // February event ended 2027-02-28
  assert.match(cardFor('f-9').textContent, /Check the source for the next event/);
});

test('eventState: tentative through the last date, past after, null for non-events', () => {
  const ev = { kind: 'event', event_last_date: '2027-03-06' };
  assert.equal(screens.eventState(ev, '2027-03-06'), 'tentative');
  assert.equal(screens.eventState(ev, '2027-03-07'), 'past');
  assert.equal(screens.eventState({ kind: 'event', event_last_date: null }, '2099-01-01'), 'tentative');
  assert.equal(screens.eventState({ kind: 'site', event_last_date: null }, '2099-01-01'), null);
});

test('LOC-18: the filter lists materials and narrows the list', async () => {
  await open();
  const select = byTag(env.container, 'select')[0];
  const options = byTag(select, 'option').map((o) => o.getAttribute('value'));
  assert.equal(options[0], '');
  assert.ok(options.includes('tires') && options.includes('paint'));
  const before = cards().length;
  select.value = 'paint';
  select.dispatch('change');
  const ids = cards().map((c) => c.getAttribute('data-facility')).sort();
  assert.deepEqual(ids, ['f-3', 'f-8', 'f-9']);
  assert.ok(ids.length < before);
  assert.equal(env.dom.urls.at(-1), '/locations?material=paint');
  select.value = '';
  select.dispatch('change');
  assert.equal(cards().length, before);
});

test('a filter with no match says so and offers to clear it', async () => {
  await open({ material: 'zzz' });
  assert.match(text(), /No locations take that material/);
  byText(env.container, 'button', 'Clear the filter')[0].click();
  assert.ok(cards().length > 0);
});

test('LOC-4/LOC-5: opened for an item with a location-limited rule shows the single site and says so', async () => {
  await open({ item: 'clear bottles', rule_ids: 'r-limited' });
  assert.match(env.calls[0], /rule_ids=r-limited/);
  assert.equal(cards().length, 1);
  assert.match(cards()[0].textContent, /The only place that takes this item/);
  assert.match(text(), /Where to take: clear bottles/);
  assert.match(text(), /This location only\./);
});

test('LOC-11: empty rule_ids, or a silent rule, says the pack does not name a place and links the official source', async () => {
  for (const q of [{ item: 'x', rule_ids: '' }, { item: 'x', rule_ids: 'r-silent' }, { item: 'x', rule_ids: 'r-old' }]) {
    await open(q);
    assert.match(text(), /The rules for this place don't name a place for this item/);
    assert.equal(cards().length, 0);
    assert.ok(byTag(env.container, 'a').some((a) => a.getAttribute('href') === 'https://example.org/fix_a/official'));
  }
});

test('a rule with where text but no record shows the pack wording and the official link', async () => {
  await open({ item: 'x', rule_ids: 'r-text-only' });
  assert.match(text(), /Pack describes a place but no record exists/);
  assert.ok(byTag(env.container, 'a').some((a) => a.getAttribute('href') === 'https://example.org/fix_a/official'));
});

test('LOC-3: pack and CSV strings pass through displayText', async () => {
  const data = fixtureData();
  data.packs.get('fix_a')!.rules.find((r) => r.id === 'r-official')!.where = 'Larger quantities: Big Island Biodiesel accepts limited quantities (call first)';
  env = makeEnv(data);
  const cleanup = screens.mount({ path: '/locations', params: {}, query: { item: 'oil', rule_ids: 'r-official' } }, env.container, env.ctx);
  await cleanup.settled();
  assert.ok(!/Big Island Biodiesel/.test(text()));
  assert.match(text(), /a local biodiesel company/);
  assert.ok(env.surfaces.length > 0 && env.surfaces.every((s) => s.startsWith('locator.')));
});

test('conditional: several cited rules group the sites under each rule', async () => {
  await open({ item: 'thing', rule_ids: 'r-official,r-limited,r-silent' });
  const groups = byClass(env.container, 'loc-group');
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.getAttribute('data-rule')), ['r-official', 'r-limited', 'r-silent']);
  assert.match(groups[0].textContent, /r-official item one; r-official item two/);
  assert.ok(byClass(groups[0], 'loc-card').length >= 2);
  assert.deepEqual(byClass(groups[1], 'loc-card').map((c) => c.getAttribute('data-facility')), ['f-4']);
  assert.match(groups[2].textContent, /The rules for this place don't name a place for this item/);
});

test('place change: with an item it asks the item page again; without one it reloads', async () => {
  await open({ item: 'tires', rule_ids: 'r-official' });
  env.firePlaceChange();
  assert.deepEqual(env.navigations, ['/item?q=tires&origin=search']);
  const cleanup = await open();
  const n = env.calls.length;
  env.firePlaceChange();
  await cleanup.settled();
  assert.equal(env.calls.length, n + 1);
});

test('a failed load shows an error and no sites', async () => {
  env = makeEnv(fixtureData());
  (globalThis as any).fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const cleanup = screens.mount({ path: '/locations', params: {}, query: {} }, env.container, env.ctx);
  await cleanup.settled();
  assert.match(text(), /could not be loaded/);
  assert.equal(cards().length, 0);
});

test('cleanup empties the container', async () => {
  const cleanup = await open();
  cleanup();
  assert.equal(env.container.children.length, 0);
});

test('no fields beyond the pack are shown: no ratings, reviews, hours, phone or distance labels', async () => {
  await open();
  assert.ok(!/rating|review|distance|miles|\bkm\b|phone:|call us/i.test(text().replace(/phone report/g, '')));
});

void (null as unknown as FakeNode);
