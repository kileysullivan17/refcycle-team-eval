// Fixture packs and CSV for the locator tests. Nothing here depends on the real data.
import type { Pack } from '../../../engine/code/src/rules.ts';
import { parseFacilities, type SiteData } from '../../src/features/locator/sites.ts';

const base = { destination_inferred: false, verified_by_ks: true };

function rule(id: string, extra: Record<string, unknown>) {
  return { id, applies_to: [`${id} item one`, `${id} item two`], stream: 'drop_off_special', conditions: null, prep: [], where: null, source: 'src-1', quote: 'q', ...base, ...extra };
}

export function fixturePack(placeId = 'fix_a'): Pack {
  return {
    jurisdiction: { id: placeId, name: 'Fixture Place', system_summary: 's', official_contact_url: `https://example.org/${placeId}/official` },
    sources: [
      { id: 'src-1', kind: 'official_page', title: 'Official', url: 'https://example.org/page', publisher: 'p', page_date: '2026-08-08', retrieved: '2026-09-10' },
      { id: 'src-2', kind: 'field_report', title: 'Phone', url: null, publisher: 'p', page_date: null, retrieved: '2026-11-04', observed: '2026-11-03 (phone call)' },
      { id: 'src-3', kind: 'superseded', title: 'Old', url: 'https://example.org/old', publisher: 'p', page_date: '2018-12-01', retrieved: '2026-09-10' },
      { id: 'src-4', kind: 'field_observation', title: 'Visit', url: null, publisher: 'p', page_date: null, retrieved: '2026-09-10', observed: '2026-07 (approximate)' },
    ],
    rules: [
      rule('r-official', { where: 'Take it to the Fixture Transfer Station. Fee $16 per load, limit 4 tires per load.', source: 'src-1' }),
      rule('r-limited', { where: 'A private recycler. This location only.', location_limited: true, source: 'src-2' }),
      rule('r-silent', { where: null, source: 'src-1' }),
      rule('r-old', { where: 'Stale place from an old page', source: 'src-3' }),
      rule('r-obs', { where: 'Seen on a visit', source: 'src-4' }),
      rule('r-text-only', { where: 'Pack describes a place but no record exists', source: 'src-1' }),
      rule('r-howto', { where: 'Set out by the cart', source: 'src-1' }),
      rule('r-cat', { where: 'Bins at select stations', source: 'src-1' }),
      rule('r-event', { where: 'Events', source: 'src-1' }),
    ],
  } as unknown as Pack;
}

export const FIXTURE_CSV = `facility_id,place,name,type,materials,address,lat,lng,source_url,source_label,date_checked,rule_ids,notes,internal_notes
f-1,fix_a,Zeta Pinned Station,transfer_station,tires; batteries,"1 Main St, Fixture",47.5,-122.3,https://example.org/zeta,,2026-11-05,r-official,"$16 per load, 4 tires max.",SECRET-INTERNAL-ONE
f-2,fix_a,alpha unpinned depot,city_dropoff,tires,2 Side St,,,https://example.org/alpha,,2026-10-31,r-official,By appointment.,SECRET-INTERNAL-TWO
f-3,fix_a,Beta half pinned,reuse_center,paint,3 Half St,47.6,,https://example.org/beta,,2026-10-31,r-official;r-obs,,
f-4,fix_a,A private recycler (limited),private_recycler,clear bottles,withheld (private pack),,,,"phone report, 2026-11-03",2026-11-03,r-limited,This location only.,
f-5,fix_a,Tire companies (category),tire_company,tires,"withheld (pack lists four)",47.7,-122.4,https://example.org/tires,,2026-10-31,r-official,Call first.,
f-6,fix_a,Curbside pickup,how_to,batteries,,,,https://example.org/curb,,2026-09-10,r-howto,Fee applies.,
f-7,fix_a,Select station bins,category,metal,not listed in the pack,,,https://example.org/bins,,2026-09-10,r-cat,,
f-8,fix_a,Event: Spring,hhw_event,paint,location to be announced,,,https://example.org/events,,2026-09-10,r-event,Tentative 2027-03-06.,
f-9,fix_a,Event: February,hhw_event,paint,location to be announced,,,https://example.org/events,,2026-09-10,r-event,"Tentative February 2027, date TBD.",
f-10,fix_a,Unlinked record,city_dropoff,tires,4 Hidden St,47.5,-122.3,,,,,Never shown.,
f-11,fix_b,Other place station,transfer_station,tires,9 Other St,30.2,-97.7,,,2026-10-31,r-official,Other.,
f-12,fix_a,Old page site,city_dropoff,tires,5 Old St,,,,,,r-old,Should not be served.,
`;

export function fixtureData(): SiteData {
  const packs = new Map<string, Pack>();
  packs.set('fix_a', fixturePack('fix_a'));
  packs.set('fix_b', fixturePack('fix_b'));
  return { packs, facilities: parseFacilities(FIXTURE_CSV) };
}
