import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from './fixtures.ts';
import type { Answer } from '../../../engine/code/src/contract.ts';
import { byTestId, click, findAll, installFakeDom, loadClient, submit, tick, typeInto, until, FakeElement } from './fake-dom.ts';

type AskArgs = { place: string; query: string; signal?: AbortSignal };
type Result = { ok: true; answer: Answer } | { ok: false; reason: string };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function harness(opts: {
  path?: string;
  query?: Record<string, string>;
  ask?: (a: AskArgs) => Promise<Result>;
  where?: (a: { place: string; ruleIds: string[] }) => Promise<string[] | null>;
  catalog?: () => Promise<any>;
  place?: string;
} = {}) {
  const env = installFakeDom(opts.path ?? '/item');
  const { displayText } = await loadClient('shared/display-text.js');
  const item = await loadClient('shared/item.js');
  const titles: string[] = [];
  const nav: string[] = [];
  const asks: AskArgs[] = [];
  const wheres: { place: string; ruleIds: string[] }[] = [];
  let listeners: ((id: string) => void)[] = [];
  const state = { place: opts.place ?? 'seattle_wa' };
  const ctx = {
    get place() {
      return state.place;
    },
    places: [],
    displayText,
    navigate: (p: string) => void nav.push(p),
    setTitle: (t: string) => void titles.push(t),
    onPlaceChange: (cb: (id: string) => void) => {
      listeners.push(cb);
      return () => void (listeners = listeners.filter((l) => l !== cb));
    },
  };
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);
  const deps = {
    askEngine: async (a: AskArgs) => {
      asks.push(a);
      return (opts.ask ?? (async () => ({ ok: true, answer: FIXTURES.recycle }) as Result))(a);
    },
    fetchWhere: async (a: { place: string; ruleIds: string[] }) => {
      wheres.push(a);
      return opts.where ? opts.where(a) : null;
    },
    loadCatalog: opts.catalog ?? (async () => ({ entries: [{ id: 'plastic-2', name: 'Plastic #2 HDPE', query: 'Plastic #2 HDPE', category: 'plastic' }], categories: [] })),
  };
  const cleanup = item.mount({ path: '/item', params: {}, query: opts.query ?? { q: 'milk jug', origin: 'search' } }, container, ctx, deps);
  const page = () => container.children[0];
  const dataState = () => page()?.getAttribute('data-state');
  return {
    env, container, titles, nav, asks, wheres, cleanup: cleanup as () => void, page, dataState, state,
    changePlace(id: string) {
      state.place = id;
      listeners.forEach((l) => l(id));
    },
    async settled() {
      await until(() => !['loading'].includes(dataState() ?? 'loading'));
    },
  };
}

const answerOf = (a: Answer): (() => Promise<Result>) => async () => ({ ok: true, answer: a });
const links = (root: FakeElement) => findAll(root, (n) => n.tagName === 'a');
const hasCard = (root: FakeElement) => !!byTestId(root, 'verdict-card');
const labelOf = (root: FakeElement) => byTestId(root, 'verdict-card')!.textContent;

test('card states: blue for recycle, compost and deposit; yellow for garbage; red for special drop-off (X-10, RC-5)', async () => {
  const cases: [Answer, string, string][] = [
    [FIXTURES.recycle, 'card-blue', 'Recycling'],
    [FIXTURES.compost, 'card-blue', 'Compost'],
    [FIXTURES.deposit, 'card-blue', 'Deposit return'],
    [FIXTURES.garbage, 'card-yellow', 'Garbage'],
    [FIXTURES.special, 'card-red', 'Special drop-off'],
  ];
  for (const [answer, state, label] of cases) {
    const h = await harness({ ask: answerOf(answer) });
    try {
      await h.settled();
      assert.equal(h.dataState(), state, answer.stream!);
      assert.ok(byTestId(h.container, 'verdict-card')!.className.split(' ').includes(state));
      assert.equal(labelOf(h.container as any), label);
      assert.equal(findAll(h.container, (n) => n.className.split(' ').includes('card')).length, 1);
    } finally {
      h.env.restore();
    }
  }
});

test('the same stream gives the same card whatever the item: the card follows the engine, not the catalog (RC-5)', async () => {
  for (const query of ['Plastic #2 HDPE', 'Paint', 'something typed']) {
    const h = await harness({ query: { q: query, origin: 'search' }, ask: answerOf(FIXTURES.garbage) });
    try {
      await h.settled();
      assert.equal(h.dataState(), 'card-yellow');
    } finally {
      h.env.restore();
    }
  }
});

