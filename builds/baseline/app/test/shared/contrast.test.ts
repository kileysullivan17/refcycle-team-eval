import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { PUBLIC_DIR } from '../../src/shared/paths.ts';
import { allCss, contrast, tokens } from '../helpers/css.ts';

const blocks = await allCss();
const t = tokens(blocks);
const px = (v: string) => Number(/^(\d+(?:\.\d+)?)px$/.exec(t[v.replace(/^var\((.*)\)$/, '$1')] ?? v)?.[1] ?? NaN);

describe('contrast rule (CONTRACTS 11, approved 2026-11-05)', () => {
  it('has the six final color values', () => {
    assert.equal(t['--color-blue'], '#4468a1');
    assert.equal(t['--color-ink'], '#17212c');
    assert.equal(t['--color-gold'], '#ffd809');
    assert.equal(t['--color-red'], '#ff2d35');
    assert.equal(t['--color-sand'], '#f0e2c3');
    assert.equal(t['--color-white'], '#ffffff');
  });

  it('red card label is ink, at least 19px and bold 700, so large text at 3:1 or better', () => {
    assert.ok(contrast(t['--color-ink'], t['--color-red']) >= 3);
    const size = px(t['--type-card-red-size'] === 'var(--type-h2-size)' ? t['--type-h2-size'] : t['--type-card-red-size']);
    assert.ok(size >= 19, `size ${size}`);
    assert.ok(Number(t['--type-card-red-weight']) >= 700);
  });

  it('nothing inside the red card overrides its size, weight or color', () => {
    const red = blocks.filter((b) => /verdict-card--red/.test(b.selector));
    assert.ok(red.length > 0);
    for (const b of red) {
      for (const d of b.decls) {
        assert.ok(!['font-size', 'font-weight', 'font'].includes(d.prop), `${b.selector} sets ${d.prop}`);
        if (d.prop === 'color') assert.equal(d.value, 'var(--color-ink)');
      }
    }
    const label = blocks.find((b) => b.selector === '.verdict-label')!;
    assert.equal(label.decls.find((d) => d.prop === 'font-size')?.value, 'var(--type-card-red-size)');
    assert.equal(label.decls.find((d) => d.prop === 'font-weight')?.value, 'var(--type-card-red-weight)');
    // Any other rule that targets a descendant of a card must not touch size or weight.
    for (const b of blocks.filter((x) => /verdict-card[^,{]*\s+\S/.test(x.selector) && x.selector !== '.verdict-card .icon')) {
      assert.ok(!b.decls.some((d) => d.prop === 'font-size' || d.prop === 'font-weight'), b.selector);
    }
  });

  it('ships a real MuseoModerno 700 file, not a synthesized bold', async () => {
    const css = (await import('node:fs/promises')).readFile(path.join(PUBLIC_DIR, 'shared', 'fonts.css'), 'utf8');
    const text = await css;
    const re = /font-family:\s*'MuseoModerno';\s*font-weight:\s*700;[^}]*url\('([^']+)'\)/g;
    const files = [...text.matchAll(re)].map((m) => m[1]);
    assert.ok(files.length >= 1);
    for (const f of files) await access(path.join(PUBLIC_DIR, f));
  });

  it('cards and body text meet 4.5:1 where they are not large text', () => {
    assert.ok(contrast(t['--color-white'], t['--color-blue']) >= 4.5, 'white on blue');
    assert.ok(contrast(t['--color-ink'], t['--color-gold']) >= 4.5, 'ink on gold');
    assert.ok(contrast(t['--color-ink'], t['--color-white']) >= 4.5, 'ink on white');
    assert.ok(contrast(t['--color-ink'], t['--color-sand']) >= 4.5, 'ink on sand');
  });

  it('sets text and links in ink on every Wheatfield box and never uses San Marino as a text color', () => {
    const sand = blocks.filter((b) => b.decls.some((d) => (d.prop === 'background' || d.prop === 'background-color') && d.value === 'var(--color-sand)'));
    assert.ok(sand.length > 0);
    for (const b of sand) assert.equal(b.decls.find((d) => d.prop === 'color')?.value, 'var(--color-ink)', `${b.selector} needs ink text`);
    assert.ok(blocks.some((b) => b.selector === '.on-sand a' && b.decls.some((d) => d.prop === 'color' && d.value === 'var(--color-ink)')), '.on-sand a must be ink');
    for (const b of blocks.filter((x) => x.file !== 'tokens.css')) {
      for (const d of b.decls) if (d.prop === 'color') assert.notEqual(d.value, 'var(--color-blue)', `${b.selector} uses blue text`);
    }
  });
});
