// Pure locator rules (LOC-5, LOC-7, LOC-13 to LOC-18, G19). No DOM, so each can be tested on fixtures.

export const KIND_LABELS = { site: 'Site', event: 'Event', category: 'Category', how_to: 'How to' };
const SPECIAL = new Set(['drop_off_special', 'deposit_return']);

/** Today as YYYY-MM-DD in the device's time zone. */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** LOC-17. 'current' = tentative; 'past' = after the last date. Non-events and events without a last date are 'none'. */
export function eventState(site, today) {
  if (site.kind !== 'event') return 'none';
  if (!site.event_last_date) return 'current';
  return today > site.event_last_date ? 'past' : 'current';
}

/** LOC-7. A note when the information rests on a field observation or field report, with its date. */
export function evidenceNotes(site, rules) {
  const notes = [];
  for (const id of site.rule_ids) {
    const r = rules.find((x) => x.rule_id === id);
    if (!r || !r.source_date) continue;
    if (r.source_kind === 'field_observation') notes.push(`Field observation dated ${r.source_date}; not a published page.`);
    else if (r.source_kind === 'field_report') notes.push(`Field report dated ${r.source_date}; not a published page.`);
  }
  return [...new Set(notes)];
}

/** LOC-18. The filter values: every material in the sites, sorted. */
export function materialOptions(sites) {
  return [...new Set(sites.flatMap((s) => s.materials))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/** LOC-13. Only records with a pin go on the map. */
export function mapSites(sites) {
  return sites.filter((s) => s.pin && Number.isFinite(s.pin.lat) && Number.isFinite(s.pin.lng));
}

/** The `case` query values from the Dispose hand-off: "<stream>|<if text>". */
export function parseCases(values) {
  const out = [];
  for (const v of values) {
    const i = v.indexOf('|');
    if (i < 1) continue;
    out.push({ stream: v.slice(0, i), if: v.slice(i + 1) });
  }
  return out;
}

/**
 * G19: for a conditional answer, one group per case. A case that ends in a special drop-off or a deposit return
 * lists the sites for the cited rules; any other case names its stream and lists no site.
 */
export function groupByCase(cases, sites) {
  return cases.map((c) => ({ ...c, sites: SPECIAL.has(c.stream) ? sites : [], needsSite: SPECIAL.has(c.stream) }));
}

/** The view to open: map unless view=list. */
export function viewFrom(value) {
  return value === 'list' ? 'list' : 'map';
}
