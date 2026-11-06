// Tiny CSS reader for tests: plain rules, @font-face and @media/@keyframes blocks. No dependencies.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const PUBLIC = resolve(import.meta.dirname, '../../public');

export type Decl = { prop: string; value: string };
export type Rule = { selector: string; decls: Decl[]; at: string | null };

export function parseCss(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const walk = (body: string, at: string | null) => {
    let i = 0;
    while (i < body.length) {
      const open = body.indexOf('{', i);
      if (open === -1) break;
      const head = body.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < body.length && depth) {
        if (body[j] === '{') depth += 1;
        else if (body[j] === '}') depth -= 1;
        j += 1;
      }
      const inner = body.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@keyframes') || head.startsWith('@supports')) walk(inner, head);
      else {
        const decls: Decl[] = [];
        for (const part of inner.split(/;(?![^(]*\))/)) {
          const k = part.indexOf(':');
          if (k > 0) decls.push({ prop: part.slice(0, k).trim().toLowerCase(), value: part.slice(k + 1).trim() });
        }
        rules.push({ selector: head, decls, at });
      }
      i = j;
    }
  };
  walk(text, null);
  return rules;
}

export async function files(dir: string, ext: RegExp, skip: RegExp = /(^|\/)vendor(\/|$)/): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (skip.test(full)) continue;
    if (entry.isDirectory()) out.push(...(await files(full, ext, skip)));
    else if (ext.test(entry.name)) out.push(full);
  }
  return out.sort();
}

export async function read(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

/** CSS files the shell and the Recyclopedia own (other slices' styles are checked by their own tests). */
export async function ownCss(): Promise<string[]> {
  return [...(await files(join(PUBLIC, 'shared'), /\.css$/)), ...(await files(join(PUBLIC, 'features/recyclopedia'), /\.css$/))];
}

export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Custom properties declared in :root of tokens.css. */
export async function tokens(): Promise<Record<string, string>> {
  const rules = parseCss(await read(join(PUBLIC, 'shared/tokens.css')));
  const out: Record<string, string> = {};
  for (const r of rules.filter((r) => r.selector === ':root')) for (const d of r.decls) out[d.prop] = d.value;
  return out;
}
