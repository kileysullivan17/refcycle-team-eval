import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadPacks } from '../../../engine/code/src/rules.ts';
import { defaultPaths, eventLastDate, loadSiteData, parseFacilities, querySites } from '../../src/features/locator/sites.ts';
import { fixtureData, FIXTURE_CSV } from './fixtures.ts';

const ids = (r: { sites: { facility_id: string }[] }) => r.sites.map((s) => s.facility_id);

test('no rule_ids: every linked record for the place, sorted by name case-insensitively', () => {
  const r = querySites(fixtureData(), { place: 'fix_a' })!;
  assert.ok(!ids(r).includes('f-10'), 'empty rule_ids record is never shown');
  assert.ok(!ids(r).includes('f-11'), 'other place is not shown');
  assert.ok(!ids(r).includes('f-12'), 'a record linked only to a superseded-source rule is not shown');
  const names = r.sites.map((s) => s.name.toLowerCase());
  assert.deepEqual(names, [...names].sort());
  assert.equal(r.sites[0].name, 'A private recycler (limited)');
  assert.deepEqual(r.rules, []);
  assert.ok(r.sites.every((s) => s.only_site === false));
});

test('no response carries internal_notes or its text', () => {
  const r = querySites(fixtureData(), { place: 'fix_a' })!;
  const text = JSON.stringify(r);
  assert.ok(!text.includes('internal_notes'));
  assert.ok(!text.includes('SECRET-INTERNAL'));
});

test('official_source is the pack official_contact_url', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', rule_ids: [] })!;
  assert.deepEqual(r.official_source, { title: 'Official recycling information', url: 'https://example.org/fix_a/official' });
  assert.deepEqual(r.sites, []);
  assert.deepEqual(r.rules, []);
});

test('rule_ids: sites linked to a cited rule, one RuleWhere per id with applies_to', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-limited', 'r-official', 'r-limited', 'no-such-rule'] })!;
  assert.deepEqual(r.rules.map((x) => x.rule_id), ['r-limited', 'r-official']);
  assert.deepEqual(r.rules[1].applies_to, ['r-official item one', 'r-official item two']);
  assert.ok(ids(r).includes('f-4') && ids(r).includes('f-1'));
  assert.ok(!ids(r).includes('f-7'));
});

test('a rule id from another place pack returns nothing', () => {
  const data = fixtureData();
  data.packs.get('fix_b')!.rules.push({ ...data.packs.get('fix_a')!.rules[0], id: 'only-in-b' });
  const r = querySites(data, { place: 'fix_a', rule_ids: ['only-in-b'] })!;
  assert.deepEqual(r.rules, []);
  assert.deepEqual(r.sites, []);
});

test('unknown place returns null', () => {
  assert.equal(querySites(fixtureData(), { place: 'nowhere' }), null);
});

test('location_limited rule links its record with only_site true', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-limited'] })!;
  assert.deepEqual(ids(r), ['f-4']);
  assert.equal(r.sites[0].only_site, true);
  assert.equal(r.rules[0].location_limited, true);
  const other = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-official'] })!;
  assert.ok(other.sites.every((s) => !s.only_site));
});

test('field sources give kind, date and url', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-limited', 'r-obs', 'r-official'] })!;
  const by = Object.fromEntries(r.rules.map((x) => [x.rule_id, x]));
  assert.equal(by['r-limited'].source_kind, 'field_report');
  assert.equal(by['r-limited'].source_date, '2026-11-03 (phone call)');
  assert.equal(by['r-limited'].source_url, null);
  assert.equal(by['r-obs'].source_kind, 'field_observation');
  assert.equal(by['r-official'].source_kind, 'official_page');
  assert.equal(by['r-official'].source_date, '2026-08-08');
  assert.equal(by['r-official'].source_url, 'https://example.org/page');
});

test('a rule on a superseded source is never read, and neither are its sites', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-old'] })!;
  assert.deepEqual(r.rules, []);
  assert.deepEqual(r.sites, []);
});

