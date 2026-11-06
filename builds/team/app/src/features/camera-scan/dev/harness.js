// Local harness: mounts the real screens.js with a fake ctx that records navigate calls.
import { mount } from '/features/camera-scan/screens.js';

const stage = document.getElementById('stage');
const log = document.getElementById('log');
const modeSelect = document.getElementById('mode');
const lines = [];
let cleanup = null;

function note(text) { lines.push(text); log.textContent = lines.join('\n'); }

const ctx = {
  place: 'seattle_wa',
  places: [{ id: 'seattle_wa', name: 'Seattle, WA' }],
  displayText: (t) => t,
  navigate(path) {
    note('navigate ' + path);
    if (path === '/scan' || path === '/scan/confirm') show(path);
    else note('(the item page is built by another slice)');
  },
  setTitle(t) { document.title = t; },
  onPlaceChange: () => () => {},
};

function show(path) {
  if (cleanup) cleanup();
  stage.replaceChildren();
  cleanup = mount({ path, params: {}, query: {} }, stage, ctx);
}

modeSelect.addEventListener('change', () => fetch('/dev/mode', { method: 'POST', body: modeSelect.value }));
document.getElementById('go-scan').addEventListener('click', () => show('/scan'));
document.getElementById('go-confirm').addEventListener('click', () => show('/scan/confirm'));
show('/scan');
