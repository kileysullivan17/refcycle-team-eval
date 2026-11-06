import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { answer } from '../helpers/fake-engine.ts';
import { loadClient } from '../helpers/client.ts';

const m = await loadClient('shared/item-model.js');
const a = (over: object) => answer('seattle_wa', over);

describe('stateFor (X-10, CONTRACTS 8)', () => {
  it('maps streams to card colors', () => {
    assert.equal(m.stateFor(a({ stream: 'recycle_bin' })), 'card-blue');
    assert.equal(m.stateFor(a({ stream: 'compost_bin' })), 'card-blue');
    assert.equal(m.stateFor(a({ stream: 'deposit_return' })), 'card-blue');
    assert.equal(m.stateFor(a({ stream: 'garbage' })), 'card-yellow');
    assert.equal(m.stateFor(a({ stream: 'drop_off_special' })), 'card-red');
  });
  it('shows no card for clarify, conditional and abstain (X-6)', () => {
    assert.equal(m.stateFor(a({ behavior: 'clarify', stream: null, clarifying_question: 'q?' })), 'referee-check-clarify');
    assert.equal(m.stateFor(a({ behavior: 'conditional', stream: null, conditions: [{ if: 'x', stream: 'garbage' }, { if: 'y', stream: 'recycle_bin' }] })), 'referee-check-conditional');
    assert.equal(m.stateFor(a({ behavior: 'abstain', stream: null, rule_ids: [] })), 'referee-check-abstain');
  });
});

describe('validateAnswer (X-7)', () => {
  it('accepts well-formed answers of each behavior', () => {
    assert.ok(m.validateAnswer(a({})));
    assert.ok(m.validateAnswer(a({ behavior: 'abstain', stream: null, item_interpreted: null, rule_ids: [] })));
    assert.ok(m.validateAnswer(a({ behavior: 'clarify', stream: null, clarifying_question: 'Which?' })));
  });
  it('rejects anything that would force a guess', () => {
    assert.equal(m.validateAnswer(null), null);
    assert.equal(m.validateAnswer({ error: 'x' }), null);
    assert.equal(m.validateAnswer(a({ behavior: 'answer', stream: null })), null);
    assert.equal(m.validateAnswer(a({ behavior: 'answer', stream: 'bogus' })), null);
    assert.equal(m.validateAnswer(a({ behavior: 'abstain', stream: 'garbage' })), null);
    assert.equal(m.validateAnswer(a({ behavior: 'conditional', stream: null, conditions: null })), null);
    assert.equal(m.validateAnswer(a({ behavior: 'clarify', stream: null, clarifying_question: null })), null);
    assert.equal(m.validateAnswer(a({ behavior: 'surprise' })), null);
    assert.equal(m.validateAnswer(a({ prep: 'x' })), null);
  });
});

describe('Dispose (CON-2, G19)', () => {
  const cond = (streams: string[]) => a({ behavior: 'conditional', stream: null, conditions: streams.map((s, i) => ({ if: `case ${i}`, stream: s })) });
  it('shows on red, on deposit return, and on conditionals with a special or deposit case only', () => {
    assert.equal(m.showDispose(a({ stream: 'drop_off_special' })), true);
    assert.equal(m.showDispose(a({ stream: 'deposit_return' })), true);
    assert.equal(m.showDispose(a({ stream: 'recycle_bin' })), false);
    assert.equal(m.showDispose(a({ stream: 'garbage' })), false);
    assert.equal(m.showDispose(cond(['garbage', 'drop_off_special'])), true);
    assert.equal(m.showDispose(cond(['garbage', 'recycle_bin'])), false);
    assert.equal(m.showDispose(a({ behavior: 'abstain', stream: null })), false);
    assert.equal(m.showDispose(a({ behavior: 'clarify', stream: null, clarifying_question: 'q' })), false);
  });
  it('builds /locations?item=&rule_ids= and carries conditional cases', () => {
    const href = m.disposeHref('car tires', a({ stream: 'drop_off_special', rule_ids: ['r-1', 'r-2'] }));
    const u = new URL(href, 'http://x');
    assert.equal(u.pathname, '/locations');
    assert.equal(u.searchParams.get('item'), 'car tires');
    assert.equal(u.searchParams.get('rule_ids'), 'r-1,r-2');
    assert.equal(u.searchParams.getAll('case').length, 0);
    const c = new URL(m.disposeHref('oil', cond(['garbage', 'drop_off_special'])), 'http://x');
    assert.deepEqual(c.searchParams.getAll('case'), ['garbage|case 0', 'drop_off_special|case 1']);
  });
});

describe('clarify (G20) and title (G14)', () => {
  it('joins the query sent so far, a space and the reply', () => {
    assert.equal(m.clarifyQuery('plastic bottle', ' HI-5 '), 'plastic bottle HI-5');
    assert.equal(m.clarifyQuery('plastic bottle HI-5', 'yes'), 'plastic bottle HI-5 yes');
  });
  it('refuses an empty reply or one that would pass 2000 characters', () => {
    assert.equal(m.clarifyQuery('x', '   '), null);
    assert.equal(m.clarifyQuery('x'.repeat(1990), 'y'.repeat(20)), null);
  });
  it('titles with item_interpreted, else the query as sent', () => {
    assert.equal(m.titleFor(a({ item_interpreted: 'Milk jug' }), 'q'), 'Milk jug');
    assert.equal(m.titleFor(a({ item_interpreted: null }), 'the query'), 'the query');
  });
  it('labels every stream and never says Score or Hazardous', () => {
    assert.deepEqual(Object.values(m.STREAM_LABELS), ['Recycling', 'Compost', 'Garbage', 'Special drop-off', 'Deposit return']);
    assert.ok(!/score|hazardous/i.test(Object.values(m.STREAM_LABELS).join(' ')));
  });
});
