// Client side of GET /api/catalog. The catalog lists what to ask; it never says what the answer is.

let pending = null;

function isCatalog(c) {
  return (
    c && Array.isArray(c.categories) && Array.isArray(c.entries) &&
    c.entries.every((e) => e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.query === 'string' && typeof e.category === 'string') &&
    c.categories.every((k) => k && typeof k.id === 'string' && typeof k.name === 'string')
  );
}

export function loadCatalog(fetchFn) {
  if (!pending) {
    const doFetch = fetchFn || globalThis.fetch.bind(globalThis);
    pending = doFetch('/api/catalog')
      .then(async (response) => {
        if (response.status !== 200) throw new Error('catalog unavailable');
        const catalog = await response.json();
        if (!isCatalog(catalog)) throw new Error('catalog malformed');
        catalog.categories = [...catalog.categories].sort((a, b) => a.order - b.order);
        return catalog;
      })
      .catch((error) => {
        pending = null; // allow a retry
        throw error;
      });
  }
  return pending;
}

export function resetCatalogCache() {
  pending = null;
}
