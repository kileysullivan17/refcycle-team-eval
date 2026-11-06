// Route table and matching (CONTRACTS 2.1 and 10). Pure, so it can be tested without a browser.

export const ROUTES = [
  { pattern: /^\/$/, name: 'home', module: null },
  { pattern: /^\/place$/, name: 'place', module: null },
  { pattern: /^\/item$/, name: 'item', module: null },
  { pattern: /^\/recyclopedia$/, name: 'recyclopedia', module: '/features/recyclopedia/screens.js' },
  { pattern: /^\/recyclopedia\/([^/]+)$/, name: 'category', params: ['categoryId'], module: '/features/recyclopedia/screens.js' },
  { pattern: /^\/search$/, name: 'search', module: '/features/recyclopedia/screens.js' },
  { pattern: /^\/scan$/, name: 'scan', module: '/features/camera-scan/screens.js' },
  { pattern: /^\/scan\/confirm$/, name: 'scan-confirm', module: '/features/camera-scan/screens.js' },
  { pattern: /^\/locations$/, name: 'locations', module: '/features/locator/screens.js' },
  { pattern: /^\/locations\/([^/]+)$/, name: 'facility', params: ['facilityId'], module: '/features/locator/screens.js' },
];

/** Returns { path, params, query, name, module } or null for an unknown path. `query` holds decoded strings. */
export function matchRoute(href) {
  const url = new URL(href, 'app://local');
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  for (const r of ROUTES) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params = {};
    (r.params || []).forEach((name, i) => {
      try {
        params[name] = decodeURIComponent(m[i + 1]);
      } catch {
        params[name] = m[i + 1];
      }
    });
    const query = {};
    for (const [k, v] of url.searchParams) if (!(k in query)) query[k] = v;
    return { path, params, query, name: r.name, module: r.module, search: url.search };
  }
  return null;
}

/** Which tab is highlighted for a route. */
export function tabFor(name) {
  if (name === 'scan' || name === 'scan-confirm') return 'scan';
  if (name === 'locations' || name === 'facility') return 'locations';
  if (name === 'home' || name === 'place') return null;
  return 'recyclopedia';
}
