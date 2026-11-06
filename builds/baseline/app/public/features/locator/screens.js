// Locator screens: map, list and facility detail (LOC-1 to LOC-18).
import { ask, getSites, isAbort } from '/shared/api.js';
import { clear, el, externalLink, link, sourceHost } from '/shared/dom.js';
import { icon } from '/shared/icons.js';
import { evidenceNotes, eventState, groupByCase, KIND_LABELS, mapSites, materialOptions, parseCases, todayISO, viewFrom } from './logic.js';

const STREAM_LABELS = { recycle_bin: 'Recycling', compost_bin: 'Compost', garbage: 'Garbage', drop_off_special: 'Special drop-off', deposit_return: 'Deposit return' };
const LEAFLET_JS = '/shared/vendor/leaflet/leaflet.js';
const LEAFLET_CSS = '/shared/vendor/leaflet/leaflet.css';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';

let leafletPromise = null;
function loadLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error('map library did not load'));
    };
    document.head.append(script);
  });
  return leafletPromise;
}

function sourceLine(site) {
  const parts = [];
  if (site.source_url) parts.push(externalLink(site.source_url, `Source: ${sourceHost(site.source_url)}`, { class: 'source-link' }));
  if (site.source_label) parts.push(el('span', null, `Source: ${site.source_label}`));
  if (site.date_checked) parts.push(el('span', null, `checked ${site.date_checked}`));
  if (!parts.length) return null;
  const out = [];
  parts.forEach((p, i) => {
    if (i) out.push(' · ');
    out.push(p);
  });
  return el('p', { class: 'site-source muted' }, out);
}

function siteBody(site, rules, ctx, today) {
  const dt = (t, field) => ctx.displayText(t, `locator.${field}`);
  const state = eventState(site, today);
  const nodes = [];
  if (site.kind === 'event') {
    nodes.push(el('p', { class: 'site-tag', 'data-role': 'event-state' }, state === 'past' ? 'Check the source for the next event' : 'Tentative'));
  }
  if (site.address) nodes.push(el('p', { class: 'site-address' }, dt(site.address, 'address')));
  if (site.notes && state !== 'past') nodes.push(el('p', { class: 'site-notes' }, dt(site.notes, 'notes')));
  if (site.only_site) nodes.push(el('p', { class: 'site-only', 'data-role': 'only-site' }, 'This is the only place that takes this item.'));
  for (const note of evidenceNotes(site, rules)) nodes.push(el('p', { class: 'site-evidence muted', 'data-role': 'evidence' }, note));
  if (site.materials.length) nodes.push(el('p', { class: 'site-materials muted' }, `Takes: ${site.materials.map((m) => dt(m, 'materials')).join(', ')}`));
  const src = sourceLine(site);
  if (src) nodes.push(src);
  return nodes;
}

function siteCard(site, rules, ctx, today) {
  return el(
    'article',
    { class: 'site-card on-sand', 'data-facility': site.facility_id, 'data-kind': site.kind },
    el('p', { class: 'site-kind muted' }, KIND_LABELS[site.kind] ?? site.kind),
    el('h3', { class: 'site-name' }, link(`/locations/${encodeURIComponent(site.facility_id)}`, ctx.displayText(site.name, 'locator.name'))),
    ...siteBody(site, rules, ctx, today),
  );
}

function notice(text, extra) {
  return el('div', { class: 'locator-notice on-sand', role: 'status' }, el('p', null, text), extra || null);
}

export function mount(route, container, ctx) {
  if (route.name === 'facility') return mountFacility(route, container, ctx);
  return mountList(route, container, ctx);
}

