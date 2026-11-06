import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { allByClass, byTestId, click, findAll, installFakeDom, loadClient, submit, typeInto, until } from '../shared/fake-dom.ts';

const catalog = JSON.parse(await readFile(resolve(import.meta.dirname, '../../data/catalog.json'), 'utf8'));
const loadCatalog = async () => structuredClone(catalog);

function fixture(path: string, query: Record<string, string> = {}, params: Record<string, string> = {}, deps: Record<string, unknown> = {}) {
  const env = installFakeDom(path);
  const titles: string[] = [];
  const nav: string[] = [];
  const ctx = {
    place: 'seattle_wa',
    places: [],
    displayText: (t: string) => t,
    navigate: (p: string) => void nav.push(p),
    setTitle: (t: string) => void titles.push(t),
    onPlaceChange: () => () => undefined,
  };
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);
  return { env, titles, nav, ctx, container, route: { path: path.split('?')[0], params, query }, deps: { loadCatalog, ...deps } };
}

async function mountScreen(f: ReturnType<typeof fixture>) {
  const screens = await loadClient('features/recyclopedia/screens.js');
  const cleanup = screens.mount(f.route, f.container, f.ctx, f.deps);
  await until(() => !f.container.textContent.includes('Loading'));
  return cleanup as (() => void) | undefined;
}

test('landing: ten plain category cards in the Figma order, each linking to its material page (RC-1, G18)', async () => {
  const f = fixture('/recyclopedia');
  try {
    await mountScreen(f);
    const cards = findAll(f.container, (n) => n.className === 'category-card');
    assert.deepEqual(cards.map((c) => c.textContent), ['Batteries', 'Biodegradable', 'Electronics', 'Glass', 'Metal', 'Paper', 'Plastic', 'Rubber', 'Wood', 'Miscellaneous']);
    assert.deepEqual(cards.map((c) => c.getAttribute('href')), catalog.categories.map((c: any) => '/recyclopedia/' + c.id));
    for (const c of cards) assert.equal(c.childNodes.length, 1, 'a card holds only its name'); // plain, no photograph or icon
    assert.equal(findAll(f.container, (n) => n.tagName === 'img').length, 0, 'no photographs');
    assert.equal(f.titles.at(-1), 'Recyclopedia');
  } finally {
    f.env.restore();
  }
});

test('material page lists only its category entries and each opens /item?entry=<id> (RC-2, RC-4)', async () => {
  for (const cat of catalog.categories) {
    const f = fixture('/recyclopedia/' + cat.id, {}, { categoryId: cat.id });
    try {
      await mountScreen(f);
      const rows = findAll(byTestId(f.container, 'category-entries')!, (n) => n.tagName === 'a');
      const want = catalog.entries.filter((e: any) => e.category === cat.id);
      assert.deepEqual(rows.map((r) => r.textContent), want.map((e: any) => e.name), cat.id);
      assert.deepEqual(rows.map((r) => r.getAttribute('href')), want.map((e: any) => '/item?entry=' + e.id));
      assert.equal(f.titles.at(-1), cat.name);
    } finally {
      f.env.restore();
    }
  }
});

test('typing "plastic" lists exactly the entries whose name contains plastic, case-insensitive: 13 (RC-3)', async () => {
  const f = fixture('/recyclopedia');
  try {
    await mountScreen(f);
    const input = byTestId(f.container, 'search-input')!;
    const want = catalog.entries.filter((e: any) => e.name.toLowerCase().includes('plastic')).map((e: any) => e.name);
    assert.equal(want.length, 13);
    assert.ok(want.includes('Wax, plastic or foil coated paper'));
    for (const typed of ['plastic', 'Plastic', 'PLASTIC', '  plastic  ']) {
      typeInto(input, typed);
      const rows = findAll(byTestId(f.container, 'results')!, (n) => n.className === 'entry-row');
      assert.deepEqual(rows.map((r) => findAll(r, (n) => n.className === 'entry-name')[0].textContent), want, typed);
      assert.equal(byTestId(f.container, 'results')!.hidden, false);
      assert.equal(findAll(f.container, (n) => n.className === 'browse')[0].hidden, true);
    }
    typeInto(input, '');
    assert.equal(findAll(f.container, (n) => n.className === 'browse')[0].hidden, false);
    assert.equal(byTestId(f.container, 'results')!.hidden, true);
  } finally {
    f.env.restore();
  }
});

