import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { allCss, publicFiles, type Block } from '../helpers/css.ts';

const blocks = (await allCss()).filter((b) => b.file !== 'tokens.css' && !b.selector.startsWith('@font-face'));
const decls = (props: RegExp) => blocks.flatMap((b) => b.decls.filter((d) => props.test(d.prop)).map((d) => ({ ...d, selector: b.selector, file: b.file })));

describe('styles go through the tokens (CONTRACTS 11)', () => {
  it('uses no literal colors', () => {
    for (const b of blocks) for (const d of b.decls) {
      assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d.value), `${b.selector} { ${d.prop}: ${d.value} }`);
      if (/^(color|background|background-color|border-color|outline-color|fill|stroke)$/.test(d.prop)) {
        assert.ok(/^(var\(--color-[a-z]+\)|transparent|inherit|currentColor|none)$/.test(d.value), `${b.selector} { ${d.prop}: ${d.value} }`);
      }
    }
  });
  it('sets font families only from the font tokens', () => {
    for (const d of decls(/^font-family$/)) assert.ok(/^(var\(--font-(text|display)\)|inherit)$/.test(d.value), `${d.selector}: ${d.value}`);
  });
  it('sets font sizes only from var(--type-<style>-size)', () => {
    const found = decls(/^font-size$/);
    assert.ok(found.length > 10);
    for (const d of found) assert.ok(/^(var\(--type-[a-z0-9-]+-size\)|inherit)$/.test(d.value), `${d.selector}: ${d.value}`);
  });
  it('sets radii only from the radius token (or none, or a circle)', () => {
    for (const d of decls(/^border-radius$/)) assert.ok(/^(var\(--radius-control\)|0|50%)$/.test(d.value), `${d.selector}: ${d.value}`);
  });
  it('writes margin, padding, gap and inset as multiples of 4px through --space-unit', () => {
    const spacing = decls(/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-[a-z]+)?$/);
    assert.ok(spacing.length > 20);
    for (const d of spacing) {
      let rest = d.value;
      for (const m of rest.matchAll(/calc\(var\(--space-unit\)\s*([*/])\s*([0-9.]+)\)/g)) {
        const factor = m[1] === '*' ? Number(m[2]) : 1 / Number(m[2]);
        assert.ok(Number.isInteger(factor * 2), `${d.selector}: ${d.value} is not a multiple of half a unit`);
      }
      rest = rest.replace(/calc\(var\(--space-unit\)\s*[*/]\s*[0-9.]+\)/g, '').replace(/var\(--space-unit\)/g, '');
      assert.ok(/^[\s]*((0|auto)[\s]*)*$/.test(rest), `${d.selector} { ${d.prop}: ${d.value} } has a literal spacing value`);
    }
  });
  it('limits icons to --icon-max', () => {
    const icon = blocks.find((b) => b.selector === '.icon')!;
    assert.equal(icon.decls.find((d) => d.prop === 'width')?.value, 'var(--icon-max)');
    assert.equal(icon.decls.find((d) => d.prop === 'height')?.value, 'var(--icon-max)');
  });
});

describe('source scans (vendor/ is skipped)', () => {
  it('never inserts strings as HTML in client code', async () => {
    for (const f of await publicFiles(['.js'])) {
      const text = await readFile(f, 'utf8');
      assert.ok(!/\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new Function)\b/.test(text), f);
    }
  });
  it('loads nothing from outside the app except OpenStreetMap tiles and its copyright page', async () => {
    const allowed = [/^https:\/\/tile\.openstreetmap\.org\b/, /^https:\/\/www\.openstreetmap\.org\/copyright$/, /^http:\/\/www\.w3\.org\/2000\/svg$/ /* SVG namespace, not a request */];
    for (const f of await publicFiles(['.js', '.css', '.html'])) {
      const text = await readFile(f, 'utf8');
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) assert.ok(allowed.some((re) => re.test(m[0])), `${f}: ${m[0]}`);
    }
  });
  it('has no hardcoded stream, rule or place content in client code', async () => {
    for (const f of await publicFiles(['.js'])) {
      const text = await readFile(f, 'utf8');
      assert.ok(!/(sea|atx|hc)-[a-z]+-\d{3}/.test(text), `${f} names a rule id`);
    }
  });
  it('has no em dashes in any app file', async () => {
    for (const f of await publicFiles(['.js', '.css', '.html'])) assert.ok(!(await readFile(f, 'utf8')).includes(String.fromCharCode(0x2014)), f);
  });
});
