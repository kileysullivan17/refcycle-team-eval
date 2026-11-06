import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const cssPath = path.join(root, 'public/features/camera-scan/screens.css');
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const TOKENS = new Set([
  '--color-blue', '--color-ink', '--color-gold', '--color-red', '--color-sand', '--color-white',
  '--font-text', '--font-display', '--radius-control', '--space-unit', '--icon-max',
  ...['h1', 'h2', 'h3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption', 'card-red'].flatMap((s) => [`--type-${s}-size`, `--type-${s}-weight`]),
]);

interface Rule { selector: string; decls: Array<[string, string]> }
function rules(): Rule[] {
  const out: Rule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith('@')) continue;
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as [string, string];
    });
    out.push({ selector, decls });
  }
  return out;
}
const R = rules();
const all = R.flatMap((r) => r.decls.map(([p, v]) => ({ selector: r.selector, p, v })));

test('the stylesheet has rules and every var() is a contract token', () => {
  assert.ok(all.length > 50);
  for (const m of css.matchAll(/var\((--[\w-]+)/g)) assert.ok(TOKENS.has(m[1]), m[1]);
});

test('no literal colors: color properties use tokens only', () => {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css));
  assert.ok(!/\b(?:rgb|rgba|hsl|hsla)\(/.test(css));
  for (const { p, v, selector } of all) {
    if (['color', 'background', 'background-color', 'border-color'].includes(p)) {
      assert.match(v, /^(var\(--color-[a-z]+\)|transparent|currentColor|inherit)$/, `${selector} ${p}`);
    }
    if (p === 'border' || p === 'outline') assert.ok(!/#|rgb|\b(black|white|red|blue|gray|grey)\b/i.test(v.replace(/var\([^)]*\)/g, '')), `${selector} ${p}`);
  }
});

test('font family, font size, radius go through tokens', () => {
  for (const { p, v, selector } of all) {
    if (p === 'font-family') assert.match(v, /^var\(--font-(text|display)\)$/, selector);
    if (p === 'font-size') assert.match(v, /^var\(--type-[a-z0-9-]+-size\)$/, selector);
    if (p === 'font-weight') assert.match(v, /^(var\(--type-[a-z0-9-]+-weight\)|[1-9]00)$/, selector);
    if (p === 'border-radius') assert.match(v, /^var\(--radius-control\)$/, selector);
  }
  assert.ok(!/\bfont:/.test(css));
});

function evalSpace(term: string): number | null {
  if (term === '0') return 0;
  if (term === 'auto') return 0;
  if (!term.includes('var(--space-unit)')) return null;
  const expr = term.replace(/var\(--space-unit\)/g, '8').replace(/^calc/, '');
  if (!/^[\d\s.+\-*/()]+$/.test(expr)) return null;
  return Function(`return (${expr})`)() as number;
}
test('spacing (margin, padding, gap, inset) is a multiple of 4px written through --space-unit', () => {
  const props = /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-(top|right|bottom|left))?$/;
  let checked = 0;
  for (const { p, v, selector } of all) {
    if (!props.test(p)) continue;
    const terms = v.match(/calc\((?:[^()]|\([^()]*\))*\)|var\(--space-unit\)|\S+/g) ?? [];
    for (const t of terms) {
      const n = evalSpace(t);
      assert.notEqual(n, null, `${selector} ${p}: ${t}`);
      assert.equal(n! % 4, 0, `${selector} ${p}: ${t}`);
      checked++;
    }
  }
  assert.ok(checked > 10);
});

test('px appears only in border and outline widths, offsets and element sizes', () => {
  const okProps = /^(border(-[a-z]+)*|outline|outline-offset|width|height|min-width|min-height|max-width|max-height)$/;
  for (const { p, v, selector } of all) {
    if (/\d+px\b/.test(v)) assert.match(p, okProps, `${selector} ${p}: ${v}`);
  }
});

test('no San Marino text, and Wheatfield boxes set ink text', () => {
  for (const { p, v, selector } of all) {
    if (p === 'color') assert.notEqual(v, 'var(--color-blue)', selector);
  }
  for (const r of R) {
    const bg = r.decls.find(([p]) => p === 'background' || p === 'background-color');
    if (bg && bg[1] === 'var(--color-sand)') {
      const color = r.decls.find(([p]) => p === 'color');
      assert.ok(color && color[1] === 'var(--color-ink)', r.selector);
    }
  }
  assert.ok(!/a\s*[{:,]|\blink\b/.test(css.replace(/\.cs-link-btn/g, '')));
});

test('layout works from 320 px to 430 px: fluid width, wrapping controls, no fixed widths over 320', () => {
  for (const { p, v, selector } of all) {
    if (p === 'width' || p === 'min-width') {
      const px = /^(\d+)px$/.exec(v);
      if (px) assert.ok(Number(px[1]) <= 320, `${selector} ${p}`);
    }
  }
  assert.match(css, /\.cs-scan,\s*\.cs-confirm\s*\{[^}]*max-width:\s*430px/);
  assert.match(css, /\.cs-controls\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.cs-actions\s*\{[^}]*flex-wrap:\s*wrap/);
});

function ownFiles(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'vendor' || n === 'node_modules') continue;
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) ownFiles(f, out); else out.push(f);
  }
  return out;
}
const mine = [
  ...ownFiles(path.join(root, 'src/features/camera-scan')),
  ...ownFiles(path.join(root, 'public/features/camera-scan')),
  ...ownFiles(path.join(root, 'test/camera-scan')),
];

test('source scan: no em dashes in any file this slice owns', () => {
  for (const f of [...mine, path.join(root, 'docs/camera-scan.md')]) {
    try { assert.ok(!readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), f); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
});

test('source scan: no browser storage, no ask-endpoint call, no outside URLs, no stream or disposal text in the screens', () => {
  const screens = readFileSync(path.join(root, 'public/features/camera-scan/screens.js'), 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|caches\b|cacheStorage/.test(screens));
  assert.ok(!/api\/ask/.test(screens));
  const apiCalls = [...screens.matchAll(/['"`](\/api\/[\w/-]*)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(apiCalls)], ['/api/identify']);
  const urls = [...screens.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
  assert.deepEqual(urls, ['http://www.w3.org/2000/svg']);
  assert.ok(!/recycle_bin|compost_bin|drop_off_special|deposit_return|garbage|disposal|recyclable/i.test(screens));
  assert.ok(!/<link[^>]+href=["']https?:|@import|url\(/i.test(css));
  for (const f of mine.filter((x) => /camera-scan\/(src|public)|src\/features|public\/features/.test(x) && !x.includes('/test/'))) {
    const t = readFileSync(f, 'utf8');
    if (f.endsWith('.ts') || f.endsWith('.js')) assert.ok(!/api\/ask/.test(t), f);
  }
});

test('source scan: no image bytes are written to disk (server code writes only the identify log)', () => {
  for (const f of mine.filter((x) => x.includes('src/features/camera-scan') && x.endsWith('.ts'))) {
    const t = readFileSync(f, 'utf8');
    assert.ok(!/writeFile|createWriteStream|copyFile|rename\(/.test(t), f);
    if (/appendFile/.test(t)) assert.ok(f.endsWith('routes.ts'), f);
  }
});
