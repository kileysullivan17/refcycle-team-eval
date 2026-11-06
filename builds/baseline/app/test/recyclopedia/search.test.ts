import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClient } from '../helpers/client.ts';

const m = await loadClient('features/recyclopedia/search.js');
const entries = [
  { id: 'p1', name: 'Plastic #1 PET' },
  { id: 'p2', name: 'Plastic bottles and jugs' },
  { id: 'g', name: 'Glass bottles and jars' },
  { id: 'f', name: 'Styrofoam' },
];

describe('catalog search (RC-3, RC-9)', () => {
  it('filters by case-insensitive substring of the name', () => {
    assert.deepEqual(m.filterEntries(entries, 'plastic').map((e: any) => e.id), ['p1', 'p2']);
    assert.deepEqual(m.filterEntries(entries, '  BOTTLES ').map((e: any) => e.id), ['p2', 'g']);
    assert.deepEqual(m.filterEntries(entries, ''), []);
  });
  it('opens results when something matches and sends the text to the engine otherwise', () => {
    assert.equal(m.submitTarget(entries, 'plastic'), '/search?q=plastic');
    assert.equal(m.submitTarget(entries, 'bread bag clips'), '/item?q=bread%20bag%20clips&origin=search');
    assert.equal(m.submitTarget(entries, '   '), null);
  });
  it('caps a free question at the engine limit', () => {
    const target = m.submitTarget(entries, 'z'.repeat(3000));
    assert.equal(decodeURIComponent(target.split('q=')[1].split('&')[0]).length, 2000);
  });
});