test('clarify, conditional, abstain, loading and error show no card and no stream verdict (X-6, X-10)', async () => {
  const pending = deferred<Result>();
  const loading = await harness({ ask: () => pending.promise });
  try {
    assert.equal(loading.dataState(), 'loading');
    assert.equal(hasCard(loading.container as any), false);
    assert.equal(byTestId(loading.container, 'loading-query')!.textContent, 'milk jug');
    assert.ok(findAll(loading.container, (n) => n.getAttribute('role') === 'status').length === 1, 'spinner');
  } finally {
    loading.env.restore();
  }
  const states: [Result, string][] = [
    [{ ok: true, answer: FIXTURES.clarify }, 'referee-check-clarify'],
    [{ ok: true, answer: FIXTURES.conditional }, 'referee-check-conditional'],
    [{ ok: true, answer: FIXTURES.abstain }, 'referee-check-abstain'],
    [{ ok: false, reason: 'http' }, 'error'],
  ];
  for (const [result, state] of states) {
    const h = await harness({ ask: async () => result });
    try {
      await h.settled();
      assert.equal(h.dataState(), state);
      assert.equal(hasCard(h.container as any), false);
      assert.equal(findAll(h.container, (n) => /\bcard(-|\s|$)/.test(n.className)).length, 0);
      assert.equal(findAll(h.container, (n) => n.hasAttribute('data-stream') && n.className.includes('card')).length, 0);
    } finally {
      h.env.restore();
    }
  }
});

test('conditional lists every case with its if text and stream label, and picks none (RC-7)', async () => {
  const h = await harness({ ask: answerOf(FIXTURES.conditional) });
  try {
    await h.settled();
    const cases = findAll(byTestId(h.container, 'cases')!, (n) => n.className === 'case');
    assert.equal(cases.length, FIXTURES.conditional.conditions!.length);
    assert.deepEqual(
      cases.map((c) => c.textContent),
      ['It is a bottle with a deposit mark' + 'Deposit return', 'It is a tub or cup' + 'Recycling'],
    );
    assert.equal(findAll(h.container, (n) => n.hasAttribute('aria-checked') || n.hasAttribute('selected')).length, 0);
  } finally {
    h.env.restore();
  }
});

test('conditional with three cases lists three', async () => {
  const three = { ...FIXTURES.conditional, conditions: [...FIXTURES.conditional.conditions!, { if: 'It is broken', stream: 'garbage' as const }] };
  const h = await harness({ ask: answerOf(three) });
  try {
    await h.settled();
    assert.equal(findAll(byTestId(h.container, 'cases')!, (n) => n.className === 'case').length, 3);
  } finally {
    h.env.restore();
  }
});

test('clarify: the question, a reply box and Send; the reply goes out as original query, a space and the reply (G20)', async () => {
  const answers: Answer[] = [FIXTURES.clarify, FIXTURES.clarify, FIXTURES.recycle];
  const h = await harness({ query: { q: 'plastic thing', origin: 'search' }, ask: async () => ({ ok: true, answer: answers.shift()! }) });
  try {
    await h.settled();
    assert.equal(byTestId(h.container, 'clarify-question')!.textContent, 'Is it a bottle or a tub?');
    assert.equal(h.titles.at(-1), 'plastic thing', 'title falls back to the query as sent');
    const input = byTestId(h.container, 'clarify-input')!;
    const form = findAll(h.container, (n) => n.tagName === 'form')[0];
    submit(form); // empty reply sends nothing
    assert.equal(h.asks.length, 1);
    typeInto(input, '  a bottle ');
    submit(form);
    assert.equal(h.asks.length, 2);
    assert.equal(h.asks[1].query, 'plastic thing a bottle');
    await until(() => h.dataState() === 'referee-check-clarify' && h.asks.length === 2);
    await tick(5);
    typeInto(byTestId(h.container, 'clarify-input')!, 'clear');
    submit(findAll(h.container, (n) => n.tagName === 'form')[0]);
    assert.equal(h.asks[2].query, 'plastic thing a bottle clear', 'the engine keeps no state, so the query carries the earlier reply');
    await until(() => h.dataState() === 'card-blue');
    assert.equal(h.asks.every((a) => a.place === 'seattle_wa'), true);
  } finally {
    h.env.restore();
  }
});

