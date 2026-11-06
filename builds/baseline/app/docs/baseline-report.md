# Baseline build report

Solo build of all three features (Recyclopedia and shell, Camera scan, Recycling center locator) against `orchestrator/PRD.md` v2 and `orchestrator/CONTRACTS.md` v1.3, on branch `scored-base`. No sub-agents were used. Nothing was pushed.

## Commits

| Hash | What |
|---|---|
| `c96a6b8` | App server, catalog, `/api/sites` and `/api/identify` with tests; bundled fonts and Leaflet |
| `06b8dfa` | Client shell, item page, Recyclopedia, camera scan and locator screens; unit and style tests |
| `775b463` | Browser tests, API client tests, docs and decisions record |
| (this report) | `app/docs/baseline-report.md`, committed last; its own hash is not listed here |

`npm run check` and `npm test` passed at each of the three commits above.

## Results (in `app/`)

- `npm run check`: passes (no output errors).
- `npm test`: 134 tests, 134 pass, 0 fail, 0 skipped. This includes 33 browser tests (Chrome through `playwright-core`, fake camera, fake engine, fake image provider). They skip with a message where Chrome is not found.
- Run against the real packs and facility list for invariants only (they load, every rule link resolves, every record fits the schema). All state tests use fixtures built in `app/test/`.
- A manual start with `npm run dev` served the shell, the catalog and real `/api/sites` data; the engine was not running, so `/api/jurisdictions` returned the 502 `{ "error": "The engine could not be reached" }`.

## Requirements

All ids are implemented unless noted. "Implemented" means built and covered by a test on fixtures or a fake engine.

| Id | Status | Note |
|---|---|---|
| X-1 | implemented | Place picker on first use and in the header; list from `/api/jurisdictions`; `refcycle.place`; no default, no location |
| X-2 | implemented | `displayText`; every county-name spelling outside quoted lines; logged |
| X-3 | implemented | Every answer from `POST /api/ask`; no client rule, stream or prep text (source scan) |
| X-4 | implemented | answer, clarify (reply box, new request), conditional, abstain in the shared item page |
| X-5 | implemented | Explanation is `textContent`, only `displayText` applied |
| X-6 | implemented | No card, color or stream on abstain, clarify; conditional shows case streams as text only |
| X-7 | implemented | 400, network failure, timeout (150 s) and malformed responses show "No answer available right now" |
| X-8 | implemented | Public descriptions only; hc-oil-015 business replaced |
| X-9 | implemented | Item page and locator re-request on place change (locator: decision D2) |
| X-10 | implemented | Blue, yellow, red cards; neutral referee check; no "Score!" or "Hazardous" |
| X-11 | implemented | Title is `item_interpreted`, else the query (G14) |
| X-12 | implemented | Phone-width web app on the engine's stack; checked at 320 px |
| X-13 | implemented | `verified_by_ks` and `destination_inferred` are never read |
| RC-1 | implemented | 10 plain category cards from the approved 50-entry catalog (test compares to CONTRACTS 5.3) |
| RC-2 | implemented | Material page |
| RC-3 | implemented | Live filter on landing and material page; results screen |
| RC-4 | implemented | Entry name sent as `query`; abstain shows "We don't know" |
| RC-5 | implemented | Card from `behavior` and `stream` only |
| RC-6 | implemented | No static rule text |
| RC-7 | implemented | Every case listed, none picked |
| RC-8 | implemented | No decomposition or recycled-percent figures |
| RC-9 | implemented | Unmatched text goes to the engine, result on the item page |
| CS-1 | partly implemented | Viewfinder, Identify, Photos, Snap Tips, close, flip, flash. Flash is disabled when the device reports no torch (so on most desktops) |
| CS-2 | partly implemented | Identification works against a fake provider and a fake `fetch`; never run against a real provider. The app has its own adapter for the same two providers rather than the engine's pack-based adapter (D5) |
| CS-3 | implemented | Same item page |
| CS-4 | implemented | Only `status`, `label`, `candidates` survive; tested |
| CS-5 | implemented | Unclear or failed identification asks to retake or type; engine not called |
| CS-6 | implemented | The photo path passes the engine's clarify or conditional answer on unchanged |
| CS-7 | implemented | `multiple` asks which one |
| CS-8 | implemented | "We think this is: <label>. Is that right?" with Yes, Edit (K2) |
| CS-9 | implemented | Denied or missing camera shows photo upload |
| CS-10 | implemented | Photo in memory for the call, not stored, not logged (tested) |
| LOC-1 | implemented | Map and List of the same sites |
| LOC-2 | implemented | Only pack-linked records from `facilities.csv` |
| LOC-3 | implemented | Descriptions only; business name swapped |
| LOC-4 | implemented | Item mode shows only records linked to the cited `rule_ids` |
| LOC-5 | implemented | "This is the only place that takes this item." |
| LOC-6 | implemented | CSV notes and the cited rules' `where` text as written |
| LOC-7 | implemented | Field observation or report note with its date |
| LOC-8 | implemented | Superseded-source rules never read |
| LOC-9 | implemented | Detail lists each linked rule's `applies_to` (Gate 3 #8) |
| LOC-10 | implemented | Only pack and CSV fields; no ratings, hours, phones or distances |
| LOC-11 | implemented | Message plus official source link |
| LOC-12 | implemented | No item: every site for the place |
| LOC-13 | implemented | Pins only from the CSV; none for categories or how-tos; no geocoder. Which records have a pin depends on the CSV |
| LOC-14 | implemented | Sorted by name; no location |
| LOC-15 | implemented | How-to entries without address or pin |
| LOC-16 | implemented | Category entries with the pack wording and source link |
| LOC-17 | implemented | Tentative, then "Check the source for the next event" (tested before and after) |
| LOC-18 | implemented | Material filter on map and list |
| CON-1 | implemented | One item page for Recyclopedia, search and Camera scan |
| CON-2 | implemented | Dispose opens the locator for the item |
| CON-3 | implemented | One selected place for all three |

## Questions and choices recorded

Full text in `app/docs/DECISIONS-baseline.md` (D1 to D17). The ones that matter most:

- D1: conditional answers carry their cases to the locator as optional `case=` parameters so it can group by case (G19); only drop-off and deposit cases list sites.
- D2: the locator re-asks the engine when the place changes while it shows an item.
- D3: `/api/sites` behavior for unknown place (400), empty versus missing `rule_ids`, and when `only_site` is set.
- D4: packs load on first `/api/sites` request, not at startup.
- D5: `/api/identify` edge cases, and the app's own image adapter.
- D6: the locator opens on the map.
- D9: events after their last date drop the stale note.
- D10: the SVG namespace string in `icons.js` is allowed by the source scan.

## Could not do

- No live check: no provider key and no engine run, so `/api/ask` forwarding was tested against a fake engine only, and identification against a fake provider only.
- OpenStreetMap tiles were blocked in the browser tests (only the app server is reachable), so tile loading and the look of a real map were not checked. Pins, attribution and popups were.
- No visual check on a physical phone. Screenshots from headless Chrome at 430 px and 320 px were reviewed by eye for the landing, item, map, list and scan screens only.
- The coordinator's addendum asked for no test to depend on data facts; the real-data tests check invariants only. I did not test the Austin K1 fix separately beyond the real packs loading.
