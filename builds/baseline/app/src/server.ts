import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadEnv } from '../../engine/code/src/config.ts';
import type { FeatureModule } from './shared/feature.ts';
import { HttpError, isJson, methodNotAllowed, readBody, sendJson } from './shared/http.ts';
import { appendJsonl } from './shared/logs.ts';
import { APP_DIR, LOGS_DIR, PUBLIC_DIR } from './shared/paths.ts';
import { readStatic } from './shared/static.ts';

/** Client routes from CONTRACTS section 10. Each one returns the shell page. */
const CLIENT_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/place$/,
  /^\/item$/,
  /^\/recyclopedia$/,
  /^\/recyclopedia\/[^/]+$/,
  /^\/search$/,
  /^\/scan$/,
  /^\/scan\/confirm$/,
  /^\/locations$/,
  /^\/locations\/[^/]+$/,
];

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const ENGINE_TIMEOUT_MS = 155_000;
const ASK_BODY_LIMIT = 65_536;

export interface ServerOptions {
  /** Base URL of the pinned engine. Default: ENGINE_URL or http://127.0.0.1:3000 */
  engineUrl?: string;
  publicDir?: string;
  logsDir?: string;
  /** Feature modules, in order. Default: load the three modules named in CONTRACTS 2.1, skipping missing ones. */
  modules?: FeatureModule[];
  engineTimeoutMs?: number;
}

const SwapLog = z
  .object({
    surface: z.string().min(1).max(200),
    from: z.string().min(1).max(500),
    to: z.string().max(500),
    count: z.number().int().min(1).max(100000),
    place: z.string().min(1).max(100),
  })
  .strict();

async function loadFeatureModules(): Promise<FeatureModule[]> {
  const loaders: Array<[string, () => Promise<unknown>]> = [
    ['recyclopedia', () => import('./features/recyclopedia/routes.ts')],
    ['camera-scan', () => import('./features/camera-scan/routes.ts')],
    ['locator', () => import('./features/locator/routes.ts')],
  ];
  const modules: FeatureModule[] = [];
  for (const [name, load] of loaders) {
    try {
      const mod = (await load()) as Partial<FeatureModule>;
      if (typeof mod.handle === 'function') modules.push({ handle: mod.handle });
      else console.warn(`Feature module ${name} has no handle(); skipped`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') console.warn(`Feature module ${name} is missing; skipped`);
      else throw error;
    }
  }
  return modules;
}

async function forwardToEngine(
  req: IncomingMessage,
  res: ServerResponse,
  engineUrl: string,
  pathname: string,
  timeoutMs: number,
): Promise<void> {
  const init: RequestInit = { method: req.method, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' };
  if (req.method === 'POST') {
    let body: Buffer;
    try {
      body = await readBody(req, ASK_BODY_LIMIT);
    } catch (error) {
      if (error instanceof HttpError) return sendJson(res, 400, { error: error.message });
      throw error;
    }
    init.body = new Uint8Array(body);
    init.headers = { 'Content-Type': req.headers['content-type'] ?? 'application/octet-stream' };
  }
  try {
    const upstream = await fetch(new URL(pathname, engineUrl), init);
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  } catch (error) {
    const timedOut = (error as Error).name === 'TimeoutError';
    sendJson(res, timedOut ? 504 : 502, { error: timedOut ? 'The engine took too long to answer' : 'The engine could not be reached' });
  }
}

export async function createAppServer(options: ServerOptions = {}): Promise<Server> {
  const engineUrl = options.engineUrl ?? process.env.ENGINE_URL ?? 'http://127.0.0.1:3000';
  const publicDir = options.publicDir ?? PUBLIC_DIR;
  const logsDir = options.logsDir ?? LOGS_DIR;
  const timeoutMs = options.engineTimeoutMs ?? ENGINE_TIMEOUT_MS;
  const modules = options.modules ?? (await loadFeatureModules());

  return createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { pathname } = url;

      if (pathname === '/api/jurisdictions') {
        if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
        return await forwardToEngine(req, res, engineUrl, '/api/jurisdictions', timeoutMs);
      }
      if (pathname === '/api/ask') {
        if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
        return await forwardToEngine(req, res, engineUrl, '/api/ask', timeoutMs);
      }
      if (pathname === '/api/log/display-swap') {
        if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
        if (!isJson(req)) return sendJson(res, 400, { error: 'Content-Type must be application/json' });
        let parsed: z.ZodSafeParseResult<z.infer<typeof SwapLog>>;
        try {
          parsed = SwapLog.safeParse(JSON.parse((await readBody(req, 4096)).toString('utf8')));
        } catch (error) {
          return sendJson(res, 400, { error: error instanceof HttpError ? error.message : 'Invalid JSON' });
        }
        if (!parsed.success) return sendJson(res, 400, { error: 'Invalid log record' });
        const ok = await appendJsonl(path.join(logsDir, 'display-swaps.jsonl'), parsed.data);
        return sendJson(res, ok ? 200 : 500, ok ? { ok: true } : { error: 'Log write failed' });
      }

      if (pathname.startsWith('/api/')) {
        for (const mod of modules) if (await mod.handle(req, res, url)) return;
        return sendJson(res, 404, { error: 'Not found' });
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const isClientRoute = CLIENT_ROUTES.some((re) => re.test(pathname));
        const file = await readStatic(publicDir, isClientRoute ? '/index.html' : pathname);
        if (file) {
          res.statusCode = 200;
          res.setHeader('Content-Type', file.type);
          res.setHeader('Cache-Control', 'no-cache');
          return void res.end(req.method === 'HEAD' ? undefined : file.body);
        }
      }

      for (const mod of modules) if (await mod.handle(req, res, url)) return;
      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      console.error('Unhandled request error', error instanceof Error ? error.message : error);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
      else res.end();
    }
  });
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entry) {
  await loadEnv(path.join(APP_DIR, '.env'));
  const server = await createAppServer();
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, '127.0.0.1', () => console.log(`RefCycle app on http://127.0.0.1:${port}`));
}
