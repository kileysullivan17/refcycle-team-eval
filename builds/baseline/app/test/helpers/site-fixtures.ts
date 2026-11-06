import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** A tiny rules pack and facility list built for tests, so no assertion depends on the real data. */
export const packFor = (id: string, name: string) => `
jurisdiction:
  id: ${id}
  name: "${name}"
  system_summary: "Test."
  official_contact_url: "https://example.org/official/${id}"
sources:
  - { id: s1, kind: official_page, title: "Page", url: "https://example.org/p", publisher: "Pub", page_date: 2026-01-02, retrieved: 2026-02-03 }
  - { id: s2, kind: field_observation, title: "Seen", url: null, publisher: "Pub", page_date: null, observed: 2026-03-04, retrieved: 2026-03-05 }
  - { id: s3, kind: superseded, title: "Old", url: "https://example.org/old", publisher: "Pub", page_date: 2018-01-01, retrieved: 2026-02-03 }
rules:
  - { id: t-1, applies_to: ["tires"], stream: drop_off_special, prep: [], where: "North station, $16 per load", source: s1, quote: "q", verified_by_ks: true }
  - { id: t-2, applies_to: ["clear bottles"], stream: drop_off_special, prep: [], where: "A private recycler. This location only.", location_limited: true, source: s2, quote: "q", verified_by_ks: true }
  - { id: t-3, applies_to: ["paper"], stream: recycle_bin, prep: [], where: null, source: s1, quote: "q", verified_by_ks: true }
  - { id: t-5, applies_to: ["mystery"], stream: drop_off_special, prep: [], where: null, source: s1, quote: "q", verified_by_ks: true }
  - { id: t-4, applies_to: ["oil"], stream: drop_off_special, prep: [], where: "Big Island Biodiesel accepts oil", source: s1, quote: "q", verified_by_ks: true }
`;
export const FIXTURE_PACK = packFor('test_place', 'Test Place');

const HEADER = 'facility_id,place,name,type,materials,address,lat,lng,source_url,source_label,date_checked,rule_ids,notes,internal_notes\n';
export const FIXTURE_ROWS = [
  'f-1,test_place,Beta Station,transfer_station,tires; batteries,"1 Main St",47.5,-122.3,https://example.org/p,,2026-11-05,t-1,"$16 per load","secret internal"',
  'f-2,test_place,alpha depot,city_dropoff,tires,"2 Side St",,,https://example.org/p,,2026-11-05,t-1;t-3,By appointment.,',
  'f-3,test_place,A private recycler,private_recycler,clear bottles,withheld (private pack),,,,"phone report, 2026-11-03",2026-11-03,t-2,This location only.,',
  'f-4,test_place,Retail stores,retail_dropoff_unnamed,bags,not listed by the city,48.0,-122.0,https://example.org/p,,2026-09-10,t-3,,',
  'f-5,test_place,Collection event,hhw_event,oil,location to be announced,,,https://example.org/p,,2026-09-10,t-4,Tentative February 2027,',
  'f-hc-03,test_place,Waimea event,hhw_event,oil,Waimea District Park,20.01,-155.67,https://example.org/p,,2026-09-10,t-4,Tentative 2027-03-06.,',
  'f-6,test_place,Unlinked place,site,tires,"3 Far Rd",1,1,,,,,,',
  'f-7,other_place,Other,site,tires,"3 Far Rd",1,1,,,,t-1,,',
];

export async function writeSiteFixtures(rows: string[] = FIXTURE_ROWS, pack = FIXTURE_PACK) {
  const dir = await mkdtemp(path.join(tmpdir(), 'refcycle-sites-'));
  const rulesDir = path.join(dir, 'rules');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(rulesDir);
  await writeFile(path.join(rulesDir, 'test_place.yaml'), pack);
  await writeFile(path.join(rulesDir, 'other_place.yaml'), packFor('other_place', 'Other Place'));
  const csv = path.join(dir, 'facilities.csv');
  await writeFile(csv, HEADER + rows.join('\n') + '\n');
  return { dir, rulesDir, csv };
}
