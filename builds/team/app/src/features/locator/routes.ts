// GET /api/sites (CONTRACTS sections 2.1, 6 and 7). Returns true only for a request it handled.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadSiteData, querySites, type SiteData } from './sites.ts';

type Loader = () => Promise<SiteData>;

let loader: Loader = () => loadSiteData();
let cached: Promise<SiteData> | null = null;

// Tests inject a loader (fixture packs and CSV). Passing nothing restores the real data.
export function configure(next?: Loader): void {
  loader = next ?? (() => loadSiteData());
  cached = null;
}

function getData(): Promise<SiteData> {
  if (!cached) {
    cached = loader();
    cached.catch(() => {
      cached = null; // try again on the next request
    });
  }
  return cached;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

export async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (req.method !== 'GET' || url.pathname !== '/api/sites') return false;
  let data: SiteData;
  try {
    data = await getData();
  } catch (err) {
    console.error('Locator: site data could not be loaded:', err);
    send(res, 500, { error: 'Site data could not be loaded' });
    return true;
  }
  const place = url.searchParams.get('place') ?? '';
  if (!place) {
    send(res, 400, { error: 'place is required' });
    return true;
  }
  const query: { place: string; rule_ids?: string[]; material?: string } = { place };
  if (url.searchParams.has('rule_ids')) {
    query.rule_ids = (url.searchParams.get('rule_ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const material = url.searchParams.get('material');
  if (material) query.material = material;
  const result = querySites(data, query);
  if (!result) {
    send(res, 400, { error: 'Unknown place' });
    return true;
  }
  send(res, 200, result);
  return true;
}
