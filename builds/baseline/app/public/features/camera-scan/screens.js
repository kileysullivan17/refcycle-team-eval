// Camera scan screens: viewfinder (CS-1), confirmation (CS-8) and the unclear / multiple paths (CS-5, CS-7).
// This module never calls /api/ask and never shows a stream: the item page does that with the confirmed label.
import { identify, isAbort } from '/shared/api.js';
import { clear, el } from '/shared/dom.js';
import { icon } from '/shared/icons.js';
import { ACCEPT, cleanLabel, dataUrlBytes, fitSize, isAcceptedType, itemHref, MAX_BYTES, SNAP_TIPS } from './capture.js';

/** The last identification result, held in memory for the confirm screen. Never persisted. */
let pending = null;

function typeForm({ label, button, onSubmit, value }) {
  const input = el('input', { class: 'text-input', id: 'typed-item', type: 'text', maxlength: '200', autocomplete: 'off', required: true, value });
  input.value = value || '';
  const note = el('p', { class: 'form-note', role: 'status' });
  const form = el(
    'form',
    {
      class: 'type-form',
      onsubmit: (ev) => {
        ev.preventDefault();
        const clean = cleanLabel(input.value);
        if (!clean) {
          note.textContent = 'Type the name of the item first.';
          return;
        }
        onSubmit(clean);
      },
    },
    el('label', { for: 'typed-item' }, label),
    input,
    el('button', { class: 'button', type: 'submit' }, button),
    note,
  );
  return { form, input };
}

async function fileToDataUrl(blobOrFile) {
  const bitmap = await createImageBitmap(blobOrFile);
  try {
    return bitmapToDataUrl(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close?.();
  }
}

function bitmapToDataUrl(source, w, h) {
  const { width, height } = fitSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  for (const q of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (dataUrlBytes(url) <= MAX_BYTES) return url;
  }
  throw new Error('too large');
}

export function mount(route, container, ctx) {
  if (route.name === 'scan-confirm') return mountConfirm(container, ctx);
  return mountScan(container, ctx);
}

function mountScan(container, ctx) {
  ctx.setTitle('Camera scan');
  let stream = null;
  let facing = 'environment';
  let torchOn = false;
  let busy = false;
  let gone = false;
  let controller = null;

  const video = el('video', { class: 'viewfinder-video', autoplay: true, playsinline: true, muted: true, 'aria-label': 'Camera view' });
  video.muted = true;
  const status = el('p', { class: 'scan-status', role: 'status' });
  const tips = el('ul', { class: 'snap-tips plain-list on-sand', hidden: true }, SNAP_TIPS.map((t) => el('li', null, t)));
  const typed = el('div', { class: 'scan-type', hidden: true });

  const fileInput = el('input', { type: 'file', accept: ACCEPT, class: 'visually-hidden', id: 'photo-input', 'data-role': 'photo-input' });
  const photosLabel = el('label', { class: 'button button--secondary photos-button', for: 'photo-input' }, icon('photo'), 'Photos');

  const flash = el('button', { class: 'icon-button viewfinder-control', type: 'button', 'aria-label': 'Flash', 'aria-pressed': 'false', disabled: true }, icon('bolt'));
  const flip = el('button', { class: 'icon-button viewfinder-control', type: 'button', 'aria-label': 'Flip camera' }, icon('arrow-path'));
  const close = el('button', { class: 'icon-button viewfinder-control', type: 'button', 'aria-label': 'Close', onclick: () => ctx.navigate('/recyclopedia') }, icon('x-mark'));
  const tipsButton = el('button', { class: 'button button--secondary', type: 'button', 'aria-expanded': 'false', onclick: () => {
    tips.hidden = !tips.hidden;
    tipsButton.setAttribute('aria-expanded', String(!tips.hidden));
  } }, 'Snap Tips');
  const identifyButton = el('button', { class: 'identify-button', type: 'button', 'aria-label': 'Identify' }, el('span', { class: 'identify-text' }, 'Identify'));

  const viewfinder = el('div', { class: 'viewfinder' }, video, el('div', { class: 'viewfinder-controls' }, close, flash, flip));
  const fallback = el('div', { class: 'upload-fallback on-sand', hidden: true }, el('p', { 'data-role': 'fallback-message' }, 'The camera is not available. Choose a photo instead.'));
  const controls = el('div', { class: 'scan-actions' }, photosLabel, identifyButton, tipsButton);

  container.append(el('section', { class: 'scan' }, viewfinder, fallback, status, tips, controls, fileInput, typed));

  function setBusy(on, message) {
    busy = on;
    for (const b of [identifyButton, flash, flip]) b.disabled = on || (b === flash && !torchSupported());
    fileInput.disabled = on;
    photosLabel.setAttribute('aria-disabled', String(on));
    status.textContent = message || '';
  }

  const torchSupported = () => {
    const track = stream?.getVideoTracks?.()[0];
    return !!(track && track.getCapabilities && track.getCapabilities().torch);
  };

  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function showFallback(message) {
    stopStream();
    viewfinder.hidden = true;
    identifyButton.hidden = true;
    flash.hidden = true;
    fallback.hidden = false;
    if (message) fallback.querySelector('[data-role=fallback-message]').textContent = message;
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return showFallback();
    stopStream();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
    } catch {
      if (!gone) showFallback('Camera access was not allowed. Choose a photo instead.'); // CS-9
      return;
    }
    if (gone) return stopStream();
    video.srcObject = stream;
    video.play().catch(() => {});
    flash.disabled = !torchSupported();
    flash.setAttribute('aria-label', torchSupported() ? 'Flash' : 'Flash not available');
  }

  flash.addEventListener('click', async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      flash.setAttribute('aria-pressed', String(torchOn));
    } catch {
      torchOn = false;
      flash.disabled = true;
    }
  });
  flip.addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    torchOn = false;
    flash.setAttribute('aria-pressed', 'false');
    startCamera();
  });

  async function send(dataUrl) {
    controller?.abort();
    controller = new AbortController();
    setBusy(true, 'Identifying the item…');
    let result;
    try {
      result = await identify(dataUrl, controller.signal);
    } catch (error) {
      dataUrl = null;
      if (gone || isAbort(error)) return;
      setBusy(false, '');
      status.textContent = 'We could not identify the photo. Retake it, or type the item.';
      showTyped();
      return;
    }
    dataUrl = null; // the photo is not kept (CS-10)
    if (gone) return;
    pending = { status: result.status, label: result.label ?? null, candidates: Array.isArray(result.candidates) ? result.candidates : [] };
    ctx.navigate('/scan/confirm');
  }

  function showTyped() {
    clear(typed);
    typed.hidden = false;
    typed.append(typeForm({ label: 'Or type the item', button: 'Look it up', onSubmit: (label) => ctx.navigate(itemHref(label)) }).form);
  }

  identifyButton.addEventListener('click', async () => {
    if (busy || !stream || !video.videoWidth) {
      if (!busy) status.textContent = 'The camera is not ready yet.';
      return;
    }
    try {
      await send(bitmapToDataUrl(video, video.videoWidth, video.videoHeight));
    } catch {
      setBusy(false, 'That photo could not be prepared. Try again.');
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (!isAcceptedType(file.type)) {
      status.textContent = 'Please choose a JPEG, PNG or WebP photo.';
      return;
    }
    try {
      await send(await fileToDataUrl(file));
    } catch {
      setBusy(false, 'That photo could not be read. Choose another one.');
    }
  });

  startCamera();
  return () => {
    gone = true;
    controller?.abort();
    stopStream();
  };
}

