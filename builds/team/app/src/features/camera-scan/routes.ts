import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { ImageError, parseImageDataUrl } from './image.ts';
import { reduceReply } from './sanitize.ts';
import type { ImageProvider } from './types.ts';
import { getConfiguredProvider } from './provider.ts';

// 5 MB image as base64 is about 6.99 MB; allow the JSON wrapper on top.
export const MAX_BODY_BYTES = 7 * 1024 * 1024 + 4096;

export interface IdentifyDeps {
  getProvider?: () => Promise<ImageProvider> | ImageProvider;
  logDir?: string;
  now?: () => number;
}

const Body = z.object({ image: z.string() }).strict();

const DEFAULT_LOG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../logs');

function send(res: ServerResponse, status: number, body: unknown, close = false): void {
  const text = JSON.stringify(body);
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  };
  if (close) headers.Connection = 'close';
  res.writeHead(status, headers);
  res.end(text);
}

class TooLarge extends Error {}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on('data', (chunk: Buffer) => {
      if (over) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { over = true; chunks.length = 0; reject(new TooLarge()); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks)); });
    req.on('error', (e) => { if (!over) reject(e); });
  });
}

// The log holds time, status, label, model and duration only. Never image data (CS-10).
async function writeLog(dir: string, line: { time: string; status: string; label: string | null; model: string | null; duration_ms: number }): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, 'identify.jsonl'), JSON.stringify(line) + '\n', 'utf8');
  } catch {
    // Logging failures never block the answer.
  }
}

export function createHandler(deps: IdentifyDeps = {}) {
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? DEFAULT_LOG_DIR;
  const getProvider = deps.getProvider ?? getConfiguredProvider;

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== 'POST' || url.pathname !== '/api/identify') return false;
    const started = now();
    const done = async (status: string, label: string | null, model: string | null) =>
      writeLog(logDir, { time: new Date(started).toISOString(), status, label, model, duration_ms: Math.max(0, now() - started) });

    const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      await done('rejected', null, null);
      send(res, 400, { error: 'Content-Type must be application/json' }, true);
      return true;
    }
    let raw: Buffer;
    try {
      raw = await readBody(req);
    } catch (e) {
      if (e instanceof TooLarge) {
        await done('rejected', null, null);
        send(res, 400, { error: 'Image is larger than 5 MB' }, true);
      } else {
        await done('rejected', null, null);
        send(res, 400, { error: 'Request could not be read' }, true);
      }
      return true;
    }
    let image;
    try {
      let json: unknown;
      try { json = JSON.parse(raw.toString('utf8')); } catch { throw new ImageError('Body must be valid JSON'); }
      const parsed = Body.safeParse(json);
      if (!parsed.success) throw new ImageError('Body must be { "image": "data:image/<jpeg|png|webp>;base64,..." }');
      image = parseImageDataUrl(parsed.data.image);
    } catch (e) {
      await done('rejected', null, null);
      send(res, 400, { error: e instanceof ImageError ? e.message : 'Invalid request' });
      return true;
    }

    try {
      const provider = await getProvider();
      let reply = await provider.identify(image);
      let reduced = reduceReply(reply.value);
      if (reduced.emptiedByCleaning) {
        // One re-ask when cleaning removed the whole label (for example a brand-only answer).
        reply = await provider.identify(image, true);
        reduced = reduceReply(reply.value);
      }
      const out = { status: reduced.status, label: reduced.label, candidates: reduced.candidates, model: reply.model };
      await done(out.status, out.label, out.model);
      send(res, 200, out);
    } catch {
      // Detail (and any provider message) is not returned to the browser or logged.
      await done('error', null, null);
      send(res, 502, { error: 'Identification is not available right now' });
    }
    return true;
  };
}

export const handle = createHandler();
