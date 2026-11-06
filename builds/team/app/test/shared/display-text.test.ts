import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createAppServer } from '../../src/server.ts';
import { loadClient } from './fake-dom.ts';

const TARGET = 'Hawaiʻi County';
const dt = await loadClient('shared/display-text.js');

type Entry = { surface: string; from: string; to: string; count: number };
function capture(): Entry[] {
  const log: Entry[] = [];
  dt.setSwapLogger((e: Entry) => void log.push(e));
  return log;
}

test('every spelling of the county name becomes "Hawaiʻi County" outside quotes (CONTRACTS 9, G12)', () => {
  for (const mark of ['ʻ', '‘', '’', "'", '`', '']) {
    const log = capture();
    const input = `County of Hawai${mark}i, HI`;
    assert.equal(dt.displayText(input, 's'), `${TARGET}, HI`, JSON.stringify(mark));
    assert.deepEqual(log, [{ surface: 's', from: `County of Hawai${mark}i`, to: TARGET, count: 1 }]);
  }
  dt.setSwapLogger(null);
});

test('the same text inside “ ” is unchanged, and text around it still swaps (G12)', () => {
  capture();
  for (const mark of ['ʻ', '‘', '’', "'", '`', '']) {
    const name = `County of Hawai${mark}i`;
    assert.equal(dt.displayText(`hc-1: “${name} accepts it” and ${name} says so`, 's'), `hc-1: “${name} accepts it” and ${TARGET} says so`);
    assert.equal(dt.displayText(`“${name}”`, 's'), `“${name}”`);
  }
  dt.setSwapLogger(null);
});

test('several quoted lines: only the text between “ and ” is protected', () => {
  capture();
  const text = 'A County of Hawaii “County of Hawaii” B County of Hawaii “x County of Hawaiʻi y” C County of Hawai`i';
  assert.equal(dt.displayText(text, 's'), `A ${TARGET} “County of Hawaii” B ${TARGET} “x County of Hawaiʻi y” C ${TARGET}`);
  // a quote that never closes leaves the rest as written
  assert.equal(dt.displayText('County of Hawaii “open County of Hawaii', 's'), `${TARGET} “open County of Hawaii`);
  dt.setSwapLogger(null);
});

test('"Big Island Biodiesel" becomes "a local biodiesel company" outside quoted lines only (G13)', () => {
  const log = capture();
  assert.equal(dt.displayText('Taken by Big Island Biodiesel.', 'where'), 'Taken by a local biodiesel company.');
  assert.deepEqual(log, [{ surface: 'where', from: 'Big Island Biodiesel', to: 'a local biodiesel company', count: 1 }]);
  log.length = 0;
  assert.equal(dt.displayText('“Big Island Biodiesel takes it” Big Island Biodiesel', 'where'), '“Big Island Biodiesel takes it” a local biodiesel company');
  assert.equal(log.length, 1);
  dt.setSwapLogger(null);
});

test('nothing else changes: other text, near misses, case and whitespace are returned as they came', () => {
  const log = capture();
  const same = [
    '',
    'Seattle, WA',
    'Hawaii County',
    'Hawaiʻi County, HI',
    'county of hawaii',
    'COUNTY OF HAWAII',
    'County of Maui',
    'County of  Hawaii',
    'Big Island Biodiese? big island biodiesel',
    '  leading and trailing  ',
    'line one\nline two\n\nline “three”',
    '<b>County</b> & "quotes" \'single\' ‘curly’',
  ];
  for (const text of same) assert.equal(dt.displayText(text, 's'), text);
  assert.equal(log.length, 0, 'no log line when nothing was replaced');
  dt.setSwapLogger(null);
});