test('abstain says "We don\'t know" with the official source link, and nothing else about a verdict (X-4, RC-4)', async () => {
  const h = await harness({ ask: answerOf(FIXTURES.abstain) });
  try {
    await h.settled();
    assert.equal(byTestId(h.container, 'abstain-message')!.textContent, "We don't know");
    const a = links(byTestId(h.container, 'sources')!);
    assert.deepEqual(a.map((x) => x.getAttribute('href')), FIXTURES.abstain.source_urls);
    assert.equal(h.wheres.length, 0, 'no sites lookup without cited rules');
    assert.equal(byTestId(h.container, 'dispose'), null);
  } finally {
    h.env.restore();
  }
});

test('error shows "No answer available right now" and Retry and nothing else; Retry asks again (X-7)', async () => {
  let n = 0;
  const h = await harness({ ask: async () => (++n === 1 ? { ok: false, reason: 'network' } : { ok: true, answer: FIXTURES.garbage }) });
  try {
    await h.settled();
    assert.equal(h.dataState(), 'error');
    assert.equal(h.page().textContent, 'No answer available right nowRetry');
    assert.equal(findAll(h.container, (n) => n.tagName === 'a').length, 0);
    click(byTestId(h.container, 'retry')!);
    assert.equal(h.dataState(), 'loading');
    await until(() => h.dataState() === 'card-yellow');
    assert.equal(h.asks.length, 2);
    assert.equal(h.asks[1].query, 'milk jug');
  } finally {
    h.env.restore();
  }
});

test('title is item_interpreted after displayText, or the query as sent when null (X-11, G14)', async () => {
  const withCounty: Answer = { ...FIXTURES.recycle, item_interpreted: 'Bottle at County of Hawaiʻi site' };
  const a = await harness({ ask: answerOf(withCounty) });
  try {
    await a.settled();
    assert.equal(a.titles.at(-1), 'Bottle at Hawaiʻi County site');
  } finally {
    a.env.restore();
  }
  const b = await harness({ query: { q: 'what is this', origin: 'scan' }, ask: answerOf(FIXTURES.abstain) });
  try {
    await b.settled();
    assert.equal(b.titles.at(-1), 'what is this');
  } finally {
    b.env.restore();
  }
  const c = await harness({ ask: answerOf(FIXTURES.recycle) });
  try {
    await c.settled();
    assert.equal(c.titles.at(-1), 'Plastic bottle');
  } finally {
    c.env.restore();
  }
});

test('Dispose: red card, blue card only for deposit return, conditional with a drop-off or deposit case (CONTRACTS 8, G19)', async () => {
  const shows: [Answer, boolean][] = [
    [FIXTURES.special, true],
    [FIXTURES.deposit, true],
    [FIXTURES.conditional, true],
    [FIXTURES.recycle, false],
    [FIXTURES.compost, false],
    [FIXTURES.garbage, false],
    [FIXTURES.conditionalPlain, false],
    [FIXTURES.clarify, false],
    [FIXTURES.abstain, false],
  ];
  for (const [answer, want] of shows) {
    const h = await harness({ query: { q: 'old paint & oil', origin: 'search' }, ask: answerOf(answer) });
    try {
      await h.settled();
      const dispose = byTestId(h.container, 'dispose');
      assert.equal(!!dispose, want, `${answer.behavior} ${answer.stream}`);
      if (dispose) {
        assert.equal(dispose.textContent, 'Dispose');
        const href = dispose.getAttribute('href')!;
        assert.ok(href.startsWith('/locations?item='));
        const url = new URL(href, 'http://x');
        assert.equal(url.pathname, '/locations');
        assert.equal(url.searchParams.get('item'), 'old paint & oil');
        assert.equal(url.searchParams.get('rule_ids'), answer.rule_ids.join(','));
        assert.deepEqual([...url.searchParams.keys()], ['item', 'rule_ids']);
      }
      assert.ok(!/upcycle/i.test(h.container.textContent));
    } finally {
      h.env.restore();
    }
  }
});

