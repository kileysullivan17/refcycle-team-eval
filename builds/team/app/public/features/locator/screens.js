// Recycling center locator screens (CONTRACTS sections 2.1, 6, 7, 10).
// Routes: /locations and /locations/:facilityId. Plain ES module, no build step.
// Every pack, CSV and engine string goes through ctx.displayText and is inserted as text, never HTML.

// Overridable in tests: the clock and the map library loader.
export const hooks = {
  now: () => new Date(),
  loadLeaflet: defaultLoadLeaflet,
};

const SURFACE = 'locator';
const CSS_ID = 'refcycle-locator-css';
const LEAFLET_CSS_ID = 'refcycle-leaflet-css';
const LEAFLET_JS_ID = 'refcycle-leaflet-js';
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';
const NO_PLACE_TEXT = "The rules for this place don't name a place for this item";
const NO_PINS_TEXT = 'No mapped locations yet; see the list';

// ---------- small helpers ----------

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function isHttp(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function localDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// 'tentative' | 'past' | null (not an event). On the event's last date it is still tentative (LOC-17).
export function eventState(facility, today) {
  if (!facility || facility.kind !== 'event') return null;
  if (facility.event_last_date && today > facility.event_last_date) return 'past';
  return 'tentative';
}

// Same rule as GET /api/sites?material= (LOC-18): the materials list contains the value.
export function filterByMaterial(sites, material) {
  if (!material) return sites;
  return sites.filter((s) => s.materials.includes(material));
}

function leadingDate(text) {
  if (!text) return null;
  const m = /^\d{4}-\d{2}(-\d{2})?/.exec(text);
  return m ? m[0] : text;
}

function queryString(state) {
  const q = new URLSearchParams();
  if (state.view === 'map') q.set('view', 'map');
  if (state.item) q.set('item', state.item);
  if (state.ruleIds !== null) q.set('rule_ids', state.ruleIds.join(','));
  if (state.material) q.set('material', state.material);
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function ensureStyles() {
  try {
    if (document.getElementById(CSS_ID)) return;
    document.head.appendChild(
      h('link', { id: CSS_ID, rel: 'stylesheet', href: new URL('./locator.css', import.meta.url).href }),
    );
  } catch {
    /* styling is not worth failing the screen */
  }
}

// ---------- map library ----------

function defaultLoadLeaflet() {
  if (globalThis.L && typeof globalThis.L.map === 'function') return Promise.resolve(globalThis.L);
  const base = new URL('./vendor/', import.meta.url);
  if (!document.getElementById(LEAFLET_CSS_ID)) {
    document.head.appendChild(h('link', { id: LEAFLET_CSS_ID, rel: 'stylesheet', href: new URL('leaflet.css', base).href }));
  }
  return new Promise((resolve, reject) => {
    const script = h('script', { id: LEAFLET_JS_ID, src: new URL('leaflet.js', base).href });
    script.addEventListener('load', () => resolve(globalThis.L));
    script.addEventListener('error', () => reject(new Error('Map library could not be loaded')));
    document.head.appendChild(script);
  });
}

// ---------- mount ----------

export function mount(route, container, ctx) {
  ensureStyles();
  const params = (route && route.params) || {};
  const path = (route && route.path) || '/locations';
  const facilityId = params.facilityId || (path.startsWith('/locations/') ? decodeURIComponent(path.slice('/locations/'.length)) : null);
  const view = facilityId ? new DetailScreen(route, container, ctx, facilityId) : new ListScreen(route, container, ctx);
  const cleanup = () => view.destroy();
  cleanup.settled = () => view.settled();
  view.start();
  return cleanup;
}

class Screen {
  constructor(route, container, ctx) {
    this.route = route;
    this.container = container;
    this.ctx = ctx;
    this.alive = true;
    this.loadToken = 0;
    this.renderToken = 0;
    this.pending = Promise.resolve();
    this.root = h('div', { class: 'loc' });
    clear(container);
    container.appendChild(this.root);
    this.unsubscribe = null;
  }
  t(text, field) {
    return this.ctx.displayText(String(text), `${SURFACE}.${this.kindName}.${field}`);
  }
  go(path) {
    this.ctx.navigate(path);
  }
  settled() {
    return this.pending;
  }
  destroy() {
    this.alive = false;
    this.loadToken += 1;
    this.renderToken += 1;
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.teardown();
    clear(this.container);
  }
  teardown() {}
  link(href, text, extra) {
    if (!isHttp(href)) return null;
    return h('a', { class: 'loc-link', href, target: '_blank', rel: 'noopener noreferrer', ...(extra || {}) }, text);
  }
  appLink(path, text, cls) {
    return h('a', { class: cls || 'loc-link', href: path, onclick: (e) => { if (e && e.preventDefault) e.preventDefault(); this.go(path); } }, text);
  }
  officialLine(official) {
    if (!official || !isHttp(official.url)) return null;
    return h('p', { class: 'loc-official' }, this.link(official.url, this.t(official.title || 'Official recycling information', 'official')));
  }
  // Source lines shared by cards and the detail screen (LOC-6, LOC-7, Q18).
  sourceBlock(f, rules, state) {
    const lines = [];
    if (f.source_label) lines.push(h('p', { class: 'loc-meta loc-field' }, `Source: ${this.t(f.source_label, 'source_label')}`));
    else if (rules) {
      for (const r of rules) {
        if (!f.rule_ids.includes(r.rule_id)) continue;
        if (r.source_kind === 'field_report' || r.source_kind === 'field_observation') {
          const kind = r.source_kind === 'field_report' ? 'field report' : 'field observation';
          lines.push(h('p', { class: 'loc-meta loc-field' }, `Based on a ${kind} dated ${this.t(leadingDate(r.source_date) || '', 'source_date')}; not a published page.`));
        }
      }
    }
    const parts = [];
    const a = this.link(f.source_url, 'Source page');
    if (a) parts.push(a);
    if (f.date_checked) parts.push(h('span', { class: 'loc-checked' }, `checked ${this.t(f.date_checked, 'date_checked')}`));
    if (parts.length) {
      const row = h('p', { class: 'loc-meta loc-source' });
      parts.forEach((p, i) => {
        if (i) row.appendChild(document.createTextNode(' · '));
        row.appendChild(p);
      });
      lines.push(row);
    }
    return lines;
  }
  tagFor(f, state, withOnly = true) {
    const tags = [];
    if (f.kind === 'event') {
      tags.push(h('span', { class: 'loc-tag loc-tag-event' }, state === 'past' ? 'Check the source for the next event' : 'Tentative'));
    } else if (f.kind === 'how_to') tags.push(h('span', { class: 'loc-tag' }, 'How to'));
    else if (f.kind === 'category') tags.push(h('span', { class: 'loc-tag' }, 'Several places'));
    if (f.only_site && withOnly) tags.push(h('span', { class: 'loc-tag loc-tag-only' }, 'The only place that takes this item'));
    return tags;
  }
}

// ---------- list and map ----------

class ListScreen extends Screen {
  constructor(route, container, ctx) {
    super(route, container, ctx);
    this.kindName = 'list';
    const q = (route && route.query) || {};
    this.state = {
      view: q.view === 'map' ? 'map' : 'list',
      item: q.item || '',
      ruleIds: typeof q.rule_ids === 'string' ? q.rule_ids.split(',').map((s) => s.trim()).filter(Boolean) : null,
      material: q.material || '',
    };
    this.data = null;
    this.error = false;
    this.map = null;
  }

  start() {
    this.ctx.setTitle('Locations');
    this.unsubscribe = this.ctx.onPlaceChange(() => this.onPlaceChange());
    this.load();
  }

  onPlaceChange() {
    // Rule ids belong to the place they were cited in (X-9). Re-ask the item page for the new place.
    if (this.state.ruleIds !== null && this.state.item) {
      this.go(`/item?q=${encodeURIComponent(this.state.item)}&origin=search`);
      return;
    }
    this.state.material = '';
    this.load();
  }

  load() {
    const token = ++this.loadToken;
    this.data = null;
    this.error = false;
    this.render();
    let url = `/api/sites?place=${encodeURIComponent(this.ctx.place)}`;
    if (this.state.ruleIds !== null) url += `&rule_ids=${encodeURIComponent(this.state.ruleIds.join(','))}`;
    this.pending = getJson(url)
      .then((data) => {
        if (token !== this.loadToken || !this.alive) return;
        this.data = data;
        return this.render();
      })
      .catch(() => {
        if (token !== this.loadToken || !this.alive) return;
        this.error = true;
        return this.render();
      });
  }

  syncUrl() {
    try {
      history.replaceState(history.state, '', this.route.path + queryString(this.state));
    } catch {
      /* the URL is a convenience only */
    }
  }

  setView(view) {
    this.state.view = view;
    this.syncUrl();
    this.pending = this.render();
  }

  setMaterial(material) {
    this.state.material = material;
    this.syncUrl();
    this.pending = this.render();
  }

  teardown() {
    this.removeMap();
  }

  removeMap() {
    if (this.map) {
      try {
        this.map.remove();
      } catch {
        /* already gone */
      }
      this.map = null;
    }
  }

  shown() {
    return filterByMaterial(this.data.sites, this.state.material);
  }

  render() {
    this.removeMap();
    const token = ++this.renderToken;
    clear(this.root);
    if (this.error) {
      this.root.appendChild(h('p', { class: 'loc-message', role: 'alert' }, 'Locations could not be loaded right now.'));
      return Promise.resolve();
    }
    if (!this.data) {
      this.root.appendChild(h('p', { class: 'loc-message', role: 'status' }, 'Loading locations'));
      return Promise.resolve();
    }
    const { item, ruleIds } = this.state;
    const forItem = ruleIds !== null;
    this.root.appendChild(
      h('h2', { class: 'loc-heading' }, forItem ? (item ? `Where to take: ${this.t(item, 'item')}` : 'Where to take this item') : 'All locations'),
    );
    if (forItem && this.data.sites.length === 0) {
      this.root.appendChild(this.noPlace());
      return Promise.resolve();
    }
    if (!forItem && this.data.sites.length === 0) {
      this.root.appendChild(h('p', { class: 'loc-message' }, 'No locations are listed for this place.'));
      return Promise.resolve();
    }
    this.root.appendChild(this.toolbar());
    const shown = this.shown();
    if (shown.length === 0) {
      this.root.appendChild(this.emptyFilter());
      return Promise.resolve();
    }
    if (this.state.view === 'map') return this.renderMap(shown, token);
    this.renderList(shown);
    return Promise.resolve();
  }

  toolbar() {
    const state = this.state;
    const toggle = h('div', { class: 'loc-toggle', role: 'group', 'aria-label': 'View' });
    for (const [id, label] of [['list', 'List'], ['map', 'Map']]) {
      toggle.appendChild(
        h('button', { type: 'button', class: 'loc-toggle-btn', 'data-view': id, 'aria-pressed': state.view === id ? 'true' : 'false', onclick: () => this.setView(id) }, label),
      );
    }
    const materials = [...new Set(this.data.sites.flatMap((s) => s.materials))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const select = h('select', { class: 'loc-select', id: 'loc-filter', name: 'material', onchange: (e) => this.setMaterial((e.target || select).value) });
    select.appendChild(h('option', { value: '' }, 'All materials'));
    for (const m of materials) {
      const opt = h('option', { value: m }, this.t(m, 'material'));
      if (m === state.material) opt.setAttribute('selected', '');
      select.appendChild(opt);
    }
    select.value = state.material;
    const filter = h('div', { class: 'loc-filter' }, h('label', { class: 'loc-filter-label', for: 'loc-filter' }, 'Filter by material accepted'), select);
    return h('div', { class: 'loc-toolbar' }, toggle, filter);
  }

  noPlace() {
    const where = (this.data.rules || []).filter((r) => r.where);
    const box = h('div', { class: 'loc-callout', role: 'status' });
    if (where.length === 0) {
      box.appendChild(h('p', { class: 'loc-callout-title' }, NO_PLACE_TEXT));
    } else {
      box.appendChild(h('p', { class: 'loc-callout-title' }, 'The rules for this place describe where to take this item but do not list a site we can show'));
      for (const r of where) box.appendChild(h('p', { class: 'loc-where' }, this.t(r.where, 'where')));
    }
    const o = this.officialLine(this.data.official_source);
    if (o) box.appendChild(o);
    return box;
  }

  emptyFilter() {
    return h(
      'div',
      { class: 'loc-callout', role: 'status' },
      h('p', { class: 'loc-callout-title' }, 'No locations take that material.'),
      h('button', { type: 'button', class: 'loc-button', onclick: () => this.setMaterial('') }, 'Clear the filter'),
    );
  }

  renderList(shown) {
    const today = localDate(hooks.now());
    const rules = this.data.rules || [];
    const cited = this.state.ruleIds !== null ? rules : [];
    const grouped = cited.length >= 2;
    if (!grouped && cited.some((r) => r.where)) {
      const box = h('div', { class: 'loc-callout' });
      for (const r of cited) if (r.where) box.appendChild(h('p', { class: 'loc-where' }, this.t(r.where, 'where')));
      this.root.appendChild(box);
    }
    this.root.appendChild(h('p', { class: 'loc-count', role: 'status' }, `${shown.length} ${shown.length === 1 ? 'place' : 'places'}`));
    if (!grouped) {
      this.root.appendChild(this.cardList(shown, rules, today));
      return;
    }
    for (const r of cited) {
      const section = h('section', { class: 'loc-group', 'data-rule': r.rule_id });
      section.appendChild(h('h3', { class: 'loc-group-title' }, this.groupTitle(r)));
      if (r.where) section.appendChild(h('p', { class: 'loc-where' }, this.t(r.where, 'where')));
      const mine = shown.filter((s) => s.rule_ids.includes(r.rule_id));
      if (mine.length === 0) section.appendChild(h('p', { class: 'loc-message' }, NO_PLACE_TEXT));
      else section.appendChild(this.cardList(mine, rules, today));
      this.root.appendChild(section);
    }
  }

  // The cited rule's own items, shortened to the first three when the list is long.
  groupTitle(rule) {
    const items = rule.applies_to;
    const head = this.t(items.slice(0, 3).join('; '), 'applies_to');
    return items.length > 3 ? `${head}; and ${items.length - 3} more` : head;
  }

  cardList(sites, rules, today) {
    const list = h('ul', { class: 'loc-cards' });
    for (const f of sites) list.appendChild(h('li', { class: 'loc-card', 'data-facility': f.facility_id }, this.cardBody(f, rules, today)));
    return list;
  }

  cardBody(f, rules, today) {
    const state = eventState(f, today);
    const body = [];
    const tags = this.tagFor(f, state);
    if (tags.length) body.push(h('p', { class: 'loc-tags' }, tags));
    body.push(h('h3', { class: 'loc-name' }, this.appLink(`/locations/${encodeURIComponent(f.facility_id)}`, this.t(f.name, 'name'))));
    if (f.address) body.push(h('p', { class: 'loc-address' }, this.t(f.address, 'address')));
    if (f.notes && state !== 'past') body.push(h('p', { class: 'loc-notes' }, this.t(f.notes, 'notes')));
    if (f.materials.length) body.push(h('p', { class: 'loc-meta loc-materials' }, `Takes: ${f.materials.map((m) => this.t(m, 'material')).join('; ')}`));
    body.push(...this.sourceBlock(f, rules, state));
    return body;
  }

  // Map view (LOC-1, LOC-13, CONTRACTS 7.4): a marker for each shown record that has a pin, and nothing else.
  async renderMap(shown, token) {
    const pinned = shown.filter((s) => s.pin);
    if (pinned.length === 0) {
      this.root.appendChild(
        h(
          'div',
          { class: 'loc-callout', role: 'status' },
          h('p', { class: 'loc-callout-title' }, NO_PINS_TEXT),
          h('button', { type: 'button', class: 'loc-button', onclick: () => this.setView('list') }, 'List'),
        ),
      );
      return;
    }
    const mapEl = h('div', { class: 'loc-map', id: 'loc-map', role: 'region', 'aria-label': 'Map of locations' });
    this.root.appendChild(mapEl);
    const hidden = shown.length - pinned.length;
    if (hidden > 0) {
      this.root.appendChild(
        h('p', { class: 'loc-map-note' }, `${hidden} of ${shown.length} ${shown.length === 1 ? 'place has' : 'places have'} no map pin and ${hidden === 1 ? 'appears' : 'appear'} only in the list.`),
      );
    }
    let L;
    try {
      L = await hooks.loadLeaflet();
    } catch {
      if (token === this.renderToken && this.alive) this.root.appendChild(h('p', { class: 'loc-message', role: 'alert' }, 'The map could not be loaded. See the list.'));
      return;
    }
    if (token !== this.renderToken || !this.alive) return;
    const map = L.map(mapEl, { attributionControl: true });
    this.map = map;
    if (map.attributionControl && map.attributionControl.setPrefix) map.attributionControl.setPrefix(false);
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: `<a href="${OSM_COPYRIGHT}">\u00a9 OpenStreetMap contributors</a>`,
    }).addTo(map);
    const points = [];
    for (const f of pinned) {
      const name = this.t(f.name, 'name');
      const popup = h('div', { class: 'loc-popup' }, h('p', { class: 'loc-popup-name' }, name), this.appLink(`/locations/${encodeURIComponent(f.facility_id)}`, 'Details'));
      L.marker([f.pin.lat, f.pin.lng], { title: name, alt: name, keyboard: true }).addTo(map).bindPopup(popup);
      points.push([f.pin.lat, f.pin.lng]);
    }
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { paddingTopLeft: [24, 56], paddingBottomRight: [24, 24], maxZoom: 14 });
  }
}

