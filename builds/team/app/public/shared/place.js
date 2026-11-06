// The selected place: one id, kept on the device in localStorage key `refcycle.place` (X-1).
// There is no default and no device location.

export const PLACE_KEY = 'refcycle.place';

let memory = null; // used only when localStorage is blocked, so the choice still lasts for this visit

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function readStoredPlace() {
  try {
    const store = storage();
    if (store) return store.getItem(PLACE_KEY);
  } catch {
    /* fall through to memory */
  }
  return memory;
}

export function writeStoredPlace(id) {
  memory = id;
  try {
    const store = storage();
    if (store) store.setItem(PLACE_KEY, id);
  } catch {
    /* kept in memory */
  }
}

export function clearStoredPlace() {
  memory = null;
  try {
    const store = storage();
    if (store) store.removeItem(PLACE_KEY);
  } catch {
    /* nothing to do */
  }
}
