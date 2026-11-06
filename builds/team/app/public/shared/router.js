// Client router. Loads screen modules with dynamic import(), one instance per module across its routes,
// and calls a screen's cleanup before the next mount (CONTRACTS section 2.1).
import { el, clear } from './dom.js';

export const NOT_AVAILABLE = 'This part of RefCycle is not available yet';

const FEATURE = {
  recyclopedia: '/features/recyclopedia/screens.js',
  scan: '/features/camera-scan/screens.js',
  locator: '/features/locator/screens.js',
};

const TABLE = [
  { pattern: /^\/place$/, shared: 'place', params: [] },
  { pattern: /^\/item$/, shared: 'item', params: [] },
  { pattern: /^\/recyclopedia$/, module: FEATURE.recyclopedia, params: [] },
  { pattern: /^\/recyclopedia\/([^/]+)$/, module: FEATURE.recyclopedia, params: ['categoryId'] },
  { pattern: /^\/search$/, module: FEATURE.recyclopedia, params: [] },
  { pattern: /^\/scan$/, module: FEATURE.scan, params: [] },
  { pattern: /^\/scan\/confirm$/, module: FEATURE.scan, params: [] },
  { pattern: /^\/locations$/, module: FEATURE.locator, params: [] },
  { pattern: /^\/locations\/([^/]+)$/, module: FEATURE.locator, params: ['facilityId'] },
];

/** Returns { module | shared, params } for a path, or null. */
export function matchRoute(path) {
  for (const row of TABLE) {
    const m = row.pattern.exec(path);
    if (!m) continue;
    const params = {};
    row.params.forEach((name, i) => {
      try {
        params[name] = decodeURIComponent(m[i + 1]);
      } catch {
        params[name] = m[i + 1];
      }
    });
    return { module: row.module, shared: row.shared, params };
  }
  return null;
}

/**
 * options:
 *  win         window-like: location, history, addEventListener
 *  container   element screens render into
 *  baseCtx     { place (getter), places, displayText, navigate, setTitle, onPlaceChange }
 *  shared      { place: () => Promise<{mount}>, item: () => Promise<{mount}> } loaders for shell screens
 *  hasPlace    () => boolean
 *  importer    (path) => Promise<module>; default is dynamic import()
 *  onRendered  ({ path, depth }) after each render
 */
export function createRouter(options) {
  const { win, container, baseCtx, shared, hasPlace } = options;
  const importer = options.importer || ((path) => import(path));
  const modules = new Map(); // module path -> loaded module (one instance per feature module)
  let cleanup = null;
  let unsubscribers = [];
  let token = 0;

  function here() {
    const params = new URLSearchParams(win.location.search);
    const query = {};
    for (const [k, v] of params) if (!(k in query)) query[k] = v;
    return { path: win.location.pathname, query };
  }

  function depth() {
    const state = win.history.state;
    return state && Number.isInteger(state.depth) ? state.depth : 0;
  }

  function runCleanup() {
    for (const off of unsubscribers) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
    unsubscribers = [];
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        /* a failing cleanup must not block navigation */
      }
    }
    cleanup = null;
  }

  // A context for one mount. Place-change subscriptions are dropped when the screen is replaced.
  function mountCtx() {
    return {
      get place() {
        return baseCtx.place;
      },
      get places() {
        return baseCtx.places;
      },
      displayText: baseCtx.displayText,
      navigate: baseCtx.navigate,
      setTitle: baseCtx.setTitle,
      onPlaceChange(callback) {
        const off = baseCtx.onPlaceChange(callback);
        unsubscribers.push(off);
        return off;
      },
    };
  }

  function showMessage(text) {
    clear(container);
    container.appendChild(el('p', { class: 'message', 'data-testid': 'route-message', text }));
  }

  async function loadScreen(match) {
    if (match.shared) return shared[match.shared]();
    if (modules.has(match.module)) return modules.get(match.module);
    const mod = await importer(match.module);
    if (!mod || typeof mod.mount !== 'function') throw new Error('Screen module has no mount');
    modules.set(match.module, mod);
    return mod;
  }

  async function render() {
    token += 1;
    const mine = token;
    runCleanup();
    let { path, query } = here();
    if (path === '/' && hasPlace()) {
      win.history.replaceState(win.history.state, '', '/recyclopedia' + win.location.search);
      path = '/recyclopedia';
    }
    // No stored place: the picker is shown whatever the route (X-1).
    const forcePicker = !hasPlace() || path === '/';
    const match = forcePicker ? { shared: 'place', params: {} } : matchRoute(path);
    options.onRendered && options.onRendered({ path: forcePicker ? '/place' : path, depth: depth() });
    if (!match) {
      baseCtx.setTitle('RefCycle');
      showMessage('This page does not exist');
      return;
    }
    clear(container);
    let mod;
    try {
      mod = await loadScreen(match);
    } catch {
      if (mine !== token) return;
      baseCtx.setTitle('RefCycle');
      showMessage(NOT_AVAILABLE);
      return;
    }
    if (mine !== token) return; // a newer navigation took over while the module loaded
    clear(container);
    try {
      cleanup = mod.mount({ path: forcePicker ? '/place' : path, params: match.params, query }, container, mountCtx());
    } catch {
      baseCtx.setTitle('RefCycle');
      showMessage(NOT_AVAILABLE);
    }
  }

  function navigate(target, replace) {
    const nextDepth = replace ? depth() : depth() + 1;
    const state = { depth: nextDepth };
    if (replace) win.history.replaceState(state, '', target);
    else win.history.pushState(state, '', target);
    return render();
  }

  win.addEventListener('popstate', () => {
    render();
  });

  return { render, navigate, depth, here };
}