test('material filter keeps only records whose materials include the value', () => {
  const r = querySites(fixtureData(), { place: 'fix_a', material: 'paint' })!;
  assert.deepEqual(ids(r).sort(), ['f-3', 'f-8', 'f-9']);
  const both = querySites(fixtureData(), { place: 'fix_a', rule_ids: ['r-official'], material: 'paint' })!;
  assert.deepEqual(ids(both), ['f-3']);
});

test('kinds follow CONTRACTS 7.2 and only site and event records get a pin', () => {
  const by = Object.fromEntries(parseFacilities(FIXTURE_CSV).map((f) => [f.facility_id, f]));
  assert.equal(by['f-1'].kind, 'site');
  assert.deepEqual(by['f-1'].pin, { lat: 47.5, lng: -122.3 });
  assert.equal(by['f-2'].pin, null);
  assert.equal(by['f-3'].pin, null, 'lat without lng is no pin');
  assert.equal(by['f-5'].kind, 'category');
  assert.equal(by['f-5'].pin, null, 'category records never get a pin even with coordinates');
  assert.equal(by['f-6'].kind, 'how_to');
  assert.equal(by['f-7'].kind, 'category');
  assert.equal(by['f-8'].kind, 'event');
  assert.equal(by['f-1'].type, 'transfer_station');
  assert.deepEqual(by['f-1'].materials, ['tires', 'batteries']);
});

test('an unknown type fails loudly at load', () => {
  const bad = FIXTURE_CSV.replace('transfer_station', 'mystery_type');
  assert.throws(() => parseFacilities(bad), /unknown type/);
});

test('a bad coordinate fails loudly at load', () => {
  const bad = FIXTURE_CSV.replace('47.5,-122.3,https://example.org/zeta', 'north,-122.3,https://example.org/zeta');
  assert.throws(() => parseFacilities(bad), /invalid lat/);
});

test('address rule: withheld and not listed are hidden, location to be announced is shown', () => {
  const by = Object.fromEntries(parseFacilities(FIXTURE_CSV).map((f) => [f.facility_id, f]));
  assert.equal(by['f-4'].address, null);
  assert.equal(by['f-5'].address, null);
  assert.equal(by['f-7'].address, null);
  assert.equal(by['f-6'].address, null);
  assert.equal(by['f-8'].address, 'location to be announced');
  assert.equal(by['f-1'].address, '1 Main St, Fixture');
});

test('empty source fields become null', () => {
  const by = Object.fromEntries(parseFacilities(FIXTURE_CSV).map((f) => [f.facility_id, f]));
  assert.equal(by['f-4'].source_url, null);
  assert.equal(by['f-4'].source_label, 'phone report, 2026-11-03');
  assert.equal(by['f-1'].source_label, null);
});

test('event_last_date is read from the notes', () => {
  assert.equal(eventLastDate('Tentative 2027-03-06.'), '2027-03-06');
  assert.equal(eventLastDate('Tentative February 2027, date TBD. Residential only.'), '2027-02-28');
  assert.equal(eventLastDate('Tentative February 2028, date TBD.'), '2028-02-29');
  assert.equal(eventLastDate('Call first.'), null);
  const by = Object.fromEntries(parseFacilities(FIXTURE_CSV).map((f) => [f.facility_id, f]));
  assert.equal(by['f-8'].event_last_date, '2027-03-06');
  assert.equal(by['f-9'].event_last_date, '2027-02-28');
  assert.equal(by['f-1'].event_last_date, null);
});

// ---- the real packs and the real CSV: invariants only ----

const BOX: Record<string, [number, number, number, number]> = {
  seattle_wa: [47.3, 47.9, -122.6, -122.0],
  austin_tx: [29.9, 30.8, -98.1, -97.4],
  hawaii_county_hi: [18.8, 20.4, -156.2, -154.7],
};

