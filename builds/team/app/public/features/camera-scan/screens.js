// Camera scan screens: /scan and /scan/confirm (CONTRACTS 2.1 and 4).
// Plain ES module, no build step, no CDN. It identifies an item name and hands a confirmed label to the
// shared item page. It never asks the engine itself and shows no answer content.
// Photos live in memory only until they are sent to the identify route: no storage of any kind.

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPT = ALLOWED_TYPES.join(',');
const MAX_EDGE = 1600;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LABEL = 120;
const IDENTIFY_TIMEOUT_MS = 75000;

const SNAP_TIPS = [
  'Show one item at a time, filling most of the frame.',
  'Use good light and hold the phone steady.',
  'Take the item out of any bag or box first.',
  'Say what it is made of if you can: glass, metal, paper or plastic.',
];

const ICONS = {
  'x-mark': 'M6 18 18 6M6 6l12 12',
  bolt: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  'arrow-path':
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  photo:
    'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z',
  camera:
    'M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z',
};

// The result of the last scan, kept in memory so /scan can hand it to /scan/confirm.
// One loaded instance of this module serves both routes.
const session = { result: null };

function makeH(doc) {
  const SVG = 'http://www.w3.org/2000/svg';
  function h(tag, props, ...kids) {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(typeof kid === 'string' ? doc.createTextNode(kid) : kid);
    }
    return el;
  }
  function icon(name) {
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'cs-icon');
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  }
  return { h, icon };
}

function ensureStylesheet(doc) {
  try {
    const href = new URL('./screens.css', import.meta.url).href;
    if (doc.querySelector && doc.querySelector('link[data-cs-styles]')) return;
    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    link.setAttribute('data-cs-styles', '');
    doc.head.append(link);
  } catch {
    // Styles are an enhancement; the screen still works without them.
  }
}

function defaultEnv() {
  const g = globalThis;
  return {
    document: g.document,
    mediaDevices: g.navigator && g.navigator.mediaDevices,
    fetch: g.fetch ? g.fetch.bind(g) : undefined,
    captureFrame,
    fileToDataUrl,
    timeoutMs: IDENTIFY_TIMEOUT_MS,
  };
}

function drawToJpeg(source, width, height) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function captureFrame(video) {
  return drawToJpeg(video, video.videoWidth || 640, video.videoHeight || 480);
}

async function fileToDataUrl(file) {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return drawToJpeg(bitmap, bitmap.width, bitmap.height);
    } finally {
      if (bitmap.close) bitmap.close();
    }
  } catch {
    if (file.size > MAX_FILE_BYTES) throw new Error('too large');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }
}

