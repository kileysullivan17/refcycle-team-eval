// The shell: router, place picker, header and tab bar (CONTRACTS 2.1, 10).
import { fetchJurisdictions, logSwap } from './api.js';
import { clear, el, link } from './dom.js';
import { displayText, setSwapSink } from './display-text.js';
import { icon } from './icons.js';
import { mountItem } from './item-page.js';
import { clearPlace, readPlace, validPlace, writePlace } from './place.js';
import { matchRoute, tabFor } from './router.js';

const screenEl = document.getElementById('screen');
const titleEl = document.getElementById('title');
const backEl = document.getElementById('back');
const pickerWrap = document.getElementById('place-picker');
const selectEl = document.getElementById('place-select');
const tabbarEl = document.getElementById('tabbar');

const state = { places: [], place: null, listeners: new Set(), cleanup: null, token: 0, mountListeners: 0 };

setSwapSink((rec) => logSwap({ ...rec, place: state.place || 'none' }));

backEl.append(icon('arrow-long-left'));
backEl.addEventListener('click', () => {
  if ((history.state && history.state.idx) > 0) history.back();
  else navigate('/recyclopedia');
});

const TABS = [
  { id: 'recyclopedia', href: '/recyclopedia', label: 'Recyclopedia', icon: 'book-open' },
  { id: 'scan', href: '/scan', label: 'Camera', icon: 'camera', center: true },
  { id: 'locations', href: '/locations', label: 'Locations', icon: 'map-pin' },
];
for (const t of TABS) {
  tabbarEl.append(el('a', { href: t.href, 'data-link': '', 'data-tab': t.id, class: `tab${t.center ? ' tab--center' : ''}` }, icon(t.icon), el('span', { class: 'tab-label' }, t.label)));
}

export function navigate(path, { replace = false } = {}) {
  const idx = (history.state && history.state.idx) || 0;
  if (replace) history.replaceState({ idx }, '', path);
  else history.pushState({ idx: idx + 1 }, '', path);
  render();
}

document.addEventListener('click', (ev) => {
  const a = ev.target instanceof Element ? ev.target.closest('a[data-link]') : null;
  if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  ev.preventDefault();
  navigate(a.getAttribute('href'));
});
window.addEventListener('popstate', () => render());

function setTitle(text) {
  const t = displayText(String(text ?? ''), 'header.title');
  titleEl.textContent = t;
  document.title = t && t !== 'RefCycle' ? `${t} - RefCycle` : 'RefCycle';
}

function setPlace(id) {
  state.place = id;
  writePlace(id);
  syncPicker();
}

function syncPicker() {
  clear(selectEl);
  for (const p of state.places) selectEl.append(el('option', { value: p.id, selected: p.id === state.place }, p.name));
  selectEl.value = state.place ?? '';
  pickerWrap.hidden = !state.place;
}

selectEl.addEventListener('change', () => {
  setPlace(selectEl.value);
  if (state.listeners.size === 0) render(); // a screen that does not follow the place by itself is shown again
  else for (const cb of [...state.listeners]) cb(state.place);
});

function makeCtx() {
  const mine = new Set();
  const ctx = {
    get place() {
      return state.place;
    },
    places: state.places,
    displayText,
    navigate,
    setTitle,
    onPlaceChange(cb) {
      state.listeners.add(cb);
      mine.add(cb);
      return () => {
        state.listeners.delete(cb);
        mine.delete(cb);
      };
    },
  };
  return { ctx, dispose: () => mine.forEach((cb) => state.listeners.delete(cb)) };
}

function showBoot(message, retry) {
  clear(screenEl);
  setTitle('RefCycle');
  screenEl.append(
    el(
      'div',
      { class: 'state-error', role: 'alert' },
      el('h2', { class: 'screen-title' }, 'No answer available right now'),
      el('p', null, message),
      retry ? el('button', { class: 'button', type: 'button', onclick: retry }, icon('arrow-path'), 'Retry') : null,
    ),
  );
}

function mountPlacePicker(route, container) {
  setTitle('Choose your place');
  const next = route.query.next && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/recyclopedia';
  const list = el('ul', { class: 'place-list' });
  for (const p of state.places) {
    list.append(
      el(
        'li',
        null,
        el(
          'button',
          {
            class: 'place-choice on-sand',
            type: 'button',
            'data-place': p.id,
            onclick: () => {
              setPlace(p.id);
              navigate(next, { replace: true });
            },
          },
          icon('map-pin'),
          el('span', null, p.name),
        ),
      ),
    );
  }
  container.append(
    el('section', { class: 'place-screen' }, el('h2', { class: 'screen-title' }, 'Where do you recycle?'), el('p', null, 'Recycling rules differ by place. Pick the one you live in.'), list),
  );
}

async function render() {
  const token = ++state.token;
  state.cleanup?.();
  state.cleanup = null;
  clear(screenEl);
  const route = matchRoute(location.pathname + location.search);
  const tab = route ? tabFor(route.name) : null;
  for (const a of tabbarEl.querySelectorAll('[data-tab]')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  backEl.hidden = !route || route.name === 'place';

  if (!route) {
    setTitle('Not found');
    screenEl.append(el('div', { class: 'state-error' }, el('h2', { class: 'screen-title' }, 'Page not found'), link('/recyclopedia', 'Go to Recyclopedia')));
    return;
  }
  if (route.name === 'home') return navigate(state.place ? '/recyclopedia' : '/place', { replace: true });
  if (!state.place && route.name !== 'place') {
    const here = route.path + route.search;
    return navigate(`/place?next=${encodeURIComponent(here)}`, { replace: true });
  }

  const { ctx, dispose } = makeCtx();
  let mounted = null;
  try {
    if (route.name === 'place') mounted = mountPlacePicker(route, screenEl, ctx);
    else if (route.name === 'item') mounted = await mountItem(route, screenEl, ctx);
    else {
      let mod;
      try {
        mod = await import(route.module);
      } catch {
        mod = null;
      }
      if (token !== state.token) return dispose();
      if (!mod || typeof mod.mount !== 'function') {
        setTitle('RefCycle');
        screenEl.append(el('p', { class: 'state-error' }, 'This part of RefCycle is not available yet'));
        return dispose();
      }
      mounted = await mod.mount(route, screenEl, ctx);
    }
  } catch (error) {
    console.error('Screen failed', error);
    clear(screenEl);
    showBoot('Something went wrong on this screen.', () => render());
    return dispose();
  }
  if (token !== state.token) {
    if (typeof mounted === 'function') mounted();
    return dispose();
  }
  state.cleanup = () => {
    try {
      if (typeof mounted === 'function') mounted();
    } finally {
      dispose();
    }
  };
  screenEl.focus({ preventScroll: true });
}

async function boot() {
  clear(screenEl);
  let list;
  try {
    list = await fetchJurisdictions();
    if (!Array.isArray(list) || !list.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')) throw new Error('bad list');
  } catch {
    showBoot('The list of places could not be loaded.', boot);
    return;
  }
  state.places = list.map((p) => ({ id: p.id, name: displayText(p.name, 'place-list') }));
  const stored = readPlace();
  state.place = validPlace(stored, state.places);
  if (stored && !state.place) clearPlace();
  syncPicker();
  render();
}

boot();
