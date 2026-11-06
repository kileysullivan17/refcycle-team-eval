import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownCss, parseCss, read, type Rule } from './css.ts';

// CONTRACTS 11 and the builders' common rules: every color, font family, radius, font size and spacing
// value goes through the tokens. Spacing is a multiple of 4px written through --space-unit.

const SPACING = /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^gap$|^row-gap$|^column-gap$|^(top|right|bottom|left|inset)(-(inline|block)(-(start|end))?)?$/;
const COLOR_PROPS = /^(color|background|background-color|border-color|outline-color|fill|stroke|caret-color|text-decoration-color|accent-color)$/;
const BORDER_ALLOWED = /^(border|border-(top|right|bottom|left)|outline)$/;

function splitTop(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function spacingOk(part: string): boolean {
  if (part === '0' || part === 'auto') return true;
  if (part === 'var(--space-unit)') return true;
  let m = /^calc\(var\(--space-unit\) \* (\d+(?:\.\d+)?)\)$/.exec(part);
  if (m) return Number.isInteger(Number(m[1]) * 2);
  m = /^calc\(var\(--space-unit\) \/ (\d+(?:\.\d+)?)\)$/.exec(part);
  if (m) return [1, 2].includes(Number(m[1]));
  return false;
}

async function rulesFor(file: string): Promise<Rule[]> {
  return parseCss(await read(file));
}

test('colors, fonts, radius and font sizes use tokens; spacing is a multiple of 4px through --space-unit', async () => {
  for (const file of await ownCss()) {
    if (file.endsWith('tokens.css')) continue;
    for (const rule of await rulesFor(file)) {
      if (rule.selector.startsWith('@')) continue;
      for (const d of rule.decls) {
        const where = `${file.split('/public/')[1]} ${rule.selector} { ${d.prop}: ${d.value} }`;
        if (COLOR_PROPS.test(d.prop)) {
          assert.ok(/^(var\(--color-[a-z]+\)|transparent|currentColor|inherit|none)$/.test(d.value), where);
        }
        if (BORDER_ALLOWED.test(d.prop)) {
          // px allowed for border widths only; the color is a token
          const parts = splitTop(d.value);
          for (const p of parts) assert.ok(/^(\d+px|solid|dashed|none|0|var\(--color-[a-z]+\))$/.test(p), where);
        }
        if (d.prop === 'font-family') assert.ok(/^var\(--font-(text|display)\)$/.test(d.value), where);
        if (d.prop === 'font-size') assert.ok(/^var\(--type-[a-z0-9-]+-size\)$/.test(d.value), where);
        if (d.prop === 'border-radius') assert.ok(/^(var\(--radius-control\)|0)$/.test(d.value), where);
        if (d.prop === 'font-weight') assert.ok(/^(var\(--type-[a-z0-9-]+-weight\)|[1-9]00)$/.test(d.value), where);
        if (SPACING.test(d.prop)) for (const part of splitTop(d.value)) assert.ok(spacingOk(part), where);
        assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d.value), `${where}: raw color`);
      }
    }
  }
});

test('the spacing check itself rejects px spacing and non-multiples of 4px', () => {
  assert.equal(spacingOk('8px'), false);
  assert.equal(spacingOk('calc(var(--space-unit) * 1.25)'), false);
  assert.equal(spacingOk('calc(var(--space-unit) / 3)'), false);
  assert.equal(spacingOk('calc(var(--space-unit) / 2)'), true);
  assert.equal(spacingOk('calc(var(--space-unit) * 1.5)'), true);
});

test('icons are at most --icon-max', async () => {
  const rules = (await Promise.all((await ownCss()).filter((f) => !f.endsWith('tokens.css')).map(rulesFor))).flat();
  const icon = rules.find((r) => r.selector === '.icon')!;
  assert.equal(icon.decls.find((d) => d.prop === 'width')!.value, 'var(--icon-max)');
  assert.equal(icon.decls.find((d) => d.prop === 'height')!.value, 'var(--icon-max)');
});
