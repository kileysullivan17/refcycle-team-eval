import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, relative, resolve } from 'node:path';
import { PUBLIC, files, read } from './css.ts';

// Scans only code the shell and the Recyclopedia own; vendored code is skipped (builders' common rule 5).
const APP = resolve(PUBLIC, '..');
async function ownClient() {
  return [
    join(PUBLIC, 'index.html'),
    ...(await files(join(PUBLIC, 'shared'), /\.(js|html|css)$/)),
    ...(await files(join(PUBLIC, 'features/recyclopedia'), /\.(js|html|css)$/)),
  ];
}
async function ownServer() {
  return [join(APP, 'src/server.ts'), ...(await files(join(APP, 'src/shared'), /\.ts$/)), ...(await files(join(APP, 'src/features/recyclopedia'), /\.ts$/))];
}
const rel = (p: string) => relative(APP, p);

test('no client file uses innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or Function (X-5, acceptance 16)', async () => {
  const bad = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new\s+Function|setTimeout\s*\(\s*['"`])/;
  for (const file of (await ownClient()).filter((f) => /\.(js|html)$/.test(f))) {
    assert.ok(!bad.test(await read(file)), rel(file));
  }
});

test('no device location is used: no geolocation anywhere in the client', async () => {
  for (const file of await ownClient()) assert.ok(!/geolocation|getCurrentPosition|watchPosition/i.test(await read(file)), rel(file));
});

test('the client talks only to the app: relative /api paths, no absolute URLs', async () => {
  for (const file of (await ownClient()).filter((f) => f.endsWith('.js'))) {
    const src = await read(file);
    const urls = [...src.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
    assert.deepEqual(urls.filter((u) => u !== 'http://www.w3.org/2000/svg'), [], rel(file));
    for (const m of src.matchAll(/\bfetch\(\s*([^,)]*)/g)) assert.ok(/^(['"`]\/api\/|url|doFetch|prefixed)/.test(m[1].trim()) || m[1].trim() === '', `${rel(file)}: fetch(${m[1]})`);
    assert.ok(!/XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/.test(src), rel(file));
  }
  const html = await read(join(PUBLIC, 'index.html'));
  assert.deepEqual([...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)], []);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'no inline script');
  assert.ok(!/<style/i.test(html) && !/\sstyle=/i.test(html), 'no inline style');
});

test('the server makes no network call except the engine', async () => {
  for (const file of await ownServer()) {
    const src = await read(file);
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|net\.connect|dgram/.test(src), rel(file));
  }
  const forward = await read(join(APP, 'src/shared/forward.ts'));
  assert.ok(forward.includes('engineUrl'), 'forwarding goes to the configured engine only');
  const server = await read(join(APP, 'src/server.ts'));
  assert.ok(!/node:https?'.*request/.test(server));
});

test('the app imports from engine/code only loadEnv (and, later, loadPacks and the Pack and Rule types)', async () => {
  for (const file of await ownServer()) {
    for (const m of (await read(file)).matchAll(/from '([^']*engine\/code[^']*)'/g)) {
      assert.ok(/engine\/code\/src\/(config|rules)\.ts$/.test(m[1]), `${rel(file)} imports ${m[1]}`);
    }
  }
});

test('no forbidden words or static disposal text in client files or the catalog (X-10, RC-6, RC-8)', async () => {
  const words = ['Score!', 'Hazardous', 'decompose', 'Percentage recycled', 'specialized facilities', 'Upcycle'];
  const targets = [...(await ownClient()), join(APP, 'data/catalog.json')];
  for (const file of targets) {
    const src = (await read(file)).toLowerCase();
    for (const w of words) assert.ok(!src.includes(w.toLowerCase()), `${rel(file)}: ${w}`);
  }
});

test('the withheld business name appears only in the swap function (X-2, G13)', async () => {
  const hits: string[] = [];
  for (const file of [...(await ownClient()), ...(await ownServer()), join(APP, 'data/catalog.json')]) {
    if ((await read(file)).includes('Big Island Biodiesel')) hits.push(rel(file));
  }
  assert.deepEqual(hits, ['public/shared/display-text.js']);
});

test('every engine, pack or catalog string goes through displayText in the item page', async () => {
  const src = await read(join(PUBLIC, 'shared/item.js'));
  for (const field of ['item_interpreted', 'clarifying_question', 'explanation']) {
    assert.match(src, new RegExp(`t\\(answer\\.${field}`), field);
  }
  assert.match(src, /t\(c\.if,/);
  assert.match(src, /list\('plain-list', answer\.prep/);
});

test('no em dashes in any file this builder owns', async () => {
  const roots = [
    join(APP, 'src/server.ts'), join(APP, 'src/shared'), join(APP, 'src/features/recyclopedia'), join(APP, 'data/catalog.json'),
    join(PUBLIC, 'index.html'), join(PUBLIC, 'shared'), join(PUBLIC, 'features/recyclopedia'),
    join(APP, 'test/shared'), join(APP, 'test/recyclopedia'), join(APP, 'docs/recyclopedia.md'), join(APP, 'README.md'),
  ];
  const { stat } = await import('node:fs/promises');
  for (const root of roots) {
    let list: string[];
    try {
      list = (await stat(root)).isDirectory() ? await files(root, /\.(js|ts|css|html|json|md|txt)$/) : [root];
    } catch {
      continue; // not written yet
    }
    for (const file of list) assert.ok(!(await read(file)).includes(String.fromCharCode(0x2014)), rel(file));
  }
});
