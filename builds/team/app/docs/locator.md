# Recycling center locator: build notes and final report

Builder: locator, branch `scored/locator`, built to CONTRACTS.md v1.3 and BRIEF-locator.md. No model
provider was used or needed. Every test uses fixtures, a fake DOM, a fake `fetch` and a fake Leaflet.

## What was built

| Path | What |
|---|---|
| `app/src/features/locator/sites.ts` | Reads the packs with the engine's `loadPacks` (read-only) and `engine/data/facilities.csv` with `csv-parse`; `querySites` builds the `/api/sites` response |
| `app/src/features/locator/routes.ts` | `handle(req, res, url)`: `GET /api/sites?place=&rule_ids=&material=`; 500 `{ "error": "Site data could not be loaded" }` on a load failure, detail only in the server log |
| `app/public/features/locator/screens.js` | `mount(route, container, ctx)` for `/locations` (list, map, filter) and `/locations/:facilityId` |
| `app/public/features/locator/locator.css` | Styles, tokens only |
| `app/public/features/locator/vendor/` | Leaflet 1.9.4 `dist/` (js, css, images, map, LICENSE), loaded only when a shown record has a pin |
| `app/src/features/locator/dev/` | Dev harness: `server.ts` (port 3011), `index.html`, `harness.js`, `tokens.css` (its own copy of the tokens) |
| `app/test/locator/` | Seven test files and fixtures, a small fake DOM (the project has no jsdom) |

Run the harness with `cd app && node --import tsx src/features/locator/dev/server.ts`, then open
`http://127.0.0.1:3011/locations`.

## Milestones

| Milestone | Commit | Content |
|---|---|---|
| M1 | 8055fcc | `sites.ts`, `GET /api/sites`, server and data tests |
| M2 | 7341d7d | List view, all four kinds, material filter |
| M3 | 07d4bda | Facility detail screen |
| M4 | 532e2ff | Map view, no-pins state, dev harness, style and source scans, real-data screen tests |
| M5 | the commit that adds this file | Notes, final CSS spacing polish, change requests |

## Results