// ---------- detail ----------

class DetailScreen extends Screen {
  constructor(route, container, ctx, facilityId) {
    super(route, container, ctx);
    this.kindName = 'detail';
    this.facilityId = facilityId;
  }

  start() {
    this.ctx.setTitle('Location');
    this.unsubscribe = this.ctx.onPlaceChange(() => this.go('/locations'));
    this.root.appendChild(h('p', { class: 'loc-message', role: 'status' }, 'Loading location'));
    const token = ++this.loadToken;
    this.pending = this.load()
      .then((view) => {
        if (token !== this.loadToken || !this.alive) return;
        clear(this.root);
        this.root.appendChild(view);
      })
      .catch(() => {
        if (token !== this.loadToken || !this.alive) return;
        clear(this.root);
        this.root.appendChild(h('p', { class: 'loc-message', role: 'alert' }, 'This location could not be loaded right now.'));
      });
  }

  async load() {
    const place = encodeURIComponent(this.ctx.place);
    const all = await getJson(`/api/sites?place=${place}`);
    const listed = (all.sites || []).find((s) => s.facility_id === this.facilityId);
    if (!listed) return this.notFound(all.official_source);
    // The rules linked to this site: their applies_to lists are what the detail screen shows (LOC-9).
    const detail = await getJson(`/api/sites?place=${place}&rule_ids=${encodeURIComponent(listed.rule_ids.join(','))}`);
    const f = (detail.sites || []).find((s) => s.facility_id === this.facilityId) || listed;
    const linked = (detail.rules || []).filter((r) => f.rule_ids.includes(r.rule_id));
    this.ctx.setTitle(this.t(f.name, 'title'));
    return this.view(f, linked);
  }

