import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClient } from '../helpers/client.ts';

const m = await loadClient('features/locator/logic.js');
const site = (over: object) => ({ facility_id: 'f', kind: 'site', materials: [], pin: null, rule_ids: [], event_last_date: null, ...over });

describe('event state (LOC-17)', () => {
  it('is current up to and including the last date and past after it', () => {
    const e = site({ kind: 'event', event_last_date: '2027-03-06' });
    assert.equal(m.eventState(e, '2027-03-06'), 'current');
    assert.equal(m.eventState(e, '2027-03-07'), 'past');
    assert.equal(m.eventState(e, '2026-11-05'), 'current');
  });
  it('treats other kinds as none and an event without a date as current', () => {
    assert.equal(m.eventState(site({}), '2030-01-01'), 'none');
    assert.equal(m.eventState(site({ kind: 'event' }), '2030-01-01'), 'current');
  });
  it('formats the device date as YYYY-MM-DD', () => {
    assert.equal(m.todayISO(new Date(2027, 0, 5)), '2027-01-05');
  });
});

describe('evidence notes (LOC-7)', () => {
  const rules = [
    { rule_id: 'a', source_kind: 'official_page', source_date: '2026-01-01' },
    { rule_id: 'b', source_kind: 'field_observation', source_date: '2026-03-04' },
    { rule_id: 'c', source_kind: 'field_report', source_date: '2026-11-03' },
  ];
  it('names field observations and reports with their dates and says nothing for published pages', () => {
    assert.deepEqual(m.evidenceNotes(site({ rule_ids: ['a'] }), rules), []);
    assert.deepEqual(m.evidenceNotes(site({ rule_ids: ['a', 'b', 'c', 'b'] }), rules), ['Field observation dated 2026-03-04; not a published page.', 'Field report dated 2026-11-03; not a published page.']);
    assert.deepEqual(m.evidenceNotes(site({ rule_ids: ['zzz'] }), rules), []);
  });
});

describe('filter, pins and cases', () => {
  it('lists each material once, sorted', () => {
    assert.deepEqual(m.materialOptions([site({ materials: ['tires', 'batteries'] }), site({ materials: ['Tires', 'oil'] })]), ['batteries', 'oil', 'tires', 'Tires']);
  });
  it('keeps only records with a pin', () => {
    const s = [site({ facility_id: 'a', pin: { lat: 1, lng: 2 } }), site({ facility_id: 'b' })];
    assert.deepEqual(m.mapSites(s).map((x: any) => x.facility_id), ['a']);
    assert.deepEqual(m.mapSites([site({ pin: { lat: NaN, lng: 1 } })]), []);
  });
  it('parses case values and groups sites only under cases that end at a drop-off', () => {
    const cases = m.parseCases(['garbage|very small, solidified', 'drop_off_special|larger quantity', 'broken', '|x']);
    assert.deepEqual(cases, [{ stream: 'garbage', if: 'very small, solidified' }, { stream: 'drop_off_special', if: 'larger quantity' }]);
    const groups = m.groupByCase(cases, [site({ facility_id: 'a' })]);
    assert.equal(groups[0].sites.length, 0);
    assert.equal(groups[0].needsSite, false);
    assert.equal(groups[1].sites.length, 1);
    assert.equal(m.groupByCase([{ stream: 'deposit_return', if: 'x' }], [site({})])[0].needsSite, true);
  });
  it('opens on the map unless the list is asked for', () => {
    assert.equal(m.viewFrom(undefined), 'map');
    assert.equal(m.viewFrom('list'), 'list');
    assert.equal(m.viewFrom('junk'), 'map');
  });
});
