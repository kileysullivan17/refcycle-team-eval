import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { loadPacks } from '../../../engine/code/src/rules.ts';
import { createAppServer } from '../../src/server.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const PLACE_OF: Record<string, string> = { SEA: 'seattle_wa', ATX: 'austin_tx', HC: 'hawaii_county_hi' };

type Entry = { id: string; category: string; name: string; query: string; rule_ids: string[]; covered_in: string[] };
type Catalog = { categories: { id: string; name: string; order: number }[]; entries: Entry[] };

/** The approved tables, read from CONTRACTS.md sections 5.2 and 5.3 (read-only). */
async function approved() {
  const text = await readFile(resolve(ROOT, 'orchestrator/CONTRACTS.md'), 'utf8');
  const rows = (section: string) =>
    section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('|---')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const cats = rows(text.split('### 5.2 Categories')[1].split('### 5.3')[0]).filter((r) => /^\d+$/.test(r[0]));
  const ents = rows(text.split('### 5.3 Entries')[1].split('## 6.')[0]).filter((r) => r[0] !== 'Category');
  return {
    categories: cats.map((r) => ({ id: r[1], name: r[2], order: Number(r[0]) })),
    entries: ents.map((r): Entry => ({
      id: r[1],
      category: r[0],
      name: r[2],
      query: r[2],
      rule_ids: r[3].split(', '),
      covered_in: r[4].split(', ').map((c) => PLACE_OF[c]),
    })),
  };
}

const servers: { close(cb: () => void): void }[] = [];
after(() => Promise.all(servers.map((s) => new Promise<void>((r) => s.close(r)))));

async function getCatalog(): Promise<Catalog> {
  const server = await createAppServer({ engineUrl: 'http://127.0.0.1:1', features: ['recyclopedia'] });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/catalog`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  return res.json() as Promise<Catalog>;
}

test('GET /api/catalog returns the 10 categories of CONTRACTS 5.2 in order, no Textiles', async () => {
  const { categories } = await getCatalog();
  const want = (await approved()).categories;
  assert.equal(want.length, 10);
  assert.deepEqual(categories, want);
  assert.ok(!categories.some((c) => /textile/i.test(c.name)));
});

test('GET /api/catalog returns the 50 entries of CONTRACTS 5.3, field for field', async () => {
  const { entries } = await getCatalog();
  const want = (await approved()).entries;
  assert.equal(want.length, 50);
  assert.equal(entries.length, 50);
  assert.deepEqual(entries, want);
});

test('every query equals name, ids are unique and every entry has a known category', async () => {
  const { categories, entries } = await getCatalog();
  assert.ok(entries.every((e) => e.query === e.name));
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  const ids = new Set(categories.map((c) => c.id));
  assert.ok(entries.every((e) => ids.has(e.category)));
  assert.ok(categories.every((c) => entries.some((e) => e.category === c.id)), 'no empty category card');
});

test('the catalog file is the approved one and the endpoint serves only GET', async () => {
  const file = JSON.parse(await readFile(resolve(ROOT, 'app/data/catalog.json'), 'utf8'));
  assert.deepEqual(file, await getCatalog());
  const server = await createAppServer({ engineUrl: 'http://127.0.0.1:1', features: ['recyclopedia'] });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/catalog`, { method: 'POST', body: '{}' });
  assert.equal(res.status, 404);
});

test('invariants against the real packs: rule ids resolve and the coverage lists match the packs', async () => {
  const packs = await loadPacks(resolve(ROOT, 'engine/rules'));
  const placeOfRule = new Map<string, string>();
  for (const [id, pack] of packs) for (const r of pack.rules) placeOfRule.set(r.id, id);
  const { entries } = await getCatalog();
  for (const e of entries) {
    for (const r of e.rule_ids) assert.ok(placeOfRule.has(r), `${e.id}: ${r} is not in any pack`);
    const places = [...new Set(e.rule_ids.map((r) => placeOfRule.get(r)!))].sort();
    assert.deepEqual([...e.covered_in].sort(), places, `${e.id}: covered_in`);
  }
  // every pack rule maps to an entry, except the curbside service rule (CONTRACTS 5.3)
  const mapped = new Set(entries.flatMap((e) => e.rule_ids));
  const unmapped = [...placeOfRule.keys()].filter((id) => !mapped.has(id));
  assert.deepEqual(unmapped.filter((id) => id !== 'hc-system-000'), []);
});