  notFound(official) {
    const box = h(
      'div',
      { class: 'loc-callout', role: 'status' },
      h('p', { class: 'loc-callout-title' }, 'We could not find that location for this place.'),
      this.appLink('/locations', 'See all locations'),
    );
    const o = this.officialLine(official);
    if (o) box.appendChild(o);
    return box;
  }

  view(f, rules) {
    const today = localDate(hooks.now());
    const state = eventState(f, today);
    const out = h('div', { class: 'loc-detail' });
    const tags = this.tagFor(f, state, false);
    if (tags.length) out.appendChild(h('p', { class: 'loc-tags' }, tags));
    out.appendChild(h('h2', { class: 'loc-detail-title' }, this.t(f.name, 'name')));
    if (f.address) out.appendChild(h('p', { class: 'loc-address' }, this.t(f.address, 'address')));
    if (f.notes && state !== 'past') out.appendChild(h('p', { class: 'loc-notes' }, this.t(f.notes, 'notes')));
    if (f.only_site) {
      const items = rules.filter((r) => r.location_limited).flatMap((r) => r.applies_to);
      const box = h('div', { class: 'loc-callout' }, h('p', { class: 'loc-callout-title' }, 'This is the only place that takes this item.'));
      if (items.length) box.appendChild(h('p', { class: 'loc-where' }, `Applies to: ${this.t(items.join('; '), 'applies_to')}`));
      out.appendChild(box);
    }
    if (f.materials.length) out.appendChild(h('p', { class: 'loc-meta loc-materials' }, `Takes: ${f.materials.map((m) => this.t(m, 'material')).join('; ')}`));
    out.appendChild(h('div', { class: 'loc-sources' }, this.sourceBlock(f, rules, state)));
    if (rules.length) {
      const section = h('section', { class: 'loc-section loc-accepts' }, h('h3', { class: 'loc-section-title' }, 'Items the rules send here'));
      for (const r of rules) {
        const block = h('div', { class: 'loc-rule', 'data-rule': r.rule_id });
        const list = h('ul', { class: 'loc-items' });
        for (const it of r.applies_to) list.appendChild(h('li', null, this.t(it, 'applies_to')));
        block.appendChild(list);
        if (r.where) block.appendChild(h('p', { class: 'loc-where' }, this.t(r.where, 'where')));
        section.appendChild(block);
      }
      out.appendChild(section);
    }
    out.appendChild(h('p', { class: 'loc-back' }, this.appLink('/locations', 'All locations')));
    return out;
  }
}
