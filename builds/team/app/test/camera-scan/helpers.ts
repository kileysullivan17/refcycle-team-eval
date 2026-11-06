import { createServer, type Server } from 'node:http';
import { deflateSync } from 'node:zlib';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHandler, type IdentifyDeps } from '../../src/features/camera-scan/routes.ts';

function crc32(buf: Buffer): number {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// A real 2x2 PNG made here (no real photo, no people).
export function makePng(): Buffer {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 0, 255]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Header-only stand-ins: enough for the leading-byte check, which is all the server reads.
export function makeJpeg(): Buffer { return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]); }
export function makeWebp(): Buffer { return Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 ', 'latin1'), Buffer.alloc(16)]); }
export function makeGif(): Buffer { return Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'); }
export function dataUrl(type: string, buf: Buffer): string { return `data:${type};base64,${buf.toString('base64')}`; }

export function tmpDir(): string { return mkdtempSync(path.join(os.tmpdir(), 'camera-scan-test-')); }

export async function startServer(deps: IdentifyDeps): Promise<{ server: Server; base: string; close: () => Promise<void> }> {
  const handle = createHandler(deps);
  const server = createServer(async (req, res) => {
    const handled = await handle(req, res, new URL(req.url ?? '/', 'http://x'));
    if (!handled) { res.writeHead(404); res.end('{"error":"Not found"}'); }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  return { server, base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}

export async function post(base: string, body: unknown, contentType = 'application/json'): Promise<{ status: number; json: any }> {
  const r = await fetch(base + '/api/identify', { method: 'POST', headers: { 'Content-Type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
}