function mountList(route, container, ctx) {
  ctx.setTitle('Locations');
  const search = new URLSearchParams(route.search || '');
  const st = {
    item: route.query.item ?? null,
    ruleIds: route.query.item !== undefined ? (route.query.rule_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    cases: parseCases(search.getAll('case')),
    view: viewFrom(route.query.view),
    material: route.query.material || '',
    data: null,
    base: null,
    waiting: false,
    failed: false,
  };
  let controller = null;
  let gone = false;
  let map = null;

  const root = el('section', { class: 'locator' });
  const head = el('div', { class: 'locator-head' });
  const controls = el('div', { class: 'locator-controls' });
  const body = el('div', { class: 'locator-body', 'aria-live': 'polite' });
  root.append(head, controls, body);
  container.append(root);

  function syncUrl() {
    const p = new URLSearchParams(location.search);
    p.set('view', st.view);
    if (st.material) p.set('material', st.material);
    else p.delete('material');
    history.replaceState(history.state, '', `${location.pathname}?${p.toString()}`);
  }

  function destroyMap() {
    if (map) {
      map.remove();
      map = null;
    }
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    destroyMap();
    clear(body);
    body.append(el('div', { class: 'loading', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('p', { class: 'loading-text' }, 'Loading places')));
    st.waiting = false;
    st.failed = false;
    try {
      const base = await getSites(ctx.place, { ruleIds: st.ruleIds, signal });
      let data = base;
      if (st.material) {
        if (!materialOptions(base.sites).includes(st.material)) st.material = '';
        else data = await getSites(ctx.place, { ruleIds: st.ruleIds, material: st.material, signal });
      }
      if (gone || signal.aborted) return;
      st.base = base;
      st.data = data;
    } catch (error) {
      if (gone || isAbort(error)) return;
      st.failed = true;
    }
    paint();
  }

  function paintHead() {
    clear(head);
    if (st.item !== null) {
      head.append(
        el('h2', { class: 'screen-title' }, 'Where to take it'),
        el('p', { class: 'locator-item', 'data-role': 'item' }, `Showing places for: ${ctx.displayText(st.item, 'locator.item')}`),
        el('p', null, link('/locations', 'Show every place')),
      );
    } else head.append(el('h2', { class: 'screen-title' }, 'Recycling centers'));
  }

  function paintControls() {
    clear(controls);
    if (!st.data) return;
    const toggle = el(
      'div',
      { class: 'view-toggle', role: 'group', 'aria-label': 'View' },
      ...['map', 'list'].map((v) =>
        el('button', { class: 'button button--secondary', type: 'button', 'data-view': v, 'aria-pressed': String(st.view === v), onclick: () => { st.view = v; syncUrl(); paint(); } }, v === 'map' ? 'Map' : 'List'),
      ),
    );
    const options = materialOptions(st.base.sites);
    const select = el('select', { class: 'select filter-select', id: 'material-filter', 'aria-label': 'Filter by material accepted' }, el('option', { value: '' }, 'All materials'), options.map((o) => el('option', { value: o, selected: o === st.material }, ctx.displayText(o, 'locator.materials'))));
    select.value = st.material;
    select.addEventListener('change', () => {
      st.material = select.value;
      syncUrl();
      load();
    });
    controls.append(toggle, el('label', { class: 'filter' }, icon('funnel'), el('span', { class: 'visually-hidden' }, 'Filter by material accepted'), select));
  }

  function paintNoSite(official) {
    // LOC-11: the pack does not name a place for this item.
    return notice('The local rules do not name a place to take this item.', el('p', null, externalLink(official.url, official.title, { class: 'source-link', 'data-role': 'official' })));
  }

  function ruleWhere() {
    const seen = new Set();
    const items = [];
    for (const r of st.data.rules) {
      if (!r.where || seen.has(r.where)) continue;
      seen.add(r.where);
      items.push(el('li', null, ctx.displayText(r.where, 'locator.where')));
    }
    return items.length ? el('section', { class: 'block' }, el('h3', { class: 'block-title' }, 'From the local rules'), el('ul', { class: 'plain-list' }, items)) : null;
  }

  function paintMap(sites) {
    const pinned = mapSites(sites);
    if (!pinned.length) {
      body.append(notice('No mapped locations yet; see the list', el('button', { class: 'button', type: 'button', 'data-action': 'show-list', onclick: () => { st.view = 'list'; syncUrl(); paint(); } }, 'List')));
      return;
    }
    const holder = el('div', { class: 'map', id: 'map', role: 'region', 'aria-label': 'Map of recycling places' });
    body.append(holder, el('p', { class: 'muted map-note' }, `${pinned.length} of ${sites.length} places have a map pin. Every place is in the list.`));
    loadLeaflet().then((L) => {
      if (gone || st.view !== 'map' || !holder.isConnected) return;
      L.Icon.Default.imagePath = '/shared/vendor/leaflet/images/';
      map = L.map(holder, { zoomControl: true });
      map.attributionControl.setPrefix(false);
      L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
      const bounds = [];
      for (const s of pinned) {
        const popup = el('div', { class: 'map-popup' }, el('strong', null, ctx.displayText(s.name, 'locator.name')), el('br'), link(`/locations/${encodeURIComponent(s.facility_id)}`, 'Details'));
        const marker = L.marker([s.pin.lat, s.pin.lng], { title: ctx.displayText(s.name, 'locator.name'), alt: ctx.displayText(s.name, 'locator.name') }).addTo(map).bindPopup(popup);
        marker.getElement()?.setAttribute('data-facility', s.facility_id);
        bounds.push([s.pin.lat, s.pin.lng]);
      }
      if (bounds.length === 1) map.setView(bounds[0], 14);
      else map.fitBounds(bounds, { padding: [32, 32] });
      holder.setAttribute('data-ready', 'true');
    }).catch(() => {
      if (!gone) holder.replaceWith(notice('The map could not be loaded. The list has every place.'));
    });
  }

  function paintList(sites) {
    const today = todayISO();
    const rules = st.data.rules;
    if (st.cases.length) {
      for (const g of groupByCase(st.cases, sites)) {
        const section = el('section', { class: 'case-group', 'data-case-stream': g.stream }, el('h3', { class: 'block-title' }, `${ctx.displayText(g.if, 'locator.case')} → ${STREAM_LABELS[g.stream] ?? g.stream}`));
        if (!g.needsSite) section.append(el('p', { class: 'muted' }, `This case goes to ${STREAM_LABELS[g.stream] ?? g.stream}, not a drop-off place.`));
        else if (!g.sites.length) section.append(el('p', { class: 'muted' }, 'No listed place for this case.'));
        else section.append(el('div', { class: 'site-list' }, g.sites.map((s) => siteCard(s, rules, ctx, today))));
        body.append(section);
      }
      return;
    }
    body.append(el('div', { class: 'site-list', 'data-role': 'sites' }, sites.map((s) => siteCard(s, rules, ctx, today))));
  }

  function paint() {
    paintHead();
    paintControls();
    destroyMap();
    clear(body);
    if (st.failed || !st.data) {
      body.append(el('div', { class: 'state-error', role: 'alert' }, el('h3', { class: 'block-title' }, 'No answer available right now'), el('p', null, 'The places could not be loaded.'), el('button', { class: 'button', type: 'button', onclick: load }, icon('arrow-path'), 'Retry')));
      return;
    }
    if (st.waiting) {
      body.append(notice('This item needs one more detail before we can show places.', link(`/item?q=${encodeURIComponent(st.item ?? '')}&origin=search`, 'Answer the question')));
      return;
    }
    const sites = st.data.sites;
    const itemMode = st.item !== null;
    if (itemMode && !sites.length) {
      const where = ruleWhere();
      body.append(paintNoSite(st.data.official_source));
      if (where) body.append(where);
      return;
    }
    if (!itemMode && !sites.length) {
      body.append(notice('No places are listed for this material yet.'));
      return;
    }
    if (st.view === 'map') paintMap(sites);
    else paintList(sites);
    if (itemMode) {
      const where = ruleWhere();
      if (where) body.append(where);
    }
  }

  // X-9: a new place re-requests what is on screen. An item is asked again in the new place.
  async function onPlace() {
    controller?.abort();
    st.material = '';
    if (st.item === null) return load();
    const mine = (controller = new AbortController());
    clear(body);
    body.append(el('div', { class: 'loading', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('p', { class: 'loading-text' }, 'Checking the local rules')));
    try {
      const a = await ask(ctx.place, st.item, mine.signal);
      if (gone || mine.signal.aborted) return;
      st.cases = a.behavior === 'conditional' ? a.conditions.map((c) => ({ stream: c.stream, if: c.if })) : [];
      st.ruleIds = a.behavior === 'answer' || a.behavior === 'conditional' ? a.rule_ids : [];
      await load();
      if (a.behavior === 'clarify') {
        st.waiting = true;
        paint();
      }
    } catch (error) {
      if (gone || isAbort(error)) return;
      st.failed = true;
      st.data = null;
      paint();
    }
  }

  const unsubscribe = ctx.onPlaceChange(onPlace);
  paintHead();
  load();
  return () => {
    gone = true;
    controller?.abort();
    destroyMap();
    unsubscribe();
  };
}

function mountFacility(route, container, ctx) {
  ctx.setTitle('Place details');
  const id = route.params.facilityId;
  const root = el('section', { class: 'facility' });
  container.append(root);
  let gone = false;
  const controller = new AbortController();

  async function load() {
    clear(root);
    root.append(el('div', { class: 'loading', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('p', { class: 'loading-text' }, 'Loading')));
    try {
      const all = await getSites(ctx.place, { signal: controller.signal });
      const site = all.sites.find((s) => s.facility_id === id);
      if (gone) return;
      if (!site) {
        clear(root);
        ctx.setTitle('Not found');
        root.append(el('h2', { class: 'screen-title' }, 'We could not find that place'), link('/locations', 'See every place'));
        return;
      }
      const detail = await getSites(ctx.place, { ruleIds: site.rule_ids, signal: controller.signal });
      if (gone) return;
      const mine = detail.sites.find((s) => s.facility_id === id) ?? site;
      draw(mine, detail.rules);
    } catch (error) {
      if (gone || isAbort(error)) return;
      clear(root);
      root.append(el('div', { class: 'state-error', role: 'alert' }, el('h2', { class: 'screen-title' }, 'No answer available right now'), el('button', { class: 'button', type: 'button', onclick: load }, icon('arrow-path'), 'Retry')));
    }
  }

  function draw(site, rules) {
    clear(root);
    const name = ctx.displayText(site.name, 'locator.name');
    ctx.setTitle(name);
    root.append(el('p', { class: 'site-kind muted' }, KIND_LABELS[site.kind] ?? site.kind), el('h2', { class: 'screen-title' }, name), el('div', { class: 'site-card on-sand', 'data-facility': site.facility_id }, ...siteBody(site, rules, ctx, todayISO())));
    // LOC-9: only items whose pack rules send them to this site.
    const accepted = [];
    const seen = new Set();
    const wheres = [];
    for (const r of rules) {
      if (!site.rule_ids.includes(r.rule_id)) continue;
      for (const item of r.applies_to) {
        const text = ctx.displayText(item, 'locator.applies_to');
        if (!seen.has(text)) {
          seen.add(text);
          accepted.push(el('li', null, text));
        }
      }
      if (r.where && !wheres.includes(r.where)) wheres.push(r.where);
    }
    if (accepted.length) root.append(el('section', { class: 'block' }, el('h3', { class: 'block-title' }, 'Accepts the following'), el('ul', { class: 'plain-list', 'data-role': 'accepts' }, accepted)));
    if (wheres.length) root.append(el('section', { class: 'block' }, el('h3', { class: 'block-title' }, 'From the local rules'), el('ul', { class: 'plain-list' }, wheres.map((w) => el('li', null, ctx.displayText(w, 'locator.where'))))));
    root.append(el('p', null, link('/locations', 'Back to all places')));
  }

  const unsubscribe = ctx.onPlaceChange(() => ctx.navigate('/locations'));
  load();
  return () => {
    gone = true;
    controller.abort();
    unsubscribe();
  };
}
