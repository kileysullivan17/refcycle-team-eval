// Run: cd app && node --import tsx src/features/camera-scan/dev/serve.ts
// Serves the Camera scan screens at http://127.0.0.1:3011/dev/index.html with the real
// POST /api/identify route wired to a fake image provider. No model provider is ever called.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../routes.ts';
import type { ImageProvider } from '../types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../../../public/features/camera-scan');
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8' };

let mode = 'identified';
const replies: Record<string, unknown> = {
  identified: { status: 'identified', label: 'plastic milk jug', candidates: [] },
  multiple: { status: 'multiple', label: null, candidates: ['glass bottle', 'soda can', 'paper bag'] },
  unclear: { status: 'unclear', label: null, candidates: [] },
};
const fake: ImageProvider = {
  model: 'fake/dev-harness',
  async identify() {
    if (mode === 'error') throw new Error('fake provider failure');
    return { value: replies[mode], model: 'fake/dev-harness' };
  },
};
const identify = createHandler({ getProvider: () => fake, logDir: path.join(os.tmpdir(), 'camera-scan-dev-logs') });

async function file(res: import('node:http').ServerResponse, p: string) {
  try {
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (await identify(req, res, url)) return;
  if (req.method === 'POST' && url.pathname === '/dev/mode') {
    let b = ''; for await (const c of req) b += c;
    if (b in replies || b === 'error') mode = b;
    res.writeHead(204); res.end(); return;
  }
  if (url.pathname.startsWith('/dev/')) return file(res, path.join(here, path.basename(url.pathname)));
  if (url.pathname.startsWith('/features/camera-scan/')) return file(res, path.join(publicDir, path.basename(url.pathname)));
  res.writeHead(404); res.end('Not found');
}).listen(3011, '127.0.0.1', () => console.log('Camera scan harness: http://127.0.0.1:3011/dev/index.html'));