function mountConfirm(container, ctx) {
  const result = pending;
  ctx.setTitle('Is that right?');
  if (!result) {
    ctx.navigate('/scan');
    return;
  }
  const go = (label) => ctx.navigate(itemHref(label));
  const section = el('section', { class: 'confirm', 'data-status': result.status });

  const retake = el('button', { class: 'button button--secondary', type: 'button', onclick: () => ctx.navigate('/scan') }, icon('camera'), 'Retake photo');

  if (result.status === 'identified' && result.label) {
    const label = result.label;
    const shown = ctx.displayText(label, 'scan.label');
    const editSlot = el('div', { class: 'edit-slot', hidden: true });
    section.append(
      el('h2', { class: 'screen-title', 'data-role': 'prompt' }, `We think this is: ${shown}. Is that right?`),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'button', type: 'button', 'data-action': 'yes', onclick: () => go(label) }, 'Yes'),
        el('button', {
          class: 'button button--secondary',
          type: 'button',
          'data-action': 'edit',
          onclick: () => {
            if (!editSlot.hidden) return;
            editSlot.hidden = false;
            const t = typeForm({ label: 'What is the item?', button: 'Look it up', value: label, onSubmit: go });
            editSlot.append(t.form);
            t.input.focus();
          },
        }, 'Edit'),
        retake,
      ),
      editSlot,
    );
  } else if (result.status === 'multiple') {
    section.append(
      el('h2', { class: 'screen-title', 'data-role': 'prompt' }, 'We can see more than one item. Which one do you mean?'),
      result.candidates.length
        ? el('ul', { class: 'candidate-list' }, result.candidates.map((c) => el('li', null, el('button', { class: 'button button--secondary candidate', type: 'button', onclick: () => go(c) }, ctx.displayText(c, 'scan.candidate')))))
        : null,
      typeForm({ label: 'Or type the item', button: 'Look it up', onSubmit: go }).form,
      el('div', { class: 'actions' }, retake),
    );
  } else {
    section.append(
      el('h2', { class: 'screen-title', 'data-role': 'prompt' }, "We couldn't tell what this is"),
      el('p', null, 'Retake the photo, or type the name of the item.'),
      typeForm({ label: 'Type the item', button: 'Look it up', onSubmit: go }).form,
      el('div', { class: 'actions' }, retake),
    );
  }
  container.append(section);
}
