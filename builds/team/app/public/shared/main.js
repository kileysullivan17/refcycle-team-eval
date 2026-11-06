// App shell: loads the places, builds the shared ctx, header, tab bar and router.
import { el, clear } from './dom.js';
import { displayText, setSwapLogger } from './display-text.js';
import { fetchJurisdictions } from './api.js';
import { readStoredPlace, writeStoredPlace, clearStoredPlace } from './place.js';
import { createHeader } from './header.js';
import { createTabBar } from './tabbar.js';
import { createRouter } from './router.js';
import { mount as mountPicker } from './place-picker.js';

export async function boot(root, win = window, options = {}) {
  clear(root);
  let place = null; // the selected place id, always one the engine listed
  let places = [];
  const listeners = new Set();

  // Every replacement is logged through the app server. A failure never blocks display.
  setSwapLogger((entry) => {
    try {
      win
        .fetch('/api/log/display-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entry, place: place || 'none' }),
          keepalive: true,
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  });

  const header = createHeader({
    onBack: () => goBack(),
    onPlace: (id) => choosePlace(id),
  });
  const tabs = createTabBar();
  const screen = el('main', { class: 'screen', id: 'screen', tabindex: '-1' });
  const frame = el('div', { class: 'frame' }, header.root, screen, tabs.root);
  root.appendChild(frame);

  function showFatal(text, retry) {
    header.setTitle('RefCycle');
    clear(screen);
    screen.appendChild(
      el(
        'div',
        { class: 'message', 'data-testid': 'shell-error' },
        el('p', { text }),
        el('button', { type: 'button', class: 'button', 'data-testid': 'shell-retry', on: { click: retry } }, 'Retry'),
      ),
    );
  }

  let list;
  try {
    list = await fetchJurisdictions(win.fetch.bind(win));
  } catch {
    showFatal('RefCycle cannot load its places right now', () => boot(root, win, options));
    return null;
  }
  places = list.map((p) => ({ id: p.id, name: displayText(p.name, 'place-picker.name') }));

  const stored = readStoredPlace();
  if (stored && places.some((p) => p.id === stored)) place = stored;
  else if (stored) clearStoredPlace(); // not in the engine's list: ask again

  const ctx = {
    get place() {
      return place;
    },
    get places() {
      return places;
    },
    displayText,
    navigate: (path) => {
      router.navigate(path);
    },
    setTitle: (text) => header.setTitle(text),
    onPlaceChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };

  function choosePlace(id) {
    if (!places.some((p) => p.id === id)) return;
    const hadPlace = place !== null;
    const changed = place !== id;
    place = id;
    writeStoredPlace(id);
    header.setPlaces(places, place);
    if (!hadPlace) {
      // The picker was a full screen: continue to the page that was asked for.
      const path = win.location.pathname;
      if (path === '/' || path === '/place') router.navigate('/recyclopedia', true);
      else router.render();
      return;
    }
    if (win.location.pathname === '/place') {
      router.navigate('/recyclopedia', true);
      return;
    }
    if (changed) for (const callback of [...listeners]) callback(id); // X-9
  }

  function goBack() {
    if (router.depth() > 0) win.history.back();
    else router.navigate('/recyclopedia', true);
  }

  const router = createRouter({
    win,
    container: screen,
    baseCtx: ctx,
    hasPlace: () => place !== null,
    importer: options.importer,
    shared: {
      place: async () => ({ mount: (route, container, c) => mountPicker(route, container, c, { choosePlace }) }),
      item: () => import('./item.js'),
    },
    onRendered: ({ path, depth }) => {
      tabs.setActive(path);
      header.setBackVisible(depth > 0 || (path !== '/recyclopedia' && path !== '/place'));
      header.setPlaces(places, place);
    },
  });

  // Same-origin links navigate without a reload.
  win.document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    event.preventDefault();
    router.navigate(href);
  });

  header.setPlaces(places, place);
  await router.render();
  return { router, ctx, choosePlace };
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  boot(document.getElementById('app'));
}
