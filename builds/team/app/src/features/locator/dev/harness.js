// Dev harness: a fake ctx and a tiny router around the locator's screens.js. Not part of the app.
import { mount } from '/features/locator/screens.js';

const app = document.getElementById('app');
const placeSelect = document.getElementById('place');
const callbacks = new Set();
let cleanup = null;

function displayText(text) {
  return String(text)
    .replace(/County of Hawai[ʻ‘’'`]?i/g, 'Hawaiʻi County')
    .replace(/Big Island Biodiesel/g, 'a local biodiesel company');
}

const ctx = {
  get place() { return placeSelect.value; },
  places: [],
  displayText,
  navigate(path) { history.pushState(null, '', path); render(); },
  setTitle(text) { document.title = text; },
  onPlaceChange(cb) { callbacks.add(cb); return () => callbacks.delete(cb); },
};

function render() {
  if (cleanup) cleanup();
  const url = new URL(location.href);
  const query = Object.fromEntries(url.searchParams.entries());
  const m = /^\/locations\/([^/]+)$/.exec(url.pathname);
  const route = { path: url.pathname, params: m ? { facilityId: decodeURIComponent(m[1]) } : {}, query };
  cleanup = mount(route, app, ctx);
}

placeSelect.addEventListener('change', () => { for (const cb of [...callbacks]) cb(); });
document.querySelector('.dev-bar').addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a');
  if (a) { e.preventDefault(); ctx.navigate(a.getAttribute('href')); }
});
window.addEventListener('popstate', render);
render();
