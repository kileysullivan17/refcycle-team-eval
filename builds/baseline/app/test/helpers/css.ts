import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_DIR } from '../../src/shared/paths.ts';

export interface Block {
  file: string;
  selector: string;
  decls: Array<{ prop: string; value: string }>;
}

/** All files under app/public with the given extensions, skipping any vendor/ folder (approved third-party code). */
export async function publicFiles(exts: string[], dir = PUBLIC_DIR): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor') continue;
      out.push(...(await publicFiles(exts, full)));
    } else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out.sort();
}

export function parseCss(file: string, text: string): Block[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Block[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const decls = m[2]
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        return { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim().replace(/\s*!important$/, '') };
      });
    blocks.push({ file: path.basename(file), selector: m[1].trim(), decls });
  }
  return blocks;
}

export async function allCss(): Promise<Block[]> {
  const files = await publicFiles(['.css']);
  const out: Block[] = [];
  for (const f of files) out.push(...parseCss(f, await readFile(f, 'utf8')));
  return out;
}

export function tokens(blocks: Block[]): Record<string, string> {
  const t: Record<string, string> = {};
  for (const b of blocks.filter((x) => x.file === 'tokens.css' && x.selector === ':root')) for (const d of b.decls) if (d.prop.startsWith('--')) t[d.prop] = d.value;
  return t;
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
