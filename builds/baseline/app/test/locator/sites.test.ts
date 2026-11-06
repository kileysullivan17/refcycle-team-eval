import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadSiteData, querySites } from '../../src/features/locator/sites.ts';
import { FIXTURE_ROWS, writeSiteFixtures } from '../helpers/site-fixtures.ts';
import { FACILITIES_CSV, RULES_DIR } from '../../src/shared/paths.ts';

async function fixture(rows?: string[]) {
  const f = await writeSiteFixtures(rows);
  return loadSiteData(f.rulesDir, f.csv);
}

describe('querySites on fixtures', () => {
  it('without rule_ids returns every linked record of the place, sorted by name, never unlinked ones', async () => {
    const r = querySites(await fixture(), { place: 'test_place' })!;
    assert.deepEqual(r.sites.map((s) => s.facility_id), ['f-3', 'f-2', 'f-1', 'f-5', 'f-4', 'f-hc-03']);
    assert.ok(!r.sites.some((s) => s.facility_id === 'f-6' || s.facility_id === 'f-7'));
    assert.ok(r.sites.every((s) => !s.only_site));
    assert.equal(r.official_source.url, 'https://example.org/official/test_place');
  });

  it('filters by rule_ids and flags only_site for location-limited rules', async () => {
    const r = querySites(await fixture(), { place: 'test_place', ruleIds: ['t-2'] })!;
    assert.deepEqual(r.sites.map((s) => s.facility_id), ['f-3']);
    assert.equal(r.sites[0].only_site, true);
    assert.deepEqual(r.rules.map((x) => x.rule_id), ['t-2']);
    assert.equal(r.rules[0].location_limited, true);
    assert.equal(r.rules[0].source_kind, 'field_observation');
    assert.equal(r.rules[0].source_date, '2026-03-04');
  });

  it('empty rule_ids list returns no sites (LOC-11) and unknown ids are ignored', async () => {
    const d = await fixture();
    assert.deepEqual(querySites(d, { place: 'test_place', ruleIds: [] })!.sites, []);
    assert.deepEqual(querySites(d, { place: 'test_place', ruleIds: ['nope'] })!.sites, []);
  });

  it('returns null for a place without a pack and keeps places apart', async () => {
    const d = await fixture();
    assert.equal(querySites(d, { place: 'nowhere' }), null);
    const r = querySites(d, { place: 'other_place', ruleIds: ['t-1'] })!;
    assert.deepEqual(r.sites.map((s) => s.facility_id), ['f-7']);
    assert.equal(r.official_source.url, 'https://example.org/official/other_place');
  });

  it('filters by material', async () => {
    const r = querySites(await fixture(), { place: 'test_place', material: 'tires' })!;
    assert.deepEqual(r.sites.map((s) => s.facility_id), ['f-2', 'f-1']);
  });

  it('applies the pin, address, kind and date rules and never serves internal_notes', async () => {
    const r = querySites(await fixture(), { place: 'test_place' })!;
    const by = Object.fromEntries(r.sites.map((s) => [s.facility_id, s]));
    assert.deepEqual(by['f-1'].pin, { lat: 47.5, lng: -122.3 });
    assert.equal(by['f-2'].pin, null);
    assert.equal(by['f-3'].address, null);
    assert.equal(by['f-4'].address, null);
    assert.equal(by['f-4'].pin, null, 'category records never get a pin');
    assert.equal(by['f-4'].kind, 'category');
    assert.equal(by['f-5'].kind, 'event');
    assert.equal(by['f-5'].address, 'location to be announced');
    assert.equal(by['f-3'].source_label, 'phone report, 2026-11-03');
    assert.deepEqual(by['f-1'].materials, ['tires', 'batteries']);
    assert.ok(!JSON.stringify(r).includes('secret internal'));
    assert.ok(!('internal_notes' in by['f-1']));
  });

  it('rejects an unknown facility type as a contract break', async () => {
    const f = await writeSiteFixtures(['f-9,test_place,X,mystery_type,tires,,,,,,,t-1,,']);
    await assert.rejects(loadSiteData(f.rulesDir, f.csv), /Unknown facility type/);
  });

  it('never reads a rule whose source is superseded', async () => {
    const pack = (await import('../helpers/site-fixtures.ts')).FIXTURE_PACK;
    // The engine loader already refuses a rule with a superseded main source, so the loader error is the guard.
    const bad = pack.replace('source: s1, quote: "q", verified_by_ks: true }\n  - { id: t-2', 'source: s3, quote: "q", verified_by_ks: true }\n  - { id: t-2');
    const f = await writeSiteFixtures(FIXTURE_ROWS, bad);
    await assert.rejects(loadSiteData(f.rulesDir, f.csv));
  });
});

describe('real packs and facility list (invariants only)', () => {
  it('load, every rule link resolves in its own place, every record fits the schema', async () => {
    const data = await loadSiteData(RULES_DIR, FACILITIES_CSV);
    assert.ok(data.facilities.length > 0);
    const ids = new Set<string>();
    for (const f of data.facilities) {
      assert.ok(!ids.has(f.facility_id), `duplicate ${f.facility_id}`);
      ids.add(f.facility_id);
      const pack = data.packs.get(f.place);
      assert.ok(pack, `${f.facility_id} has an unknown place`);
      for (const id of f.rule_ids) assert.ok(pack.rules.some((r) => r.id === id), `${f.facility_id} links missing rule ${id}`);
      if (f.pin) assert.ok(f.kind === 'site' || f.kind === 'event');
      assert.ok(['site', 'event', 'category', 'how_to'].includes(f.kind));
      assert.ok(f.kind !== 'event' || f.event_last_date, `${f.facility_id} event needs a last date`);
    }
  });

  it('every place can be queried and carries the pack official source', async () => {
    const data = await loadSiteData(RULES_DIR, FACILITIES_CSV);
    for (const [id, pack] of data.packs) {
      const r = querySites(data, { place: id })!;
      assert.equal(r.official_source.url, pack.jurisdiction.official_contact_url);
    }
  });
});