function cleanLabel(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

function itemPath(label) {
  return '/item?q=' + encodeURIComponent(label) + '&origin=scan';
}

function validResult(json) {
  if (!json || typeof json !== 'object') return null;
  const status = json.status;
  if (status !== 'identified' && status !== 'unclear' && status !== 'multiple') return null;
  const candidates = Array.isArray(json.candidates)
    ? json.candidates.filter((c) => typeof c === 'string' && c.trim()).slice(0, 4)
    : [];
  const label = typeof json.label === 'string' ? cleanLabel(json.label) : '';
  if (status === 'identified' && !label) return { status: 'unclear', label: null, candidates: [] };
  return { status, label: status === 'identified' ? label : null, candidates: status === 'multiple' ? candidates : [] };
}

// ---------------------------------------------------------------- /scan

function mountScan(container, ctx, env) {
  const doc = env.document;
  const { h, icon } = makeH(doc);
  ensureStylesheet(doc);
  session.result = null;
  ctx.setTitle('Camera scan');

  let stream = null;
  let facing = 'environment';
  let torchOn = false;
  let busy = false;
  let disposed = false;
  let controller = null;
  let timer = null;

  const video = h('video', { class: 'cs-video', autoplay: true, playsinline: true, muted: true, 'aria-label': 'Camera viewfinder' });
  video.muted = true;
  const status = h('p', { class: 'cs-status', role: 'status', 'aria-live': 'polite' });
  const fallbackMessage = h('p', { class: 'cs-fallback-message' });
  const fallbackInput = h('input', { type: 'file', accept: ACCEPT, class: 'cs-file', 'aria-label': 'Choose a photo', 'data-role': 'fallback-input' });
  const fallback = h('div', { class: 'cs-fallback', 'data-role': 'fallback' }, fallbackMessage,
    h('label', { class: 'cs-file-label' }, h('span', {}, 'Choose a photo (JPEG, PNG or WebP)'), fallbackInput));
  fallback.hidden = true;

  const closeBtn = h('button', { type: 'button', class: 'cs-icon-btn', 'aria-label': 'Close', 'data-role': 'close' }, icon('x-mark'));
  const flashBtn = h('button', { type: 'button', class: 'cs-icon-btn', 'aria-label': 'Flash', 'aria-pressed': 'false', 'data-role': 'flash' }, icon('bolt'));
  const flipBtn = h('button', { type: 'button', class: 'cs-icon-btn', 'aria-label': 'Flip camera', 'data-role': 'flip' }, icon('arrow-path'));
  flashBtn.hidden = true;
  flipBtn.hidden = true;

  const photosInput = h('input', { type: 'file', accept: ACCEPT, class: 'cs-file-hidden', 'aria-hidden': 'true', tabindex: '-1', 'data-role': 'photos-input' });
  photosInput.hidden = true;
  const photosBtn = h('button', { type: 'button', class: 'cs-btn cs-btn-secondary', 'data-role': 'photos' }, icon('photo'), h('span', {}, 'Photos'));
  const identifyBtn = h('button', { type: 'button', class: 'cs-btn cs-btn-primary', 'data-role': 'identify' }, icon('camera'), h('span', {}, 'Identify'));
  const tipsBtn = h('button', { type: 'button', class: 'cs-btn cs-btn-secondary', 'aria-expanded': 'false', 'data-role': 'tips' }, h('span', {}, 'Snap Tips'));
  const tips = h('div', { class: 'cs-tips', 'data-role': 'tips-panel' },
    h('h2', { class: 'cs-tips-title' }, 'Snap Tips'),
    h('ul', { class: 'cs-tips-list' }, SNAP_TIPS.map((t) => h('li', {}, t))));
  tips.hidden = true;

  const root = h('section', { class: 'cs-scan', 'aria-label': 'Camera scan' },
    h('div', { class: 'cs-topbar' }, closeBtn, h('span', { class: 'cs-spacer' }), flashBtn, flipBtn),
    h('div', { class: 'cs-stage' }, video, fallback),
    tips,
    status,
    h('div', { class: 'cs-controls' }, photosBtn, identifyBtn, tipsBtn),
    photosInput);
  container.replaceChildren(root);

  function setStatus(text) { status.textContent = text; }
  function setBusy(on) {
    busy = on;
    for (const b of [photosBtn, identifyBtn, tipsBtn, flashBtn, flipBtn]) b.disabled = on;
    photosInput.disabled = on;
    fallbackInput.disabled = on;
  }
  function stopCamera() {
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
    video.srcObject = null;
    torchOn = false;
  }

  function showFallback(reason) {
    stopCamera();
    video.hidden = true;
    identifyBtn.hidden = true;
    flashBtn.hidden = true;
    flipBtn.hidden = true;
    fallback.hidden = false;
    fallbackMessage.textContent =
      reason === 'denied'
        ? 'Camera access is off. You can choose a photo instead.'
        : 'No camera is available. You can choose a photo instead.';
  }

  async function startCamera() {
    const md = env.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') { showFallback('none'); return; }
    try {
      const s = await md.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
      if (disposed) { for (const t of s.getTracks()) t.stop(); return; }
      stopCamera();
      stream = s;
      video.hidden = false;
      fallback.hidden = true;
      identifyBtn.hidden = false;
      video.srcObject = s;
      if (video.play) { try { await video.play(); } catch { /* autoplay can be refused; the stream is still live */ } }
      await updateCapabilities();
    } catch (e) {
      if (disposed) return;
      showFallback(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError') ? 'denied' : 'none');
    }
  }

  async function updateCapabilities() {
    // Flash and flip are hidden, not broken, where the device does not support them.
    let torch = false;
    try {
      const track = stream && stream.getVideoTracks()[0];
      const caps = track && track.getCapabilities ? track.getCapabilities() : null;
      torch = !!(caps && caps.torch);
    } catch { torch = false; }
    flashBtn.hidden = !torch;
    flashBtn.setAttribute('aria-pressed', 'false');
    let multiple = false;
    try {
      const md = env.mediaDevices;
      if (md && md.enumerateDevices) {
        const devices = await md.enumerateDevices();
        multiple = devices.filter((d) => d.kind === 'videoinput').length > 1;
      }
    } catch { multiple = false; }
    flipBtn.hidden = !multiple;
  }

  async function submit(dataUrl) {
    setBusy(true);
    setStatus('Identifying...');
    stopCamera();
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    timer = setTimeout(() => { if (controller) controller.abort(); }, env.timeoutMs);
    let result = { status: 'error', label: null, candidates: [] };
    try {
      const res = await env.fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
        signal: controller ? controller.signal : undefined,
      });
      if (res.ok) {
        const parsed = validResult(await res.json());
        if (parsed) result = parsed;
      }
    } catch {
      // Network failure, abort or timeout: the confirm screen offers retake or typing.
    } finally {
      clearTimeout(timer);
      timer = null;
    }
    dataUrl = null;
    if (disposed) return;
    session.result = result;
    ctx.navigate('/scan/confirm');
  }

  async function handleFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { setStatus('Please choose a JPEG, PNG or WebP photo.'); return; }
    setStatus('');
    let dataUrl;
    try { dataUrl = await env.fileToDataUrl(file); } catch { setStatus('That photo could not be read. Try another one.'); return; }
    if (disposed) return;
    await submit(dataUrl);
  }

  closeBtn.addEventListener('click', () => ctx.navigate('/recyclopedia'));
  tipsBtn.addEventListener('click', () => {
    tips.hidden = !tips.hidden;
    tipsBtn.setAttribute('aria-expanded', String(!tips.hidden));
  });
  photosBtn.addEventListener('click', () => { if (!busy) photosInput.click(); });
  photosInput.addEventListener('change', () => handleFile(photosInput));
  fallbackInput.addEventListener('change', () => handleFile(fallbackInput));
  identifyBtn.addEventListener('click', async () => {
    if (busy || !stream) return;
    let dataUrl;
    try { dataUrl = env.captureFrame(video); } catch { setStatus('The photo could not be taken. Try again or choose a photo.'); return; }
    await submit(dataUrl);
  });
  flashBtn.addEventListener('click', async () => {
    if (busy || !stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      torchOn = !torchOn;
      flashBtn.setAttribute('aria-pressed', String(torchOn));
    } catch { flashBtn.hidden = true; }
  });
  flipBtn.addEventListener('click', async () => {
    if (busy) return;
    facing = facing === 'environment' ? 'user' : 'environment';
    await startCamera();
  });

  startCamera();

  return function cleanup() {
    disposed = true;
    stopCamera();
    if (timer) clearTimeout(timer);
    if (controller) controller.abort();
  };
}

