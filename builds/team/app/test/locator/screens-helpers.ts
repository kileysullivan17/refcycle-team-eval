// Shared setup for the screen tests: fake ctx, a faithful displayText, fetch backed by the real
// querySites on fixture data, and a fake Leaflet.
import { querySites, type SiteData } from '../../src/features/locator/sites.ts';
import { FakeNode, installDom } from './fake-dom.ts';

export function displayText(text: string, _surface: string): string {
  return text
    .replace(/County of Hawai[ʻ‘’'`]?i/g, 'Hawaiʻi County')
    .replace(/Big Island Biodiesel/g, 'a local biodiesel company');
}

export type Env = ReturnType<typeof makeEnv>;

export function makeEnv(data: SiteData, place = 'fix_a') {
  const dom = installDom();
  const calls: string[] = [];
  const navigations: string[] = [];
  const titles: string[] = [];
  const surfaces: string[] = [];
  let placeCb: (() => void) | null = null;
  const ctx = {
    place,
    places: [{ id: place, name: place }],
    displayText: (t: string, s: string) => { surfaces.push(s); return displayText(t, s); },
    navigate: (p: string) => { navigations.push(p); },
    setTitle: (t: string) => { titles.push(t); },
    onPlaceChange: (cb: () => void) => { placeCb = cb; return () => { placeCb = null; }; },
  };
  (globalThis as any).fetch = async (url: string) => {
    calls.push(url);
    const u = new URL(url, 'http://x');
    const q: { place: string; rule_ids?: string[]; material?: string } = { place: u.searchParams.get('place') ?? '' };
    if (u.searchParams.has('rule_ids')) q.rule_ids = (u.searchParams.get('rule_ids') ?? '').split(',').filter(Boolean);
    const m = u.searchParams.get('material');
    if (m) q.material = m;
    const r = querySites(data, q);
    return r ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(r)) } : { ok: false, status: 400, json: async () => ({}) };
  };
  const container = new FakeNode('div');
  dom.body.appendChild(container);
  return { dom, ctx, calls, navigations, titles, surfaces, container, firePlaceChange: () => placeCb?.() };
}

export function fakeLeaflet() {
  const log = { maps: [] as any[], markers: [] as any[], tiles: [] as any[], removed: 0 };
  const L = {
    map(el: FakeNode, opts: object) {
      const m: any = {
        el, opts, view: null, bounds: null,
        attributionControl: { setPrefix() { return this; } },
        setView(c: unknown, z: number) { m.view = [c, z]; return m; },
        fitBounds(b: unknown) { m.bounds = b; return m; },
        remove() { log.removed += 1; },
        invalidateSize() {},
      };
      log.maps.push(m);
      return m;
    },
    tileLayer(url: string, opts: any) {
      const t: any = { url, opts, addTo(m: any) { t.map = m; return t; } };
      log.tiles.push(t);
      return t;
    },
    marker(latlng: number[], opts: any) {
      const k: any = {
        latlng, opts, popup: null,
        addTo(m: any) { k.map = m; return k; },
        bindPopup(c: unknown) { k.popup = c; return k; },
      };
      log.markers.push(k);
      return k;
    },
  };
  return { L, log };
}
