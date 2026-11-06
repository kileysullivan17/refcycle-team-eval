// Locator data: reads the rules packs (read-only, through the engine's loadPacks) and the facility
// list (engine/data/facilities.csv). CONTRACTS sections 6 and 7. Nothing here writes, infers or fixes
// data: a record is served as the CSV gives it, minus internal_notes.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { loadPacks, type Pack } from '../../../../engine/code/src/rules.ts';

export type FacilityKind = 'site' | 'event' | 'category' | 'how_to';

export type Facility = {
  facility_id: string;
  place: string;
  name: string;
  kind: FacilityKind;
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
};

export type RuleWhere = {
  rule_id: string;
  where: string | null;
  location_limited: boolean;
  source_kind: string;
  source_date: string | null;
  source_url: string | null;
  applies_to: string[];
};

export type SitesResponse = {
  rules: RuleWhere[];
  sites: Facility[];
  official_source: { title: string; url: string };
};

export type SiteData = { packs: Map<string, Pack>; facilities: Facility[] };

const KIND_BY_TYPE: Record<string, FacilityKind> = {
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

const COLUMNS = [
  'facility_id', 'place', 'name', 'type', 'materials', 'address', 'lat', 'lng', 'source_url',
  'source_label', 'date_checked', 'rule_ids', 'notes', 'internal_notes',
];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
  'november', 'december',
];

function orNull(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v === '' ? null : v;
}

// Address rule (CONTRACTS 7.2): empty, "withheld ..." or "not listed ..." becomes null.
export function cleanAddress(value: string | undefined): string | null {
  const v = orNull(value);
  if (v === null) return null;
  if (/^(withheld|not listed)/i.test(v)) return null;
  return v;
}