test('real data loads and every record fits the schema', async () => {
  const data = await loadSiteData();
  assert.deepEqual([...data.packs.keys()].sort(), ['austin_tx', 'hawaii_county_hi', 'seattle_wa']);
  assert.ok(data.facilities.length > 0);
  for (const f of data.facilities) {
    assert.ok(['site', 'event', 'category', 'how_to'].includes(f.kind), f.facility_id);
    assert.ok(data.packs.has(f.place), f.facility_id);
    assert.ok(f.name, f.facility_id);
    assert.ok(Array.isArray(f.materials));
  }
});

test('real data: every rule_id resolves in the record place pack', async () => {
  const data = await loadSiteData();
  for (const f of data.facilities) {
    const pack = data.packs.get(f.place)!;
    for (const id of f.rule_ids) assert.ok(pack.rules.some((r) => r.id === id), `${f.facility_id} -> ${id}`);
  }
});

test('real data: lat and lng come together, are in range and inside the place; pin matches the CSV', async () => {
  const csv = await readFile(defaultPaths().csvPath, 'utf8');
  const raw = (await import('csv-parse/sync')).parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const data = await loadSiteData();
  for (const row of raw) {
    const f = data.facilities.find((x) => x.facility_id === row.facility_id)!;
    const hasLat = row.lat.trim() !== '';
    const hasLng = row.lng.trim() !== '';
    assert.equal(hasLat, hasLng, `${row.facility_id}: lat and lng must both be filled or both empty`);
    if (!hasLat) {
      assert.equal(f.pin, null);
      continue;
    }
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, row.facility_id);
    assert.ok(Number.isFinite(lng) && lng >= -180 && lng <= 180, row.facility_id);
    const [a, b, c, d] = BOX[row.place];
    assert.ok(lat >= a && lat <= b && lng >= c && lng <= d, `${row.facility_id} is outside ${row.place}`);
    assert.deepEqual(f.pin, { lat, lng });
  }
});

test('real data: no record with an empty rule_ids is served; sorted; no internal_notes', async () => {
  const data = await loadSiteData();
  for (const place of data.packs.keys()) {
    const r = querySites(data, { place })!;
    assert.ok(r.sites.every((s) => s.rule_ids.length > 0));
    assert.equal(r.official_source.url, data.packs.get(place)!.jurisdiction.official_contact_url);
    const names = r.sites.map((s) => s.name.toLowerCase());
    assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    const text = JSON.stringify(r);
    assert.ok(!text.includes('internal_notes'));
    assert.ok(!text.includes('Coordinates entered by KS'));
  }
});

test('real data: location-limited Hawaiʻi County rules serve only their record', async () => {
  const data = await loadSiteData();
  for (const [rule, site] of [['hc-plastic-011', 'f-hc-06'], ['hc-plastic-012', 'f-hc-07']]) {
    const r = querySites(data, { place: 'hawaii_county_hi', rule_ids: [rule] })!;
    assert.deepEqual(r.sites.map((s) => s.facility_id), [site]);
    assert.equal(r.sites[0].only_site, true);
    assert.equal(r.sites[0].source_label, 'phone report, 2026-11-03');
    assert.equal(r.rules[0].source_kind, 'field_report');
    assert.match(r.rules[0].source_date ?? '', /^2026-11-03/);
  }
});

test('real data: HHW event last dates follow CONTRACTS 7.3', async () => {
  const data = await loadSiteData();
  const by = Object.fromEntries(data.facilities.map((f) => [f.facility_id, f.event_last_date]));
  assert.equal(by['f-hc-01'], '2027-02-28');
  assert.equal(by['f-hc-02'], '2027-02-28');
  assert.equal(by['f-hc-03'], '2027-03-06');
  assert.equal(by['f-hc-04'], '2027-03-07');
});

test('real data: a rule with a superseded source cannot be read', async () => {
  const packs = await loadPacks(fileURLToPath(new URL('../../../engine/rules', import.meta.url)));
  for (const pack of packs.values()) {
    const superseded = new Set(pack.sources.filter((s) => s.kind === 'superseded').map((s) => s.id));
    for (const rule of pack.rules) assert.ok(!superseded.has(rule.source), rule.id);
  }
});
