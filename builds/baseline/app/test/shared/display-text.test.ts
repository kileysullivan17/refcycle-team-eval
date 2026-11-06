import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClient } from '../helpers/client.ts';

const m = await loadClient('shared/display-text.js');

describe('displayText (X-2, G12, G13)', () => {
  it('swaps every spelling of the county name', () => {
    for (const spelling of ['County of Hawaiʻi', 'County of Hawai‘i', 'County of Hawai’i', "County of Hawai'i", 'County of Hawai`i', 'County of Hawaii']) {
      assert.equal(m.swapText(`${spelling}, HI`).text, 'Hawaiʻi County, HI', spelling);
    }
  });

  it('leaves quoted source lines as written and changes nothing else', () => {
    const s = 'hc-1: “The County of Hawai`i does not collect.” Where: County of Hawaii stations';
    const out = m.swapText(s).text;
    assert.equal(out, 'hc-1: “The County of Hawai`i does not collect.” Where: Hawaiʻi County stations');
  });

  it('replaces the business name outside quoted lines only', () => {
    assert.equal(m.swapText('Where: Big Island Biodiesel accepts oil').text, 'Where: a local biodiesel company accepts oil');
    assert.equal(m.swapText('“Big Island Biodiesel”').text, '“Big Island Biodiesel”');
  });

  it('does not touch other words or the apostrophe elsewhere', () => {
    const s = 'Hawaiʻi is not the county of Hawaii here, and Big Island is fine';
    assert.equal(m.swapText(s).text, s);
  });

  it('reports each distinct replacement with a count through the sink, and never throws from it', () => {
    const seen: any[] = [];
    m.setSwapSink((r: any) => seen.push(r));
    const out = m.displayText('County of Hawaii and County of Hawaii and Big Island Biodiesel', 'item.title');
    assert.equal(out, 'Hawaiʻi County and Hawaiʻi County and a local biodiesel company');
    assert.deepEqual(seen.map((r) => [r.surface, r.from, r.to, r.count]), [
      ['item.title', 'County of Hawaii', 'Hawaiʻi County', 2],
      ['item.title', 'Big Island Biodiesel', 'a local biodiesel company', 1],
    ]);
    seen.length = 0;
    m.displayText('nothing to swap', 'x');
    assert.equal(seen.length, 0);
    m.setSwapSink(() => {
      throw new Error('log failed');
    });
    assert.equal(m.displayText('County of Hawaii', 'x'), 'Hawaiʻi County');
    m.setSwapSink(null);
  });

  it('handles null and non-strings', () => {
    assert.equal(m.swapText(null).text, '');
    assert.equal(m.swapText(12).text, '12');
  });
});
