import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClient } from '../helpers/client.ts';

const r = await loadClient('shared/router.js');
const p = await loadClient('shared/place.js');

describe('router', () => {
  it('matches every route in CONTRACTS 10 to its module', () => {
    const cases: Array<[string, string, string | null]> = [
      ['/', 'home', null],
      ['/place', 'place', null],
      ['/item?entry=x', 'item', null],
      ['/recyclopedia', 'recyclopedia', '/features/recyclopedia/screens.js'],
      ['/recyclopedia/plastic', 'category', '/features/recyclopedia/screens.js'],
      ['/search?q=a', 'search', '/features/recyclopedia/screens.js'],
      ['/scan', 'scan', '/features/camera-scan/screens.js'],
      ['/scan/confirm', 'scan-confirm', '/features/camera-scan/screens.js'],
      ['/locations?view=list', 'locations', '/features/locator/screens.js'],
      ['/locations/f-sea-01', 'facility', '/features/locator/screens.js'],
    ];
    for (const [href, name, mod] of cases) {
      const m = r.matchRoute(href);
      assert.equal(m.name, name, href);
      assert.equal(m.module, mod, href);
    }
  });
  it('decodes params and query values', () => {
    const m = r.matchRoute('/locations/a%20b?item=car%20tires&rule_ids=a,b');
    assert.deepEqual(m.params, { facilityId: 'a b' });
    assert.deepEqual(m.query, { item: 'car tires', rule_ids: 'a,b' });
  });
  it('returns null for unknown paths and tolerates a trailing slash', () => {
    assert.equal(r.matchRoute('/nothing'), null);
    assert.equal(r.matchRoute('/recyclopedia/').name, 'recyclopedia');
    assert.equal(r.matchRoute('/recyclopedia/a/b'), null);
  });
  it('lights the right tab', () => {
    assert.equal(r.tabFor('item'), 'recyclopedia');
    assert.equal(r.tabFor('scan-confirm'), 'scan');
    assert.equal(r.tabFor('facility'), 'locations');
    assert.equal(r.tabFor('place'), null);
  });
});

describe('place storage (X-1)', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it('remembers the choice under refcycle.place, with no default', () => {
    const s = memory();
    assert.equal(p.STORAGE_KEY, 'refcycle.place');
    assert.equal(p.readPlace(s), null);
    p.writePlace('austin_tx', s);
    assert.equal(p.readPlace(s), 'austin_tx');
    p.clearPlace(s);
    assert.equal(p.readPlace(s), null);
  });
  it('survives storage that throws', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    assert.equal(p.readPlace(bad), null);
    assert.doesNotThrow(() => p.writePlace('a', bad));
    assert.doesNotThrow(() => p.clearPlace(bad));
  });
  it('accepts a stored id only if the engine lists it', () => {
    const places = [{ id: 'a', name: 'A' }];
    assert.equal(p.validPlace('a', places), 'a');
    assert.equal(p.validPlace('b', places), null);
    assert.equal(p.validPlace(null, places), null);
  });
});
