// Dev harness server: node --import tsx src/features/locator/dev/server.ts   (port 3011)
// Serves the locator's public files, its API and a fake shell. Not part of the app.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../routes.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = fileURLToPath(new URL('../../../../public', import.meta.url));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.map': 'application/json',
};

async function serve(res: http.ServerResponse, root: string, rel: string) {
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (await handle(req, res, url)) return;
  if (url.pathname.startsWith('/dev/')) return serve(res, here, url.pathname.slice('/dev/'.length));
  if (url.pathname.startsWith('/features/locator/')) return serve(res, join(publicRoot, 'features/locator'), url.pathname.slice('/features/locator/'.length));
  if (url.pathname === '/locations' || url.pathname.startsWith('/locations/')) return serve(res, here, 'index.html');
  res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}');
});
const port = Number(process.env.PORT ?? 3011);
server.listen(port, '127.0.0.1', () => console.log(`Locator harness on http://127.0.0.1:${port}/locations`));