// ---------------------------------------------------------------- /scan/confirm

function mountConfirm(container, ctx, env) {
  const doc = env.document;
  const { h } = makeH(doc);
  ensureStylesheet(doc);
  ctx.setTitle('Confirm item');

  const result = session.result;
  let view; // prompt | edit | pick | unclear | type
  let label = '';
  let editStart = '';
  if (result && result.status === 'identified') { view = 'prompt'; label = result.label; }
  else if (result && result.status === 'multiple') { view = 'pick'; }
  else { view = 'unclear'; }
  const failed = !result || result.status === 'error';

  function go(text) {
    const clean = cleanLabel(text);
    if (!clean) return false;
    ctx.navigate(itemPath(clean));
    return true;
  }
  function retake() { ctx.navigate('/scan'); }

  function typeForm(initial, buttonText, inputLabel) {
    const input = h('input', { type: 'text', class: 'cs-input', maxlength: String(MAX_LABEL), 'aria-label': inputLabel, autocomplete: 'off', 'data-role': 'label-input' });
    input.value = initial;
    const submitBtn = h('button', { type: 'submit', class: 'cs-btn cs-btn-primary', 'data-role': 'submit-label' }, h('span', {}, buttonText));
    const form = h('form', { class: 'cs-form', 'data-role': 'label-form' }, input, submitBtn);
    form.addEventListener('submit', (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!go(input.value)) input.setAttribute('aria-invalid', 'true');
    });
    return form;
  }

  function render() {
    let body;
    if (view === 'prompt') {
      body = [
        h('p', { class: 'cs-question', 'data-role': 'question' }, 'We think this is: ' + label + '. Is that right?'),
        h('div', { class: 'cs-actions' },
          h('button', { type: 'button', class: 'cs-btn cs-btn-primary', 'data-role': 'yes', onclick: () => go(label) }, h('span', {}, 'Yes')),
          h('button', { type: 'button', class: 'cs-btn cs-btn-secondary', 'data-role': 'edit', onclick: () => { editStart = label; view = 'edit'; render(); } }, h('span', {}, 'Edit'))),
        h('button', { type: 'button', class: 'cs-link-btn', 'data-role': 'retake', onclick: retake }, 'Retake the photo'),
      ];
    } else if (view === 'edit') {
      body = [
        h('p', { class: 'cs-question' }, 'What is the item?'),
        typeForm(editStart, 'Check this item', 'Item name'),
        h('button', { type: 'button', class: 'cs-link-btn', 'data-role': 'retake', onclick: retake }, 'Retake the photo'),
      ];
    } else if (view === 'pick') {
      const cands = (result && result.candidates) || [];
      body = [
        h('p', { class: 'cs-question', 'data-role': 'question' }, 'We see more than one item. Which one do you mean?'),
        cands.length
          ? h('ul', { class: 'cs-candidates' }, cands.map((c) =>
              h('li', {}, h('button', { type: 'button', class: 'cs-btn cs-btn-secondary cs-candidate', 'data-role': 'candidate',
                onclick: () => { label = c; view = 'prompt'; render(); } }, h('span', {}, c)))))
          : null,
        h('p', { class: 'cs-hint' }, 'Or type the item:'),
        typeForm('', 'Check this item', 'Item name'),
        h('button', { type: 'button', class: 'cs-link-btn', 'data-role': 'retake', onclick: retake }, 'Retake the photo'),
      ];
    } else if (view === 'type') {
      body = [
        h('p', { class: 'cs-question' }, 'What is the item?'),
        typeForm('', 'Check this item', 'Item name'),
        h('button', { type: 'button', class: 'cs-link-btn', 'data-role': 'retake', onclick: retake }, 'Retake the photo'),
      ];
    } else {
      body = [
        h('p', { class: 'cs-question', 'data-role': 'question' },
          failed && result ? 'We could not identify the photo right now.' : failed ? 'There is no photo to check yet.' : 'We could not tell what this is.'),
        h('div', { class: 'cs-actions' },
          h('button', { type: 'button', class: 'cs-btn cs-btn-primary', 'data-role': 'retake', onclick: retake }, h('span', {}, 'Retake')),
          h('button', { type: 'button', class: 'cs-btn cs-btn-secondary', 'data-role': 'type-item', onclick: () => { view = 'type'; render(); } }, h('span', {}, 'Type the item'))),
      ];
    }
    container.replaceChildren(h('section', { class: 'cs-confirm', 'aria-label': 'Confirm item' }, h('div', { class: 'cs-card' }, body)));
  }
  render();
  return function cleanup() {};
}

// ---------------------------------------------------------------- entry

export function mount(route, container, ctx, env) {
  const e = Object.assign(defaultEnv(), env || {});
  const path = route && route.path;
  if (path === '/scan') return mountScan(container, ctx, e);
  if (path === '/scan/confirm') return mountConfirm(container, ctx, e);
  const p = e.document.createElement('p');
  p.textContent = 'This part of RefCycle is not available yet';
  container.replaceChildren(p);
  return () => {};
}
