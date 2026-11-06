import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './http.ts';

/** The browser gives up after 150 s; the app waits a little longer so the engine can answer first. */
export const ENGINE_TIMEOUT_MS = 170_000;

/**
 * Forwards a request to the engine unchanged and sends the engine's status and body back unchanged,
 * including HTTP 400 bodies. The request body is piped, not parsed, so the engine's own validation applies.
 * An engine that cannot be reached gives HTTP 502.
 */
export function forwardToEngine(
  req: IncomingMessage,
  res: ServerResponse,
  engineUrl: string,
  path: string,
  timeoutMs: number = ENGINE_TIMEOUT_MS,
): void {
  const target = new URL(path, engineUrl);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers: Record<string, string> = {};
  for (const name of ['content-type', 'content-length']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  const upstream = send(
    {
      method: req.method,
      hostname: target.hostname,
      port: target.port || undefined,
      path: target.pathname + target.search,
      headers,
    },
    (upRes) => {
      res.statusCode = upRes.statusCode ?? 502;
      const type = upRes.headers['content-type'];
      if (typeof type === 'string') res.setHeader('Content-Type', type);
      upRes.pipe(res);
      upRes.on('error', () => res.destroy());
    },
  );
  upstream.setTimeout(timeoutMs, () => upstream.destroy(new Error('Engine timed out')));
  upstream.on('error', () => {
    if (!res.headersSent) sendJson(res, 502, { error: 'The recycling engine could not be reached' });
    else res.destroy();
  });
  res.on('close', () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.on('error', () => upstream.destroy());
  req.pipe(upstream);
}