test('where text of the cited rules is shown through displayText; any failure hides only that block (G5)', async () => {
  const withWhere = await harness({
    ask: answerOf(FIXTURES.special),
    where: async () => ['Take it to the County of Hawaiʻi transfer station', 'Taken by Big Island Biodiesel'],
  });
  try {
    await withWhere.settled();
    await until(() => !byTestId(withWhere.container, 'where')!.hidden);
    assert.deepEqual(withWhere.wheres, [{ place: 'seattle_wa', ruleIds: FIXTURES.special.rule_ids, signal: withWhere.wheres[0] && (withWhere.wheres[0] as any).signal }]);
    assert.equal(byTestId(withWhere.container, 'where')!.textContent, 'WhereTake it to the Hawaiʻi County transfer stationTaken by a local biodiesel company');
  } finally {
    withWhere.env.restore();
  }
  for (const failing of [null, [] as string[]]) {
    const h = await harness({ ask: answerOf(FIXTURES.special), where: async () => failing });
    try {
      await h.settled();
      await tick(10);
      assert.equal(byTestId(h.container, 'where')!.hidden, true);
      assert.ok(byTestId(h.container, 'verdict-card'));
      assert.ok(byTestId(h.container, 'explanation'));
      assert.ok(byTestId(h.container, 'sources'));
    } finally {
      h.env.restore();
    }
  }
});

test('where is requested for answer and conditional only', async () => {
  for (const [answer, want] of [[FIXTURES.recycle, 1], [FIXTURES.conditional, 1], [FIXTURES.clarify, 0], [FIXTURES.abstain, 0]] as [Answer, number][]) {
    const h = await harness({ ask: answerOf(answer) });
    try {
      await h.settled();
      await tick(5);
      assert.equal(h.wheres.length, want, answer.behavior);
    } finally {
      h.env.restore();
    }
  }
});

test('prep list, explanation and source links come from the engine, with only the swap applied (X-5)', async () => {
  const answer: Answer = {
    ...FIXTURES.countyText,
    explanation: 'hc-oil-015: Dated 2026-10-02; not a published page.\n“County of Hawaiʻi lists Big Island Biodiesel” Where: a site run by County of Hawai’i.\n\nhc-oil-016: second block',
  };
  const h = await harness({ ask: answerOf(answer) });
  try {
    await h.settled();
    assert.equal(
      byTestId(h.container, 'explanation')!.textContent,
      'hc-oil-015: Dated 2026-10-02; not a published page.\n“County of Hawaiʻi lists Big Island Biodiesel” Where: a site run by Hawaiʻi County.\n\nhc-oil-016: second block',
    );
    const prep = findAll(byTestId(h.container, 'prep')!, (n) => n.tagName === 'li').map((n) => n.textContent);
    assert.deepEqual(prep, ['Take it to a Hawaiʻi County site']);
    assert.deepEqual(links(byTestId(h.container, 'sources')!).map((a) => a.getAttribute('href')), answer.source_urls);
    assert.ok(links(byTestId(h.container, 'sources')!).every((a) => a.getAttribute('rel') === 'noopener noreferrer'));
    assert.ok(!h.container.textContent.includes('fake-model'), 'the model name is never shown');
  } finally {
    h.env.restore();
  }
});

test('engine text is inserted as text, never as markup', async () => {
  const hostile: Answer = {
    ...FIXTURES.recycle,
    item_interpreted: '<img src=x onerror=alert(1)>',
    prep: ['<b>bold</b>'],
    explanation: '<script>alert(1)</script> & <a href="javascript:alert(1)">x</a>',
    source_urls: ['javascript:alert(1)', 'https://example.org/ok'],
  };
  const h = await harness({ ask: answerOf(hostile) });
  try {
    await h.settled();
    assert.equal(findAll(h.container, (n) => ['img', 'script', 'b'].includes(n.tagName)).length, 0);
    assert.equal(byTestId(h.container, 'explanation')!.textContent, hostile.explanation);
    assert.deepEqual(links(h.container).map((a) => a.getAttribute('href')), ['https://example.org/ok'], 'a javascript: URL is not made a link');
  } finally {
    h.env.restore();
  }
});

test('no rendered state contains forbidden words or text of its own about disposal (X-10, RC-6, RC-8)', async () => {
  for (const [name, answer] of Object.entries(FIXTURES)) {
    const h = await harness({ ask: answerOf(answer as Answer), where: async () => ['Where text from the pack'] });
    try {
      await h.settled();
      await tick(5);
      const text = h.container.textContent;
      for (const bad of ['Score!', 'Hazardous', 'decompose', 'Percentage recycled', 'specialized facilities', 'Upcycle']) {
        assert.ok(!text.toLowerCase().includes(bad.toLowerCase()), `${name}: ${bad}`);
      }
    } finally {
      h.env.restore();
    }
  }
});

