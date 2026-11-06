import path from 'node:path';
import type { Handle } from '../../shared/feature.ts';
import { methodNotAllowed, sendJson } from '../../shared/http.ts';
import { DATA_DIR } from '../../shared/paths.ts';
import { loadCatalog, type Catalog } from './catalog.ts';

export function createHandle(catalogFile = path.join(DATA_DIR, 'catalog.json')): Handle {
  let cached: Promise<Catalog> | null = null;
  return async (req, res, url) => {
    if (url.pathname !== '/api/catalog') return false;
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return true;
    }
    try {
      cached ??= loadCatalog(catalogFile);
      sendJson(res, 200, await cached);
    } catch (error) {
      cached = null;
      console.error('Catalog could not be loaded', error instanceof Error ? error.message : error);
      sendJson(res, 500, { error: 'Catalog could not be loaded' });
    }
    return true;
  };
}

export const handle: Handle = createHandle();
