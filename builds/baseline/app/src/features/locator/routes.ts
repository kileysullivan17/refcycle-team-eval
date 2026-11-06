import type { Handle } from '../../shared/feature.ts';
import { methodNotAllowed, sendJson } from '../../shared/http.ts';
import { FACILITIES_CSV, RULES_DIR } from '../../shared/paths.ts';
import { loadSiteData, querySites, type SiteData } from './sites.ts';

export function createHandle(rulesDir = RULES_DIR, csvFile = FACILITIES_CSV): Handle {
  // Loaded once, on first use after startup. A failure is not cached, so a fixed file works on the next request.
  let loading: Promise<SiteData> | null = null;
  return async (req, res, url) => {
    if (url.pathname !== '/api/sites') return false;
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return true;
    }
    let data: SiteData;
    try {
      loading ??= loadSiteData(rulesDir, csvFile);
      data = await loading;
    } catch (error) {
      loading = null;
      console.error('Site data could not be loaded:', error instanceof Error ? error.message : error); // detail to the server log only (K1)
      sendJson(res, 500, { error: 'Site data could not be loaded' });
      return true;
    }
    const place = url.searchParams.get('place') ?? '';
    const ruleIdsParam = url.searchParams.get('rule_ids');
    const material = url.searchParams.get('material') ?? undefined;
    const ruleIds = ruleIdsParam === null ? undefined : ruleIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const result = querySites(data, { place, ruleIds, material });
    if (!result) sendJson(res, 400, { error: 'Unknown place' });
    else sendJson(res, 200, result);
    return true;
  };
}

export const handle: Handle = createHandle();
