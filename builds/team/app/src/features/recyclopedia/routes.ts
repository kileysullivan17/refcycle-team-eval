import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { sendJson } from '../../shared/http.ts';

const CATALOG_FILE = fileURLToPath(new URL('../../../data/catalog.json', import.meta.url));

const CatalogSchema = z.object({
  categories: z.array(z.object({ id: z.string(), name: z.string(), order: z.number().int() }).strict()),
  entries: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      name: z.string(),
      query: z.string(),
      rule_ids: z.array(z.string()),
      covered_in: z.array(z.string()),
    }).strict(),
  ),
}).strict();

let cached: string | null = null;

async function catalogJson(): Promise<string> {
  if (cached) return cached;
  const parsed = CatalogSchema.parse(JSON.parse(await readFile(CATALOG_FILE, 'utf8')));
  cached = JSON.stringify(parsed);
  return cached;
}

/** GET /api/catalog: the approved catalog, exactly as app/data/catalog.json holds it (CONTRACTS 5). */
export async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (req.method !== 'GET' || url.pathname !== '/api/catalog') return false;
  try {
    const text = await catalogJson();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(text);
  } catch {
    sendJson(res, 500, { error: 'Catalog could not be loaded' });
  }
  return true;
}
