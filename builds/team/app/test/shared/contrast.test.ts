import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC, contrast, ownCss, parseCss, read, tokens, type Rule } from './css.ts';

const px = (t: Record<string, string>, value: string): number => {
  const v = value.startsWith('var(') ? t[value.slice(4, -1)] : value;
  return v.startsWith('var(') ? px(t, v) : parseFloat(v);
};
const hex = (t: Record<string, string>, value: string) => t[value.replace(/^var\((--[a-z-]+)\)$/, '$1')];

async function allRules(): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const file of await ownCss()) if (!file.endsWith('tokens.css')) rules.push(...parseCss(await read(file)));
  return rules;
}

// Parts of a selector, ignoring pseudo-classes. Returns { classes, tags } of the last compound plus ancestors.
function parts(selector: string) {
  return selector.split(/\s+/).map((s) => ({ classes: [...s.matchAll(/\.([a-z0-9_-]+)/gi)].map((m) => m[1]), tag: /^[a-z][a-z0-9]*/i.exec(s)?.[0] ?? null }));
}

/** The cascade for the red card label: `<section class="card card-red"><p class="card-label">`. */
function effective(rules: Rule[], prop: string, element: { classes: string[]; ancestors: string[][] }): string | null {
  let best: { value: string; spec: number; order: number } | null = null;
  rules.forEach((rule, order) => {
    for (const sel of rule.selector.split(',').map((s) => s.trim())) {
      const chain = parts(sel);
      const last = chain[chain.length - 1];
      if (!last.classes.every((c) => element.classes.includes(c))) continue;
      if (last.tag && last.tag !== 'p') continue;
      const ok = chain.slice(0, -1).every((anc) => anc.classes.every((c) => element.ancestors.some((a) => a.includes(c))));
      if (!ok) continue;
      const decl = rule.decls.find((d) => d.prop === prop);
      if (!decl) continue;
      const spec = chain.reduce((n, p) => n + p.classes.length * 10 + (p.tag ? 1 : 0), 0);
      if (!best || spec > best.spec || (spec === best.spec && order > best.order)) best = { value: decl.value, spec, order };
    }
  });
  return best ? (best as { value: string }).value : null;
}

test('the contract numbers hold: ink on Pelati Red is 4.40, white on red 3.70, San Marino on Wheatfield 4.38', async () => {
  const t = await tokens();
  const r2 = (n: number) => Math.round(n * 100) / 100;
  assert.equal(r2(contrast(t['--color-ink'], t['--color-red'])), 4.4);
  assert.equal(r2(contrast(t['--color-white'], t['--color-red'])), 3.7);
  assert.equal(r2(contrast(t['--color-blue'], t['--color-sand'])), 4.38);
});

test('red card text resolves to ink, weight 700 or more and 19px or more, with 3:1 contrast', async () => {
  const t = await tokens();
  const rules = await allRules();
  const label = { classes: ['card-label'], ancestors: [['card', 'card-red']] };
  const el = { classes: ['card-label'], ancestors: label.ancestors };
  const color = effective(rules, 'color', el) ?? effective(rules, 'color', { classes: [], ancestors: [] });
  assert.equal(color, 'var(--color-ink)');
  const size = effective(rules, 'font-size', el);
  assert.equal(size, 'var(--type-card-red-size)');
  assert.ok(px(t, size!) >= 19);
  const weight = effective(rules, 'font-weight', el);
  assert.equal(weight, 'var(--type-card-red-weight)');
  assert.ok(Number(t['--type-card-red-weight']) >= 700);
  assert.equal(effective(rules, 'font-family', el), 'var(--font-display)');
  assert.ok(contrast(hex(t, color!), t['--color-red']) >= 3);
  // the card itself is red with ink text
  const card = rules.filter((r) => r.selector === '.card-red');
  assert.equal(card.length, 1);
  assert.equal(card[0].decls.find((d) => d.prop === 'background')!.value, 'var(--color-red)');
  assert.equal(card[0].decls.find((d) => d.prop === 'color')!.value, 'var(--color-ink)');
});

