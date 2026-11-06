// Catalog search (RC-3): a case-insensitive substring match on the entry name.

export function searchEntries(entries, text) {
  const needle = String(text || '').trim().toLowerCase();
  if (!needle) return [];
  return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
}

/** The item page URL for text that matches no catalog entry (RC-9). */
export function freeQuestionHref(text) {
  return '/item?q=' + encodeURIComponent(String(text).trim()) + '&origin=search';
}

export function entryHref(entry) {
  return '/item?entry=' + encodeURIComponent(entry.id);
}
