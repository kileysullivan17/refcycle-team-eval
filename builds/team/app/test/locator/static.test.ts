// Source scans and style rules for code the locator owns. vendor/ is skipped (Leaflet 1.9.4 as shipped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const app = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string) => readFileSync(join(app, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'vendor' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const owned = [
  ...walk(join(app, 'src/features/locator')),
  ...walk(join(app, 'public/features/locator')),
  ...walk(join(app, 'test/locator')),
  join(app, 'docs/locator.md'),
].filter((f) => /\.(ts|js|css|html|md)$/.test(f) );

test('no em dashes in any file the locator owns', () => {
  for (const f of owned) {
    try {
      assert.ok(!readFileSync(f, 'utf8').includes('\u2014'), f); // Orchestrator edit O1: escape, not the literal character
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw e;
    }
  }
});

const SCREENS = read('public/features/locator/screens.js');
const CODE = [SCREENS, read('src/features/locator/sites.ts'), read('src/features/locator/routes.ts')];

test('no device location, no HTML insertion, no code evaluation', () => {
  for (const src of CODE) {
    assert.ok(!/geolocation|getCurrentPosition|watchPosition/i.test(src));
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(src));
  }
});

test('LOC-10, LOC-14: no ratings, review counts, distances or geocoders in code', () => {
  for (const src of CODE) {
    assert.ok(!/\b(rating|ratings|review_count|reviews|distance|geocod\w*|nominatim|places api)\b/i.test(src));
  }
});

test('the only external URLs in code are the OpenStreetMap tile and copyright URLs', () => {
  const approved = new Set(['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://www.openstreetmap.org/copyright']);
  for (const src of CODE) {
    const urls = src.match(/https?:\/\/[^\s'"`)<>]+/g) ?? [];
    for (const u of urls) assert.ok(approved.has(u), `unapproved URL ${u}`);
  }
});

test('the client only fetches /api/sites', () => {
  const calls = [...SCREENS.matchAll(/getJson\(\s*([`'"])([^`'"]*)\1/g)].map((m) => m[2]);
  assert.ok(calls.length > 0);
  for (const c of calls) assert.ok(c.startsWith('/api/sites'), c);
  assert.ok(!/\bfetch\(/.test(SCREENS.replace(/async function getJson[\s\S]*?\n}\n/, '')), 'fetch only inside getJson');
});

test('every pack, CSV and engine string goes through displayText', () => {
  // A record field is read either inside this.t(...) (which calls ctx.displayText) or only to decide something.
  const field = /\b(?:f|r|site|rule|o|official|detail|all)\.(?:name|notes|address|where|source_label|date_checked|materials|applies_to)\b/;
  const lines = SCREENS.split('\n').filter((l) => !l.trim().startsWith('//') && field.test(l));
  assert.ok(lines.length > 5);
  for (const l of lines) {
    assert.ok(/this\.t\(|\.filter\(|\.some\(|\.includes\(|\.length|if \(|\.flatMap\(|\.slice\(|\.forEach|for \(|^\s*const /.test(l), `raw field on screen: ${l.trim()}`);
  }
  assert.ok(/this\.ctx\.displayText\(/.test(SCREENS));
});

// ---------- styles (CONTRACTS 11, brief 6b rule 6) ----------

const CSS = read('public/features/locator/locator.css');
const TOKENS = read('src/features/locator/dev/tokens.css');

type Decl = { selector: string; prop: string; value: string };
function declarations(css: string): Decl[] {
  const out: Decl[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      out.push({ selector, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() });
    }
  }
  return out;
}
const DECLS = declarations(CSS);

test('styles: no literal colors; colors, fonts and radii go through tokens', () => {
  assert.ok(DECLS.length > 20);
  for (const d of DECLS) {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d.value), `${d.selector} ${d.prop}`);
    if (/^(color|background|background-color|border-color)$/.test(d.prop)) assert.match(d.value, /^var\(--color-[a-z]+\)$/, `${d.selector} ${d.prop}`);
    if (d.prop === 'font-family') assert.match(d.value, /^var\(--font-(text|display)\)$/);
    if (d.prop === 'border-radius') assert.match(d.value, /^(0|var\(--radius-control\))$/);
    if (d.prop === 'font-size') assert.match(d.value, /^var\(--type-[a-z0-9-]+-size\)$/, `${d.selector}`);
    if (d.prop === 'font-weight') assert.match(d.value, /^(var\(--type-[a-z0-9-]+-weight\)|[1-9]00)$/);
  }
});

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ' ' && depth === 0) {
      if (cur) parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

const SPACING = /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;
function spaceOk(part: string): boolean {
  if (part === '0' || part === 'auto') return true;
  if (part === 'var(--space-unit)') return true;
  let m = /^calc\(var\(--space-unit\) \* (\d+(?:\.\d+)?)\)$/.exec(part);
  if (m) return (Number(m[1]) * 8) % 4 === 0;
  m = /^calc\(var\(--space-unit\) \/ (\d+(?:\.\d+)?)\)$/.exec(part);
  if (m) return (8 / Number(m[1])) % 4 === 0;
  return false;
}
test('styles: spacing is a multiple of 4px written through --space-unit; px only for borders and element sizes', () => {
  for (const d of DECLS) {
    if (SPACING.test(d.prop)) {
      const parts = splitTopLevel(d.value);
      for (const p of parts) assert.ok(spaceOk(p), `${d.selector} ${d.prop}: ${p}`);
    }
    if (/\d+px/.test(d.value)) {
      assert.match(d.prop, /^(border(-[a-z]+)*|outline(-[a-z]+)*|width|height|min-width|min-height|max-width|max-height|flex|flex-basis)$/, `${d.selector} ${d.prop} uses px`);
    }
  }
});

test('styles: every token used is defined in the dev harness copy', () => {
  const used = new Set([...CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const name of used) assert.ok(new RegExp(`${name}:`).test(TOKENS), `${name} missing in dev/tokens.css`);
});

test('styles: sand boxes and the page set text and links in ink, never San Marino', () => {
  const sand = DECLS.filter((d) => /^background(-color)?$/.test(d.prop) && d.value === 'var(--color-sand)').map((d) => d.selector);
  assert.ok(sand.length > 0);
  for (const sel of sand) {
    const own = DECLS.filter((d) => d.selector === sel && d.prop === 'color');
    assert.ok(own.length === 1 && own[0].value === 'var(--color-ink)', `${sel} sets ink text`);
    for (const d of DECLS.filter((x) => x.selector.startsWith(`${sel} a`) && x.prop === 'color')) assert.equal(d.value, 'var(--color-ink)', d.selector);
  }
  for (const d of DECLS.filter((x) => /(^|[ ,])\.loc a\b/.test(x.selector) && x.prop === 'color')) assert.equal(d.value, 'var(--color-ink)', d.selector);
  // nothing in a sand box is blue: buttons inside callouts override to ink
  for (const d of DECLS.filter((x) => x.selector.startsWith('.loc-callout ') && /color/.test(x.prop))) assert.ok(!/blue/.test(d.value), d.selector);
});

test('styles: layout holds from 320 px to 430 px (fluid, wraps, no fixed widths)', () => {
  for (const d of DECLS) {
    if (d.prop === 'width' || d.prop === 'min-width') assert.ok(!/^\d+px$/.test(d.value) || Number(d.value.slice(0, -2)) <= 320, `${d.selector} width ${d.value}`);
  }
  assert.match(CSS, /overflow-wrap:\s*anywhere/);
  assert.match(CSS, /flex-wrap:\s*wrap/);
});