function coordinate(value: string | undefined, min: number, max: number, label: string, id: string) {
  const v = orNull(value);
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Facility ${id} has an invalid ${label}: ${v}`);
  }
  return n;
}

// The last day an event can still happen, read from the record's own notes ("Tentative 2027-03-06."
// or "Tentative February 2027, date TBD" which ends on the last day of that month, G11). These give
// the section 7.3 values for the four Hawaiʻi County events. Null when the notes carry no date.
export function eventLastDate(notes: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(notes);
  if (iso) return iso[0];
  const month = /\b([A-Za-z]+)\s+(\d{4})\b/.exec(notes);
  if (month) {
    const m = MONTHS.indexOf(month[1].toLowerCase());
    if (m >= 0) {
      const y = Number(month[2]);
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    }
  }
  return null;
}

// Parses the facility CSV text. An unknown type is a contract break and throws. internal_notes is read
// past and dropped here, so it can never reach a response.
export function parseFacilities(csvText: string): Facility[] {
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    bom: true,
  });
  const out: Facility[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (index === 0) {
      for (const c of COLUMNS) {
        if (!(c in row)) throw new Error(`Facility list is missing the column ${c}`);
      }
    }
    const id = (row.facility_id ?? '').trim();
    if (!id) throw new Error(`Facility row ${index + 2} has no facility_id`);
    if (seen.has(id)) throw new Error(`Duplicate facility_id ${id}`);
    seen.add(id);
    const type = (row.type ?? '').trim();
    const kind = KIND_BY_TYPE[type];
    if (!kind) throw new Error(`Facility ${id} has an unknown type: ${type}`);
    const lat = coordinate(row.lat, -90, 90, 'lat', id);
    const lng = coordinate(row.lng, -180, 180, 'lng', id);
    const pin = lat !== null && lng !== null && (kind === 'site' || kind === 'event') ? { lat, lng } : null;
    const notes = (row.notes ?? '').trim();
    out.push({
      facility_id: id,
      place: (row.place ?? '').trim(),
      name: (row.name ?? '').trim(),
      kind,
      type,
      materials: (row.materials ?? '').split(';').map((m) => m.trim()).filter(Boolean),
      address: cleanAddress(row.address),
      pin,
      source_url: orNull(row.source_url),
      source_label: orNull(row.source_label),
      date_checked: orNull(row.date_checked),
      rule_ids: (row.rule_ids ?? '').split(';').map((r) => r.trim()).filter(Boolean),
      notes,
      only_site: false,
      event_last_date: kind === 'event' ? eventLastDate(notes) : null,
    });
  });
  return out;
}

export function defaultPaths() {
  return {
    rulesDir: fileURLToPath(new URL('../../../../engine/rules', import.meta.url)),
    csvPath: fileURLToPath(new URL('../../../../engine/data/facilities.csv', import.meta.url)),
  };
}

export async function loadSiteData(paths: { rulesDir: string; csvPath: string } = defaultPaths()): Promise<SiteData> {
  const packs = await loadPacks(paths.rulesDir);
  const facilities = parseFacilities(await readFile(paths.csvPath, 'utf8'));
  for (const f of facilities) {
    if (!packs.has(f.place)) throw new Error(`Facility ${f.facility_id} names an unknown place: ${f.place}`);
  }
  return { packs, facilities };
}

// One RuleWhere for a pack rule, or null when the rule is missing or rests on a superseded (or
// missing) source: such a rule is never read (LOC-8).
export function ruleWhere(pack: Pack, ruleId: string): RuleWhere | null {
  const rule = pack.rules.find((r) => r.id === ruleId);
  if (!rule) return null;
  const source = pack.sources.find((s) => s.id === rule.source);
  if (!source || source.kind === 'superseded') return null;
  const observed = typeof source.observed === 'string' && source.observed ? source.observed : null;
  const pageDate = typeof source.page_date === 'string' && source.page_date ? source.page_date : null;
  const retrieved = typeof source.retrieved === 'string' && source.retrieved ? source.retrieved : null;
  return {
    rule_id: rule.id,
    where: rule.where ?? null,
    location_limited: rule.location_limited === true,
    source_kind: source.kind,
    source_date: observed ?? pageDate ?? retrieved,
    source_url: source.url ?? null,
    applies_to: [...rule.applies_to],
  };
}

// True when the rule exists in the pack but rests on a superseded (or missing) source (LOC-8).
function rulesOnSupersededSource(pack: Pack, ruleId: string): boolean {
  const rule = pack.rules.find((r) => r.id === ruleId);
  if (!rule) return false;
  const source = pack.sources.find((s) => s.id === rule.source);
  return !source || source.kind === 'superseded';
}

function byName(a: Facility, b: Facility): number {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return a.facility_id < b.facility_id ? -1 : a.facility_id > b.facility_id ? 1 : 0;
}

export type SitesQuery = { place: string; rule_ids?: string[]; material?: string };

// CONTRACTS 6: null when the place is unknown. Without rule_ids, every linked record for the place.
// With rule_ids (possibly empty), only the records linked to a readable cited rule.
export function querySites(data: SiteData, query: SitesQuery): SitesResponse | null {
  const pack = data.packs.get(query.place);
  if (!pack) return null;
  const rules: RuleWhere[] = [];
  if (query.rule_ids) {
    const seen = new Set<string>();
    for (const id of query.rule_ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const r = ruleWhere(pack, id);
      if (r) rules.push(r);
    }
  }
  const cited = new Set(rules.map((r) => r.rule_id));
  const limited = new Set(rules.filter((r) => r.location_limited).map((r) => r.rule_id));
  // A record whose every link is a rule on a superseded source is not shown at all (LOC-8).
  let sites = data.facilities.filter(
    (f) => f.place === query.place && f.rule_ids.length > 0 && !f.rule_ids.every((id) => rulesOnSupersededSource(pack, id)),
  );
  if (query.rule_ids) sites = sites.filter((f) => f.rule_ids.some((id) => cited.has(id)));
  if (query.material !== undefined && query.material !== '') {
    const material = query.material;
    sites = sites.filter((f) => f.materials.includes(material));
  }
  const served = sites
    .map((f) => ({
      ...f,
      materials: [...f.materials],
      rule_ids: [...f.rule_ids],
      pin: f.pin ? { ...f.pin } : null,
      only_site: query.rule_ids ? f.rule_ids.some((id) => limited.has(id)) : false,
    }))
    .sort(byName);
  return {
    rules,
    sites: served,
    official_source: { title: 'Official recycling information', url: pack.jurisdiction.official_contact_url },
  };
}
