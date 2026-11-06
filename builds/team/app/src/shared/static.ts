import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Client-side routes (CONTRACTS section 10). Each one is answered with index.html. */
export function isClientRoute(pathname: string): boolean {
  if (['/', '/place', '/recyclopedia', '/search', '/item', '/scan', '/scan/confirm', '/locations'].includes(pathname)) return true;
  return /^\/(recyclopedia|locations)\/[^/]+$/.test(pathname);
}

/** Maps a URL path to a file under `root`, or null when it would leave `root` or is malformed. */
export function resolveStaticPath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  if (decoded.split('/').some((part) => part.startsWith('.'))) return null;
  const rootNorm = normalize(root + sep);
  const full = normalize(join(root, decoded));
  if (!full.startsWith(rootNorm)) return null;
  return full;
}

/** Serves one file from `root`. Returns false when there is no such file (directories are not served). */
export async function serveFile(root: string, pathname: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const full = resolveStaticPath(root, pathname);
  if (!full) return false;
  let info;
  try {
    info = await stat(full);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;
  const body = await readFile(full);
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Content-Length', body.length);
  res.setHeader('Cache-Control', 'no-cache');
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