test('changing the place re-requests the answer on screen and drops the old response (X-9)', async () => {
  const first = deferred<Result>();
  const second = deferred<Result>();
  const pending = [first, second, deferred<Result>()];
  const h = await harness({ ask: () => pending.shift()!.promise });
  try {
    assert.equal(h.asks[0].place, 'seattle_wa');
    h.changePlace('austin_tx');
    assert.equal(h.asks.length, 2);
    assert.equal(h.asks[1].place, 'austin_tx');
    assert.equal(h.asks[1].query, 'milk jug');
    assert.equal(h.asks[0].signal!.aborted, true);
    first.resolve({ ok: true, answer: FIXTURES.garbage }); // the stale answer must not show
    await tick(5);
    assert.equal(h.dataState(), 'loading');
    second.resolve({ ok: true, answer: FIXTURES.compost });
    await until(() => h.dataState() === 'card-blue');
    // and an answer already on screen is replaced by a new request too
    h.changePlace('hawaii_county_hi');
    assert.equal(h.dataState(), 'loading');
    assert.equal(h.asks.length, 3);
    assert.equal(h.asks[2].place, 'hawaii_county_hi');
  } finally {
    h.env.restore();
  }
});

test('a late sites response after a place change is ignored', async () => {
  const slow = deferred<string[] | null>();
  let n = 0;
  const h = await harness({ ask: answerOf(FIXTURES.special), where: () => (++n === 1 ? slow.promise : Promise.resolve(null)) });
  try {
    await h.settled();
    h.changePlace('austin_tx');
    await until(() => h.asks.length === 2 && h.dataState() !== 'loading');
    slow.resolve(['stale where text']);
    await tick(5);
    assert.ok(!h.container.textContent.includes('stale where text'));
  } finally {
    h.env.restore();
  }
});

test('cleanup stops late results and place subscriptions', async () => {
  const late = deferred<Result>();
  const h = await harness({ ask: () => late.promise });
  try {
    h.cleanup();
    late.resolve({ ok: true, answer: FIXTURES.recycle });
    await tick(5);
    assert.equal(h.dataState(), 'loading');
    h.changePlace('austin_tx');
    assert.equal(h.asks.length, 1);
  } finally {
    h.env.restore();
  }
});

test('/item?entry=<id> sends the entry query; an unknown entry or failed catalog is the error state (RC-4)', async () => {
  const h = await harness({ query: { entry: 'plastic-2' } });
  try {
    await h.settled();
    assert.equal(h.asks[0].query, 'Plastic #2 HDPE');
    assert.equal(h.asks[0].place, 'seattle_wa');
  } finally {
    h.env.restore();
  }
  const unknown = await harness({ query: { entry: 'nope' } });
  try {
    await unknown.settled();
    assert.equal(unknown.dataState(), 'error');
    assert.equal(unknown.asks.length, 0);
  } finally {
    unknown.env.restore();
  }
  let calls = 0;
  const down = await harness({ query: { entry: 'plastic-2' }, catalog: async () => { if (++calls === 1) throw new Error('down'); return { entries: [{ id: 'plastic-2', query: 'Plastic #2 HDPE' }], categories: [] }; } });
  try {
    await down.settled();
    assert.equal(down.dataState(), 'error');
    click(byTestId(down.container, 'retry')!);
    await until(() => down.asks.length === 1);
    assert.equal(down.asks[0].query, 'Plastic #2 HDPE');
  } finally {
    down.env.restore();
  }
});

test('/item?q=<text>&origin=scan|search sends the text; with nothing to ask it goes back to the Recyclopedia', async () => {
  for (const origin of ['scan', 'search']) {
    const h = await harness({ query: { q: '  plastic milk jug ', origin } });
    try {
      await h.settled();
      assert.equal(h.asks[0].query, 'plastic milk jug');
    } finally {
      h.env.restore();
    }
  }
  const empty = await harness({ query: { q: '   ' } });
  try {
    assert.deepEqual(empty.nav, ['/recyclopedia']);
    assert.equal(empty.asks.length, 0);
  } finally {
    empty.env.restore();
  }
});
