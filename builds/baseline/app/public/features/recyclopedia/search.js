// Catalog search (RC-3, RC-9). Pure functions.

/** Case-insensitive substring match against entry names (CONTRACTS 5.1). */
export function filterEntries(entries, text) {
  const needle = String(text ?? '').trim().toLowerCase();
  if (!needle) return [];
  return entries.filter((e) => e.name.toLowerCase().includes(needle));
}

/** Where a submitted search goes: the results screen when something matches, otherwise the engine as a free question. */
export function submitTarget(entries, text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (filterEntries(entries, t).length > 0) return `/search?q=${encodeURIComponent(t)}`;
  return `/item?q=${encodeURIComponent(t.slice(0, 2000))}&origin=search`;
}

export function askHref(text) {
  return `/item?q=${encodeURIComponent(String(text).trim().slice(0, 2000))}&origin=search`;
}
