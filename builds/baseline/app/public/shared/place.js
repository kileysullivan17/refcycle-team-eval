// The selected place (X-1): remembered on the device under refcycle.place. No default, no device location.
export const STORAGE_KEY = 'refcycle.place';

export function readPlace(storage) {
  try {
    const s = storage ?? globalThis.localStorage;
    const v = s.getItem(STORAGE_KEY);
    return v && v.length ? v : null;
  } catch {
    return null;
  }
}

export function writePlace(id, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, id);
  } catch {
    /* the choice then lasts only for this page view */
  }
}

export function clearPlace(storage) {
  try {
    (storage ?? globalThis.localStorage).removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** A stored id counts only if it is in the engine's list. */
export function validPlace(id, places) {
  return places.some((p) => p.id === id) ? id : null;
}
