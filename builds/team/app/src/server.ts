import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { loadEnv } from '../../engine/code/src/config.ts';
import { forwardToEngine } from './shared/forward.ts';
import { BodyTooLarge, readBody, sendJson } from './shared/http.ts';
import { appendJsonl } from './shared/jsonl.ts';
import { isClientRoute, serveFile } from './shared/static.ts';

export type FeatureModule = {
  handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean>;
};

export interface AppServerOptions {
  /** Engine base URL. Default: ENGINE_URL or http://127.0.0.1:3000. */
  engineUrl?: string;
  /** Folder served as static files. Default: app/public. */
  publicDir?: string;
  /** Folder for JSONL logs. Default: app/logs (git ignores it). */
  logsDir?: string;
  /** Feature modules, asked in this order. Default: recyclopedia, camera-scan, locator. */
  features?: string[];
  /** Loads a feature module, or returns null when it does not exist. Tests replace it. */
  loadFeature?: (name: string) => Promise<FeatureModule | null>;
}

const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const FEATURES = ['recyclopedia', 'camera-scan', 'locator'];

/** Content-Security-Policy: the app itself, plus OpenStreetMap tiles and camera or upload previews. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://tile.openstreetmap.org blob: data:",
  "media-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

async function defaultLoadFeature(name: string): Promise<FeatureModule | null> {
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  const file = resolve(APP_ROOT, 'src', 'features', name, 'routes.ts');
  try {
    await access(file);
  } catch {
    return null; // a missing module is skipped
  }
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.handle !== 'function') throw new Error(`${name}/routes.ts does not export handle`);
  return mod as FeatureModule;
}

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // No device location is used anywhere. Camera is allowed for the app itself.
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
}

const SWAP_LIMIT = 4096;

async function handleDisplaySwap(req: IncomingMessage, res: ServerResponse, logsDir: string): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse((await readBody(req, SWAP_LIMIT)).toString('utf8'));
  } catch (error) {
    sendJson(res, error instanceof BodyTooLarge ? 413 : 400, { error: 'Invalid display swap record' });
    return;
  }
  const r = data as Record<string, unknown> | null;
  const text = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 500;
  if (
    !r || typeof r !== 'object' || Array.isArray(r) ||
    !text(r.surface) || !text(r.from) || !text(r.to) || !text(r.place) ||
    !Number.isInteger(r.count) || (r.count as number) < 1 || (r.count as number) > 10000
  ) {
    sendJson(res, 400, { error: 'Invalid display swap record' });
    return;
  }
  try {
    await appendJsonl(logsDir, 'display-swaps.jsonl', {
      surface: r.surface, from: r.from, to: r.to, count: r.count, place: r.place,
    });
  } catch {
    sendJson(res, 500, { error: 'Log write failed' });
    return;
  }
  res.statusCode = 204;
  res.end();
}

/** Builds the app server (not yet listening). */
export async function createAppServer(options: AppServerOptions = {}): Promise<Server> {
  const engineUrl = options.engineUrl ?? process.env.ENGINE_URL ?? 'http://127.0.0.1:3000';
  const publicDir = options.publicDir ?? resolve(APP_ROOT, 'public');
  const logsDir = options.logsDir ?? resolve(APP_ROOT, 'logs');
  const load = options.loadFeature ?? defaultLoadFeature;

  const modules: FeatureModule[] = [];
  for (const name of options.features ?? FEATURES) {
    try {
      const mod = await load(name);
      if (mod) modules.push(mod);
    } catch (error) {
      console.error(`Feature module ${name} failed to load and is skipped:`, error instanceof Error ? error.message : error);
    }
  }

  return createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      if (!req.url || !req.url.startsWith('/')) return sendJson(res, 400, { error: 'Bad request' });
      const url = new URL(req.url, 'http://127.0.0.1');
      const { pathname } = url;
      const method = req.method ?? 'GET';

      // Own routes first.
      if (method === 'GET' && pathname === '/api/jurisdictions') return forwardToEngine(req, res, engineUrl, '/api/jurisdictions');
      if (method === 'POST' && pathname === '/api/ask') return forwardToEngine(req, res, engineUrl, '/api/ask');
      if (method === 'POST' && pathname === '/api/log/display-swap') return await handleDisplaySwap(req, res, logsDir);

      // Static files, then client routes.
      if (method === 'GET' || method === 'HEAD') {
        if (!pathname.startsWith('/api/')) {
          if (pathname !== '/' && (await serveFile(publicDir, pathname, req, res))) return;
          if (isClientRoute(pathname)) {
            await serveFile(publicDir, '/index.html', req, res);
            return;
          }
        }
      }

      // Feature modules, in order.
      for (const mod of modules) {
        if (await mod.handle(req, res, url)) return;
      }
      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      console.error('Request failed:', error instanceof Error ? error.message : error);
      sendJson(res, 500, { error: 'Internal error' });
    }
  });
}

async function main(): Promise<void> {
  await loadEnv(resolve(APP_ROOT, '.env'));
  const server = await createAppServer();
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, '127.0.0.1', () => console.log(`RefCycle app on http://127.0.0.1:${port}`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
