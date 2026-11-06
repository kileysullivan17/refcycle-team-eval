import { readFile } from 'node:fs/promises';
import { parse as parseCsv } from 'csv-parse/sync';
import { loadPacks, type Pack } from '../../../../engine/code/src/rules.ts';

/** CONTRACTS 7.2 */
export type Kind = 'site' | 'event' | 'category' | 'how_to';
export interface Facility {
  facility_id: string;
  place: string;
  name: string;
  kind: Kind;
  type: string;
  materials: string[];
  address: string | null;
  pin: { lat: number; lng: number } | null;
  source_url: string | null;
  source_label: string | null;
  date_checked: string | null;
  rule_ids: string[];
  notes: string;
  only_site: boolean;
  event_last_date: string | null;
}

/** CONTRACTS 6 (with K5) */
export interface RuleWhere {
  rule_id: string;
  where: string | null;
  location_limited: boolean;
  source_kind: string;
  source_date: string | null;
  source_url: string | null;
  applies_to: string[];
}

export interface SitesResponse {
  rules: RuleWhere[];
  sites: Facility[];
  official_source: { title: string; url: string };
}

const KIND_BY_TYPE: Record<string, Kind> = {
  transfer_station: 'site',
  hhw_facility: 'site',
  city_dropoff: 'site',
  reuse_center: 'site',
  private_recycler: 'site',
  site: 'site',
  hhw_event: 'event',
  retail_dropoff_unnamed: 'category',
  library_unnamed: 'category',
  redemption_center: 'category',
  tire_company: 'category',
  category: 'category',
  how_to: 'how_to',
};

/** CONTRACTS 7.3 */
const EVENT_LAST_DATE: Record<string, string> = {
  'f-hc-01': '2027-02-28',
  'f-hc-02': '2027-02-28',
  'f-hc-03': '2027-03-06',
  'f-hc-04': '2027-03-07',
};

interface CsvRow {
  facility_id: string;
  place: string;
  name: string;
  type: string;
  materials: string;
  address: string;
  lat: string;
  lng: string;
  source_url: string;
  source_label: string;
  date_checked: string;
  rule_ids: string;
  notes: string;
  internal_notes: string;
}

const nullIfEmpty = (v: string | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

function toAddress(v: string): string | null {
  const t = v.trim();
  if (t === '' || /^(withheld|not listed)/i.test(t)) return null;
  return t;
}

function toPin(kind: Kind, lat: string, lng: string): { lat: number; lng: number } | null {
  if (kind === 'category' || kind === 'how_to') return null;
  if (lat.trim() === '' || lng.trim() === '') return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}

export interface SiteData {
  packs: Map<string, Pack>;
  facilities: Facility[];
}

/** Loads the rules packs (read-only, engine loader) and the facility list. `internal_notes` is dropped here. */
export async function loadSiteData(rulesDir: string, csvFile: string): Promise<SiteData> {
  const packs = await loadPacks(rulesDir);
  const rows = parseCsv(await readFile(csvFile, 'utf8'), { columns: true, skip_empty_lines: true, bom: true }) as CsvRow[];
  const facilities = rows.map((row): Facility => {
    const kind = KIND_BY_TYPE[row.type];
    if (!kind) throw new Error(`Unknown facility type "${row.type}" in ${row.facility_id}`);
    return {
      facility_id: row.facility_id,
      place: row.place,
      name: row.name.trim(),
      kind,
      type: row.type,
      materials: row.materials.split(';').map((m) => m.trim()).filter(Boolean),
      address: toAddress(row.address),
      pin: toPin(kind, row.lat, row.lng),
      source_url: nullIfEmpty(row.source_url),
      source_label: nullIfEmpty(row.source_label),
      date_checked: nullIfEmpty(row.date_checked),
      rule_ids: row.rule_ids.split(';').map((r) => r.trim()).filter(Boolean),
      notes: row.notes.trim(),
      only_site: false,
      event_last_date: kind === 'event' ? (EVENT_LAST_DATE[row.facility_id] ?? null) : null,
    };
  });
  return { packs, facilities };
}

function ruleWhere(pack: Pack, ruleId: string): RuleWhere | null {
  const rule = pack.rules.find((r) => r.id === ruleId);
  if (!rule) return null;
  const source = pack.sources.find((s) => s.id === rule.source);
  if (!source || source.kind === 'superseded') return null; // LOC-8
  return {
    rule_id: rule.id,
    where: rule.where,
    location_limited: rule.location_limited === true,
    source_kind: source.kind,
    source_date: source.observed ?? source.page_date ?? source.retrieved,
    source_url: source.url,
    applies_to: rule.applies_to,
  };
}

export interface SitesQuery {
  place: string;
  /** undefined: every linked record for the place. An empty array: no rules, so no sites. */
  ruleIds?: string[];
  material?: string;
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });

/** Returns null for a place that has no pack. */
export function querySites(data: SiteData, query: SitesQuery): SitesResponse | null {
  const pack = data.packs.get(query.place);
  if (!pack) return null;

  const valid = (id: string) => ruleWhere(pack, id) !== null;
  const requested = query.ruleIds ? [...new Set(query.ruleIds)].filter(valid) : undefined;

  let sites = data.facilities.filter((f) => f.place === query.place && f.rule_ids.length > 0);
  // Only links to readable (non-superseded) rules count.
  sites = sites.filter((f) => f.rule_ids.some(valid));
  if (requested) sites = sites.filter((f) => f.rule_ids.some((id) => requested.includes(id)));
  if (query.material) sites = sites.filter((f) => f.materials.includes(query.material!));

  const limited = new Set(
    (requested ?? []).filter((id) => ruleWhere(pack, id)?.location_limited === true),
  );
  const served = sites
    .map((f) => ({
      ...f,
      rule_ids: [...f.rule_ids],
      materials: [...f.materials],
      only_site: requested !== undefined && f.rule_ids.some((id) => limited.has(id)),
    }))
    .sort((a, b) => collator.compare(a.name, b.name) || a.facility_id.localeCompare(b.facility_id));

  const ruleIds = requested ?? [...new Set(served.flatMap((f) => f.rule_ids))].filter(valid);
  const rules = ruleIds.map((id) => ruleWhere(pack, id)).filter((r): r is RuleWhere => r !== null);

  return {
    rules,
    sites: served,
    official_source: { title: 'Official recycling information', url: pack.jurisdiction.official_contact_url },
  };
}