test('the swap is applied to the pack name and nothing but the swap changes in a long engine string', () => {
  capture();
  const input = 'hc-oil-015: Field report dated 2026-10-02; not a published page. “Bring oil” Where: Big Island Biodiesel in County of Hawaiʻi, HI.\n\nhc-hhw-010: other';
  const want = 'hc-oil-015: Field report dated 2026-10-02; not a published page. “Bring oil” Where: a local biodiesel company in Hawaiʻi County, HI.\n\nhc-hhw-010: other';
  assert.equal(dt.displayText(input, 'item.explanation'), want);
  assert.equal(dt.displayText('County of Hawaiʻi, HI', 'place-picker.name'), 'Hawaiʻi County, HI');
  dt.setSwapLogger(null);
});

test('one log entry per distinct replacement, with its count; the logger cannot break display', () => {
  const log = capture();
  dt.displayText('County of Hawaii and County of Hawaii and County of Hawaiʻi and Big Island Biodiesel', 'item.explanation');
  assert.deepEqual(
    [...log].sort((a, b) => (a.from < b.from ? -1 : 1)),
    [
      { surface: 'item.explanation', from: 'Big Island Biodiesel', to: 'a local biodiesel company', count: 1 },
      { surface: 'item.explanation', from: 'County of Hawaii', to: TARGET, count: 2 },
      { surface: 'item.explanation', from: 'County of Hawai\u02BBi', to: TARGET, count: 1 },
    ],
  );
  dt.setSwapLogger(() => {
    throw new Error('logger down');
  });
  assert.equal(dt.displayText('County of Hawaii', 's'), TARGET);
  dt.setSwapLogger(null);
  assert.equal(dt.displayText('County of Hawaii', 's'), TARGET, 'no logger set');
  assert.equal(dt.displayText(undefined as unknown as string, 's'), '');
  assert.equal(dt.displayText(null as unknown as string, 's'), '');
});

const closers: (() => Promise<void> | void)[] = [];
after(async () => {
  for (const c of closers) await c();
});

test('each replacement writes one line to logs/display-swaps.jsonl through POST /api/log/display-swap (X-2)', async () => {
  const logsDir = await mkdtemp(join(tmpdir(), 'refcycle-swap-'));
  closers.push(() => rm(logsDir, { recursive: true, force: true }));
  const server = await createAppServer({ engineUrl: 'http://127.0.0.1:1', logsDir, features: [] });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  closers.push(() => new Promise<void>((r) => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // The same wiring the shell uses: the logger posts to the app, which appends a line.
  const posts: Promise<Response>[] = [];
  let place = 'hawaii_county_hi';
  dt.setSwapLogger((entry: Entry) => {
    posts.push(fetch(base + '/api/log/display-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...entry, place }) }));
  });
  dt.displayText('County of Hawaiʻi, HI', 'place-picker.name');
  dt.displayText('County of Hawaii', 'item.title');
  dt.displayText('“County of Hawaii” quoted only', 'item.explanation'); // no line
  dt.displayText('Taken by Big Island Biodiesel', 'item.where');
  place = 'seattle_wa';
  dt.displayText('County of Hawai`i', 'item.prep');
  dt.setSwapLogger(null);
  for (const r of await Promise.all(posts)) assert.equal(r.status, 204);

  const lines = (await readFile(join(logsDir, 'display-swaps.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 4);
  assert.deepEqual(
    lines.map((l) => [l.surface, l.from, l.to, l.count, l.place]).sort(),
    [
      ['item.prep', 'County of Hawai`i', TARGET, 1, 'seattle_wa'],
      ['item.title', 'County of Hawaii', TARGET, 1, 'hawaii_county_hi'],
      ['item.where', 'Big Island Biodiesel', 'a local biodiesel company', 1, 'hawaii_county_hi'],
      ['place-picker.name', 'County of Hawaiʻi', TARGET, 1, 'hawaii_county_hi'],
    ].sort(),
  );
  assert.ok(lines.every((l) => typeof l.timestamp === 'string' && !Number.isNaN(Date.parse(l.timestamp))));
});