test('search is a substring match on the name only', async () => {
  const f = fixture('/recyclopedia');
  try {
    await mountScreen(f);
    const input = byTestId(f.container, 'search-input')!;
    typeInto(input, 'bottle');
    const names = findAll(byTestId(f.container, 'results')!, (n) => n.className === 'entry-name').map((n) => n.textContent);
    assert.deepEqual(names, catalog.entries.filter((e: any) => e.name.toLowerCase().includes('bottle')).map((e: any) => e.name));
    typeInto(input, 'sea-plastic-009'); // a rule id is not a name
    assert.equal(findAll(byTestId(f.container, 'results')!, (n) => n.className === 'entry-row').length, 0);
  } finally {
    f.env.restore();
  }
});

test('text that matches no entry opens the item page with that text as the query (RC-9)', async () => {
  const f = fixture('/recyclopedia');
  try {
    await mountScreen(f);
    const input = byTestId(f.container, 'search-input')!;
    typeInto(input, '  old garden hose & nozzle  ');
    assert.equal(findAll(f.container, (n) => n.getAttribute('data-testid') === 'ask-link').length, 1);
    submit(findAll(f.container, (n) => n.tagName === 'form')[0]);
    assert.deepEqual(f.nav, ['/item?q=old%20garden%20hose%20%26%20nozzle&origin=search']);
  } finally {
    f.env.restore();
  }
});

test('submitting text that matches entries shows the search page, an empty box does nothing', async () => {
  const f = fixture('/recyclopedia');
  try {
    await mountScreen(f);
    const form = findAll(f.container, (n) => n.tagName === 'form')[0];
    submit(form);
    assert.deepEqual(f.nav, []);
    typeInto(byTestId(f.container, 'search-input')!, 'glass');
    submit(form);
    assert.deepEqual(f.nav, ['/search?q=glass']);
  } finally {
    f.env.restore();
  }
});

test('/search?q= is prefilled and filters live; a match-less q offers the free question', async () => {
  const f = fixture('/search?q=glass', { q: 'glass' });
  try {
    await mountScreen(f);
    assert.equal(byTestId(f.container, 'search-input')!.value, 'glass');
    const names = findAll(byTestId(f.container, 'results')!, (n) => n.className === 'entry-name').map((n) => n.textContent);
    assert.deepEqual(names, ['Glass bottles and jars']);
    assert.equal(f.titles.at(-1), 'Search');
  } finally {
    f.env.restore();
  }
  const g = fixture('/search?q=zzzz', { q: 'zzzz' });
  try {
    await mountScreen(g);
    assert.equal(byTestId(g.container, 'ask-link')!.getAttribute('href'), '/item?q=zzzz&origin=search');
  } finally {
    g.env.restore();
  }
});

test('search on a material page covers the whole catalog (RC-3)', async () => {
  const f = fixture('/recyclopedia/glass', {}, { categoryId: 'glass' });
  try {
    await mountScreen(f);
    typeInto(byTestId(f.container, 'search-input')!, 'tires');
    assert.deepEqual(findAll(byTestId(f.container, 'results')!, (n) => n.className === 'entry-name').map((n) => n.textContent), ['Tires']);
  } finally {
    f.env.restore();
  }
});

test('an unknown category and a failed catalog load say so; Retry loads again', async () => {
  const f = fixture('/recyclopedia/textiles', {}, { categoryId: 'textiles' });
  try {
    await mountScreen(f);
    assert.ok(byTestId(f.container, 'no-category'));
  } finally {
    f.env.restore();
  }
  let calls = 0;
  const g = fixture('/recyclopedia', {}, {}, { loadCatalog: async () => { calls += 1; if (calls === 1) throw new Error('down'); return structuredClone(catalog); } });
  try {
    await mountScreen(g);
    assert.ok(byTestId(g.container, 'catalog-error'));
    click(findAll(g.container, (n) => n.tagName === 'button')[0]);
    await until(() => allByClass(g.container, 'category-card').length === 10);
    assert.equal(calls, 2);
  } finally {
    g.env.restore();
  }
});

test('the catalog client reads /api/catalog, orders categories, retries after a failure', async () => {
  const mod = await loadClient('shared/catalog.js');
  mod.resetCatalogCache();
  const shuffled = { ...catalog, categories: [...catalog.categories].reverse() };
  let n = 0;
  const fetchFn = async (url: string) => {
    n += 1;
    assert.equal(url, '/api/catalog');
    return n === 1 ? { status: 500, json: async () => ({}) } : { status: 200, json: async () => structuredClone(shuffled) };
  };
  await assert.rejects(mod.loadCatalog(fetchFn));
  const got = await mod.loadCatalog(fetchFn);
  assert.deepEqual(got.categories.map((c: any) => c.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  await mod.loadCatalog(fetchFn);
  assert.equal(n, 2, 'cached after success');
  mod.resetCatalogCache();
});
