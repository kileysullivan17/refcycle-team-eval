import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClient } from '../helpers/client.ts';

const m = await loadClient('features/camera-scan/capture.js');

describe('capture helpers', () => {
  it('scales down to the longest side and never up', () => {
    assert.deepEqual(m.fitSize(4000, 3000, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(m.fitSize(800, 600, 1600), { width: 800, height: 600 });
    assert.deepEqual(m.fitSize(0, 0), { width: 0, height: 0 });
  });
  it('measures a data URL in decoded bytes', () => {
    assert.equal(m.dataUrlBytes('data:image/png;base64,' + Buffer.alloc(10).toString('base64')), 10);
    assert.equal(m.dataUrlBytes('nope'), 0);
  });
  it('accepts only JPEG, PNG and WebP', () => {
    assert.equal(m.isAcceptedType('image/webp'), true);
    assert.equal(m.isAcceptedType('image/gif'), false);
    assert.equal(m.ACCEPT, 'image/jpeg,image/png,image/webp');
  });
  it('cleans a typed label and builds the item hand-off', () => {
    assert.equal(m.cleanLabel('  milk   jug '), 'milk jug');
    assert.equal(m.cleanLabel('   '), null);
    assert.equal(m.itemHref('milk jug'), '/item?q=milk%20jug&origin=scan');
  });
});
