import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { loadPacks } from '../../../engine/code/src/rules.ts';
import { CatalogSchema, loadCatalog } from '../../src/features/recyclopedia/catalog.ts';
import { createHandle } from '../../src/features/recyclopedia/routes.ts';
import { DATA_DIR, REPO_DIR, RULES_DIR } from '../../src/shared/paths.ts';
import { startApp, type TestApp } from '../helpers/app.ts';

const CATALOG = path.join(DATA_DIR, 'catalog.json');

describe('catalog.json', () => {
  it('matches the approved table in CONTRACTS section 5 (50 entries, 10 categories)', async () => {
    const md = await readFile(path.join(REPO_DIR, 'orchestrator', 'CONTRACTS.md'), 'utf8');
    const section = md.split('### 5.3 Entries')[1].split('## 6.')[0];
    const rows = section.split('\n').filter((l) => /^\| \w+ \| [\w-]+ \| /.test(l) && !l.startsWith('| Category'));
    const catalog = await loadCatalog(CATALOG);
    assert.equal(catalog.entries.length, rows.length);
    assert.equal(catalog.categories.length, 10);
    for (const row of rows) {
      const [, category, id, name, rules] = row.split('|').map((s) => s.trim());
      const e = catalog.entries.find((x) => x.id === id);
      assert.ok(e, `missing entry ${id}`);
      assert.equal(e.category, category);
      assert.equal(e.name, name);
      assert.equal(e.query, name);
      assert.deepEqual(e.rule_ids, rules.split(', '));
    }
  });

  it('maps only to rules that exist, and covered_in lists the places holding a mapped rule', async () => {
    const catalog = await loadCatalog(CATALOG);
    const packs = await loadPacks(RULES_DIR);
    for (const e of catalog.entries) {
      const places = new Set<string>();
      for (const id of e.rule_ids) {
        const owners = [...packs].filter(([, p]) => p.rules.some((r) => r.id === id));
        assert.equal(owners.length, 1, `${e.id}: rule ${id}`);
        places.add(owners[0][0]);
      }
      assert.deepEqual([...places].sort(), [...e.covered_in].sort(), e.id);
    }
  });

  it('rejects an entry whose query differs from its name', () => {
    const bad = { categories: [{ id: 'a', name: 'A', order: 1 }], entries: [{ id: 'e', category: 'a', name: 'N', query: 'M', rule_ids: [], covered_in: [] }] };
    assert.equal(CatalogSchema.safeParse(bad).success, false);
  });
});

describe('GET /api/catalog', () => {
  let app: TestApp;
  before(async () => {
    app = await startApp({ modules: [{ handle: createHandle(CATALOG) }] });
  });
  after(() => app.close());
  it('serves categories in order plus entries', async () => {
    const body = (await (await fetch(`${app.url}/api/catalog`)).json()) as { categories: Array<{ order: number }>; entries: unknown[] };
    assert.deepEqual(body.categories.map((c) => c.order), [...body.categories.map((c) => c.order)].sort((a, b) => a - b));
    assert.ok(body.entries.length > 0);
  });
});