- `cd app && npm run check`: passes (no errors).
- `cd app && npm test`: 82 tests, 82 pass, 0 fail (the locator's tests only; no other slice exists in this worktree).
- Every milestone commit had `npm run check` and the locator tests green.
- Visual check in headless Chrome against the dev harness at 320 px and 430 px: list, map, item with a
  location-limited rule, conditional grouping, detail screens. No horizontal scroll; text wraps. OpenStreetMap
  tiles could not load in the sandbox (no outbound access), so the tile images themselves were not seen; the
  tile URL and attribution are asserted in tests.

## Acceptance checks (brief section 8)

| # | Result | How tested |
|---|---|---|
| 1 | pass | `sites.test.ts` (fixture: all linked records, empty `rule_ids` never shown, sorted case-insensitively), `routes.test.ts` (HTTP, real data for each place), real-data sort check |
| 2 | pass | `sites.test.ts`: serialized responses contain neither `internal_notes` nor the fixture's internal text; real CSV: no "Coordinates entered by KS" text in any response |
| 3 | pass | `sites.test.ts`, `routes.test.ts`: exact sites for given rule ids, one `RuleWhere` per id with `applies_to`, a rule id from another place returns nothing, `official_source` always the pack's `official_contact_url` |
| 4 | pass | `sites.test.ts` and `routes.test.ts` on real data (`hc-plastic-011` gives only f-hc-06 with `only_site: true`, same for `hc-plastic-012` and f-hc-07); `real.test.ts` and `list.test.ts`: screen says "The only place that takes this item" |
| 5 | pass | Real data: f-hc-06 and f-hc-07 carry "phone report, 2026-11-03", shown as "Source: phone report, 2026-11-03" (`real.test.ts`, `list.test.ts`, `detail.test.ts`) |
| 6 | pass | `sites.test.ts`: a fixture rule on a `superseded` source is never read, and a record linked only to such a rule is not served; `detail.test.ts`: such a record is not found. Real packs cannot hold one (`loadPacks` rejects it); tested too |
| 7 | pass | `sites.test.ts`, `routes.test.ts` (`material=paint`), `list.test.ts` and `map.test.ts` (filter control) |
| 8 | pass | `sites.test.ts` (kinds, no pin for `how_to` and `category`, unknown type throws at load), `list.test.ts` and `detail.test.ts` (no address, notes and source link shown) |
| 9 | pass | `sites.test.ts` (address rule), `list.test.ts` ("location to be announced" shown; "withheld" and "not listed" never shown) |
| 10 | pass | `list.test.ts` and `detail.test.ts` with the clock injected: tentative, notes, "checked <date>", source link; on the last date still tentative; the day after, "Check the source for the next event" with the link and the stale notes hidden; real CSV last dates equal CONTRACTS 7.3 |
| 11 | pass | `map.test.ts` with a fake Leaflet: no pins gives "No mapped locations yet; see the list", the List button and zero library loads; with pins one marker per pinned record, tile URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution link to `https://www.openstreetmap.org/copyright`, and the "no map pin" note |
| 12 | pass | `map.test.ts`: Map and List buttons switch in place over the same record set; leaving the map removes it |
| 13 | pass | `sites.test.ts` on the real CSV: every `rule_ids` resolves in its place's pack; `lat` and `lng` both filled or both empty, numbers in range and inside Seattle, Austin or Hawaiʻi County boxes; served `pin` equals the CSV |
| 14 | pass | `static.test.ts` (no geolocation, no ratings, reviews, distances or geocoder in code; only approved external URLs; client fetches only `/api/sites`), `list.test.ts` (no such fields on screen) |
| 15 | pass | `real.test.ts`: no screen for any place, any facility detail, any rule's item view, or either view shows "Big Island Biodiesel"; hc-oil-015 shows "a local biodiesel company" |
| 16 | pass | `list.test.ts`: `where: null` with no record, an empty `rule_ids`, and a rule on a superseded source all show "The rules for this place don't name a place for this item" with the official link |
| 17 | pass | `list.test.ts`: with two or more cited rules, sites are grouped under each rule, a rule with no site says so |
| 18 | pass | `detail.test.ts`: the `applies_to` items of each linked rule are shown, nothing from other rules |
| 19 | pass | `static.test.ts`: no literal colors; font sizes are `var(--type-*-size)`; spacing is a multiple of 4px through `--space-unit`; px only for borders and element sizes; sand boxes and links are ink; every token used is defined in the harness copy. Visual check at 320 px and 430 px |

## Decisions where the contracts left a choice

1. `rules` is `[]` when `rule_ids` is absent (the contract defines `rules` per cited id). The detail screen
   makes two calls: all sites for the place (to find the record), then `rule_ids=<the record's rule ids>` (to get
   the linked rules and `only_site`).
2. Missing or unknown `place` returns 400 `{ "error": ... }`. Only `GET /api/sites` is handled; other methods
   return `false`.
3. Sort is by lower-cased name (code-unit order), ties by `facility_id`. `material` matches exactly.
4. Only `site` and `event` records can carry a pin; `category` and `how_to` never do, even if coordinates
   were entered. A non-numeric or out-of-range coordinate throws at load, like an unknown type.
5. A record whose every `rule_ids` entry points to a rule on a `superseded` source is not served at all
   (LOC-8). Real data has none.
6. `event_last_date` is read from the record's notes (CR-locator-002, clarification requested).
7. `source_date` is passed as the pack writes it (`observed`, else `page_date`, else `retrieved`); the screen
   shows its leading date. A record with a `source_label` shows "Source: <label>"; otherwise a linked
   field-source rule adds "Based on a field report (or observation) dated <date>; not a published page."
8. Map and List switch and filter changes happen in place (so the map is not rebuilt needlessly) and keep
   the URL in sync with `history.replaceState`. Only `view`, `item`, `rule_ids` and `material` are used.
9. With two or more cited rules the list is grouped by rule; the group title is the rule's first three
   `applies_to` items ("and N more" beyond that). With one cited rule, its `where` text shows in a Wheatfield box.
10. A cited rule with `where` text but no linked record shows the pack's wording and the official link,
    not the "does not name a place" message (the pack does describe a place).
11. Place change while opened for an item sends the resident to `/item?q=<item>&origin=search` (the rule ids
    belong to the old place); with no item it reloads; the detail screen returns to `/locations`.
12. `mount` returns the cleanup function synchronously; `cleanup.settled()` resolves when the current render
    is done (used by tests). `hooks` (clock, Leaflet loader) is exported for tests.
13. All links on the locator are ink; blue is used only for the toggle and button fills and borders.
14. Leaflet's own "Leaflet" prefix is off; the visible attribution is the OpenStreetMap one.
15. The screens render each pack or CSV string as a text node after `ctx.displayText`; the surface names
    look like `locator.list.name`.

## Change requests filed

- `orchestrator/change-requests/CR-locator-001-detail-service-rule.md`: the detail screen for `p-hc-01` lists
  "curbside pickup" because `hc-system-000` is linked to it. Built to the contract until decided.
- `orchestrator/change-requests/CR-locator-002-event-last-date-source.md`: where `event_last_date` comes from.
  Clarification requested; the build matches CONTRACTS 7.3 on the real CSV.

## What was not done or not testable here

- The real shell, router and `tokens.css` are another builder's; the screens were run only in the dev harness
  and a fake DOM. Merge-time check needed: the shell passes `route.params.facilityId` (the screens also read it
  from `route.path`), and `tokens.css` defines every token listed in `dev/tokens.css`.
- OpenStreetMap tile loading was not seen (no outbound access in the sandbox).
- Fonts are not bundled by this slice; the harness falls back to system fonts.
