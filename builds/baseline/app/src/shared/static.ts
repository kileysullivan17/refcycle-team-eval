import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticFile {
  body: Buffer;
  type: string;
}

/** Resolves a URL path inside `root`. Returns null for anything missing, outside the root, or not a file. */
export async function readStatic(root: string, urlPath: string): Promise<StaticFile | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  const ext = path.extname(target).toLowerCase();
  const type = TYPES[ext];
  if (!type) return null;
  try {
    if (!(await stat(target)).isFile()) return null;
    return { body: await readFile(target), type };
  } catch {
    return null;
  }
}
