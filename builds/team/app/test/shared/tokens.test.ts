import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC, parseCss, read, tokens } from './css.ts';

// CONTRACTS.md section 11, name and value.
const EXPECTED: Record<string, string> = {
  '--color-blue': '#4468A1',
  '--color-ink': '#17212C',
  '--color-gold': '#FFD809',
  '--color-red': '#FF2D35',
  '--color-sand': '#F0E2C3',
  '--color-white': '#FFFFFF',
  '--radius-control': '15px',
  '--space-unit': '8px',
  '--icon-max': '20px',
  '--type-h1-size': '28px',
  '--type-h1-weight': '300',
  '--type-h2-size': '22px',
  '--type-h2-weight': '400',
  '--type-h3-size': '20px',
  '--type-h3-weight': '400',
  '--type-headline-size': '17px',
  '--type-headline-weight': '600',
  '--type-body-size': '17px',
  '--type-body-weight': '400',
  '--type-callout-size': '16px',
  '--type-callout-weight': '400',
  '--type-subhead-size': '15px',
  '--type-subhead-weight': '400',
  '--type-footnote-size': '13px',
  '--type-footnote-weight': '400',
  '--type-caption-size': '11px',
  '--type-caption-weight': '400',
  '--type-card-red-size': 'var(--type-h2-size)',
  '--type-card-red-weight': '700',
};

test('tokens.css defines every CONTRACTS 11 token with its value', async () => {
  const t = await tokens();
  for (const [name, value] of Object.entries(EXPECTED)) {
    assert.ok(name in t, `${name} is defined`);
    assert.equal(t[name].toLowerCase(), value.toLowerCase(), name);
  }
  assert.match(t['--font-text'], /^"Outfit"/);
  assert.match(t['--font-display'], /^"MuseoModerno"/);
});

test('tokens are defined once', async () => {
  const css = await read(join(PUBLIC, 'shared/tokens.css'));
  const names = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length);
});

test('the red card label tokens resolve to at least 19px and weight 700', async () => {
  const t = await tokens();
  const size = t['--type-card-red-size'];
  const px = size.startsWith('var(') ? parseFloat(t[size.slice(4, -1)]) : parseFloat(size);
  assert.ok(px >= 19, `red label size ${px}`);
  assert.ok(Number(t['--type-card-red-weight']) >= 700);
});

test('Outfit and MuseoModerno are bundled; MuseoModerno has a real 700 face, not a synthesized bold', async () => {
  const faces = parseCss(await read(join(PUBLIC, 'shared/tokens.css'))).filter((r) => r.selector === '@font-face');
  const info = faces.map((f) => {
    const get = (p: string) => f.decls.find((d) => d.prop === p)?.value ?? '';
    const url = /url\("([^"]+)"\)/.exec(get('src'))?.[1] ?? '';
    return { family: get('font-family').replace(/"/g, ''), weight: get('font-weight'), url };
  });
  const museo = info.filter((f) => f.family === 'MuseoModerno');
  assert.ok(museo.some((f) => f.weight === '700'), 'MuseoModerno 700');
  assert.ok(museo.some((f) => f.weight === '400'), 'MuseoModerno 400');
  assert.equal(new Set(museo.map((f) => f.url)).size, museo.length, 'each weight has its own file');
  assert.ok(info.some((f) => f.family === 'Outfit'));
  for (const f of info) {
    assert.ok(f.url.startsWith('/shared/fonts/'), `${f.url} is served by the app`);
    const file = join(PUBLIC, f.url);
    assert.ok(existsSync(file), file);
    assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', `${f.url} is a woff2 file`);
  }
  // the 700 file is a different font file from the 400 file, so the bold is not the regular face
  const w400 = readFileSync(join(PUBLIC, museo.find((f) => f.weight === '400')!.url));
  const w700 = readFileSync(join(PUBLIC, museo.find((f) => f.weight === '700')!.url));
  assert.notDeepEqual(w400, w700);
});

test('nothing is loaded from outside the app: no remote url() or @import in any style', async () => {
  for (const name of ['tokens.css', 'app.css']) {
    const css = await read(join(PUBLIC, 'shared', name));
    assert.ok(!/https?:\/\//i.test(css), name);
    assert.ok(!/@import/i.test(css), name);
  }
});
