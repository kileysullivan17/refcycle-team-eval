import type { IncomingMessage, ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
}

export class BodyTooLarge extends Error {}

/** Reads a request body, failing with BodyTooLarge once it passes `limit` bytes. */
export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    bytes += buf.length;
    if (bytes > limit) {
      req.resume();
      throw new BodyTooLarge('Request body too large');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