test('nothing inside the red card overrides its size, weight or color', async () => {
  const rules = await allRules();
  for (const rule of rules) {
    const touchesRed = rule.selector.split(',').some((s) => /\.card-red\b/.test(s) && s.trim() !== '.card-red');
    if (!touchesRed) continue;
    for (const d of rule.decls) {
      if (['color', 'font-size', 'font-weight'].includes(d.prop)) {
        assert.ok(
          (d.prop === 'color' && d.value === 'var(--color-ink)') ||
            (d.prop === 'font-size' && d.value === 'var(--type-card-red-size)') ||
            (d.prop === 'font-weight' && d.value === 'var(--type-card-red-weight)'),
          `${rule.selector} { ${d.prop}: ${d.value} }`,
        );
      }
    }
  }
  // no generic rule can reach the label with a stronger selector or !important
  assert.ok(rules.every((r) => r.decls.every((d) => !/!important/.test(d.value))));
  const generic = rules.filter((r) => r.selector.split(',').some((s) => s.trim() === '.card-label'));
  for (const g of generic) assert.deepEqual(g.decls.map((d) => d.prop).filter((p) => ['color', 'font-size', 'font-weight'].includes(p)), []);
});

test('no San Marino text or link anywhere; every Wheatfield box sets its text and links in ink', async () => {
  const rules = await allRules();
  for (const r of rules) {
    for (const d of r.decls) {
      if (d.prop === 'color' || d.prop === 'text-decoration-color' || d.prop === '-webkit-text-fill-color') assert.notEqual(d.value, 'var(--color-blue)', `${r.selector} sets blue text`);
    }
  }
  const sand = rules.filter((r) => r.decls.some((d) => ['background', 'background-color'].includes(d.prop) && d.value.includes('var(--color-sand)')));
  assert.ok(sand.length >= 2, 'the sand boxes exist');
  for (const r of sand) {
    assert.equal(r.decls.find((d) => d.prop === 'color')?.value, 'var(--color-ink)', `${r.selector} must set ink text`);
    // any rule that styles descendants of this box keeps ink too
    for (const other of rules) {
      for (const sel of r.selector.split(',').map((s) => s.trim())) {
        if (other.selector.split(',').some((s) => s.trim().startsWith(sel + ' '))) {
          const c = other.decls.find((d) => d.prop === 'color');
          if (c) assert.equal(c.value, 'var(--color-ink)', other.selector);
        }
      }
    }
  }
  // links default to ink everywhere
  assert.equal(rules.find((r) => r.selector === 'a')!.decls.find((d) => d.prop === 'color')!.value, 'var(--color-ink)');
});

test('text on every card background has at least 4.5:1 (3:1 for the large bold red label)', async () => {
  const t = await tokens();
  const rules = await allRules();
  for (const r of rules) {
    const bg = r.decls.find((d) => d.prop === 'background' && /^var\(--color-/.test(d.value))?.value;
    const fg = r.decls.find((d) => d.prop === 'color' && /^var\(--color-/.test(d.value))?.value;
    if (!bg || !fg) continue;
    const ratio = contrast(hex(t, fg), hex(t, bg));
    const need = r.selector === '.card-red' ? 3 : 4.5;
    assert.ok(ratio >= need, `${r.selector}: ${ratio.toFixed(2)} < ${need}`);
  }
});

test('layout: 320px minimum, 430px maximum, no fixed width above 320px', async () => {
  const rules = await allRules();
  const frame = rules.find((r) => r.selector === '.frame')!;
  assert.equal(frame.decls.find((d) => d.prop === 'max-width')!.value, '430px');
  assert.equal(frame.decls.find((d) => d.prop === 'width')!.value, '100%');
  assert.equal(rules.find((r) => r.selector === 'body')!.decls.find((d) => d.prop === 'min-width')!.value, '320px');
  for (const r of rules) {
    for (const d of r.decls) {
      if (['width', 'min-width'].includes(d.prop)) {
        const m = /^(\d+(\.\d+)?)px$/.exec(d.value);
        if (m) assert.ok(Number(m[1]) <= 320, `${r.selector} ${d.prop}: ${d.value}`);
      }
    }
  }
  const html = await read(PUBLIC + '/index.html');
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
});
