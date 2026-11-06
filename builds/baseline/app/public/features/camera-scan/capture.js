// Pure helpers for preparing a photo (CS-1, CS-9, CS-10). Photos stay in memory and are never stored.

export const ACCEPT = 'image/jpeg,image/png,image/webp';
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_SIDE = 1600;

/** Scales (w, h) down so the longer side is at most `max`; never scales up. */
export function fitSize(w, h, max = MAX_SIDE) {
  const longest = Math.max(w, h);
  if (!(longest > 0)) return { width: 0, height: 0 };
  if (longest <= max) return { width: Math.round(w), height: Math.round(h) };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** Decoded size in bytes of a base64 data URL. */
export function dataUrlBytes(url) {
  const i = url.indexOf(',');
  if (i < 0) return 0;
  const b64 = url.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export function isAcceptedType(type) {
  return ACCEPTED_TYPES.includes(type);
}

/** Text of a typed item name to send on, or null when it is empty. */
export function cleanLabel(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 200) : null;
}

export function itemHref(label) {
  return `/item?q=${encodeURIComponent(label)}&origin=scan`;
}

export const SNAP_TIPS = ['Put one item in the middle of the frame.', 'Use good light and hold the phone steady.', 'Move close enough that the item fills most of the frame.', 'Take off anything covering the item, if you can.'];
