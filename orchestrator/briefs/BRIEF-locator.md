# Builder brief: Recycling center locator

Status: Approved by Kiley Sullivan, 2026-11-05, for the scored team run. Builds to
`orchestrator/CONTRACTS.md` v1.3 (final, including design tokens).

You are one of three builders working in parallel, each in its own git worktree, on branch
`scored/locator`. This brief is your whole assignment. Read it in full before you write anything, then
read the files it tells you to read. If this brief and the contracts disagree, the contracts win; raise it
as a change request (section 10).

**Your run.** You run on Sonnet 5.5. You have no model-provider keys and must not ask for any: every test
uses a fake engine or a fake provider. The orchestrator runs the live end-to-end check at merge. You may
install packages from the npm registry with `npm ci`.

## 1. The product in two paragraphs

RefCycle is a phone-width web app that tells a resident where an item goes in their place: Seattle, WA;
Austin, TX; or Hawaiʻi County, HI. RefCycle began as a student concept by a five-person team in the
Berkeley UX/UI Boot Camp, UC Berkeley Extension, January 2024. This rebuild is solo work by Kiley
Sullivan, the product owner.

Every recycling answer comes from an existing engine, `POST /api/ask`, which answers only from a
read-only rules pack per place. No part of the app writes, infers or hardcodes a recycling rule. A
confident wrong answer is the worst failure: when the app cannot tell, it asks or says it does not know.

## 2. Your slice

You build **the Recycling center locator**: where to take an item in the selected place, as a list and a
map, with a detail screen per site. It opens two ways: from the item page's Dispose button with the rule
ids the engine cited, or from the Locations tab with no item, showing every site for the place. Your data
comes only from the rules packs (`where`, `location_limited`, sources) and `engine/data/facilities.csv`.
You own `GET /api/sites` and the Locations screens. You do **not** build the item page, the engine call or
the app shell: the Recyclopedia builder builds those in parallel. You build against CONTRACTS.md section
2.1.

## 3. Read first

1. `orchestrator/PRD.md` (v2, approved). Your requirements are quoted in section 4 below.
2. `orchestrator/CONTRACTS.md` (v1.3): sections 1, 2 (including 2.1), 6, 7, 9, 10, 11 and 12. Skim 3 and
   8 so you know what the item page passes you and reads from you.
3. `engine/rules/_FORMAT.md`, the three packs in `engine/rules/`, `engine/data/facilities.csv` and
   `engine/code/src/rules.ts` (all read-only). The packs load unchanged with the engine's `loadPacks`.

Do not open, list or search anything under these paths: `/home/claude/refcycle-private`,
`/home/claude/refcycle-eval`, `/home/claude/refcycle-team-build`, `/home/claude/refcycle-wt`,
`/home/claude/refcycle-scored/baseline`, and `engine/code/eval/` in your worktree. Do not read engine logs.
Your acceptance checks come from the PRD and the contracts, not from any answer key or other build.

## 4. Requirements you own (quoted from PRD v2)

- **LOC-1.** The locator has a map view and a list view of the same sites, switched with the Map and List
  buttons.
- **LOC-2.** Every site shown comes from the selected place's pack (a rule's `where`, or a source the pack
  cites). No other directory, search provider or design mock data is used.
- **LOC-3.** Private businesses appear only by the pack's public description, never by business name.
  This includes the business named in the `where` field of hc-oil-015.
- **LOC-4.** When opened for an item, the locator shows only the sites named by the rules the engine cited
  for that item (`rule_ids` in the response). It reads `where` and `location_limited` from the pack by
  those `rule_ids`, read-only; the engine is unchanged.
- **LOC-5.** When a cited rule is `location_limited: true`, the locator shows that single site and states
  that it is the only place that takes the item.
- **LOC-6.** Each site shows the conditions the pack states for it, as written in the pack: appointment
  needed, fees, limits, "call first", accepted forms (for example Austin's Recycle and Reuse Center "by
  appointment"; Seattle tires "$16 per load, limit 4 tires per load"; Hawaiʻi County #2 plastics "bottles
  and jugs only: no caps or tubs").
- **LOC-7.** Site information that rests on a `field_observation` or `field_report` source says so and
  gives its date.
- **LOC-8.** No site information comes from a `superseded` source.
- **LOC-9.** A site's detail screen lists only items whose pack rules send them to that site.
- **LOC-10.** The locator shows only the site fields the pack provides. Ratings, review counts, hours,
  phone numbers and distances that appear in the Figma frames are not shown unless the pack gives them.
- **LOC-11.** When the item's answer is `abstain`, or the cited rule names no site, the locator says the
  pack does not name a place for this item and links the official source.
- **LOC-12.** Opened with no item chosen, the locator lists every site for the selected place.
- **LOC-13.** Addresses and map pins come only from pack text and the official pages the packs cite. No
  geocoder is used. A site without a sourced address is listed but gets no map pin.
- **LOC-14.** The locator uses no device location. Sites are sorted by name and no distances are shown.
- **LOC-15.** Destinations without a single address (curbside, scheduled pickup, retail stores, library
  branches) show as "how to" entries with the instruction and its source, with no address and no pin.
- **LOC-16.** A set of sites the pack does not list one by one (for example scrap metal bins at select
  transfer stations, the 14 HI-5 redemption centers) shows as one category entry with the pack's wording
  and a source link.
- **LOC-17.** A dated event shows labeled "tentative", with its source and the date checked. After the
  event's last date it shows "check the source for the next event".
- **LOC-18.** The Filter control on the map and list filters sites by material accepted.
- **CON-2.** From an item page whose answer sends the item to a site outside the regular streams, the
  Dispose button opens the locator for that item (LOC-4). (The item page builder places the button; you
  build what it opens.)

Contract details that refine these (CONTRACTS.md sections 6 and 7): the CSV `rule_ids` column is the
only link between rules and sites; records with an empty `rule_ids` are never shown; only `notes` is
shown, never `internal_notes`; a record gets a pin only when both `lat` and `lng` are filled, and records
without a pin appear in the list only; OpenStreetMap tiles with attribution; a conditional answer's sites
are grouped by cited rule; field sources show their kind and date ("phone report, 2026-11-03"); the
February events end 2027-02-28; `RuleWhere` carries `applies_to`, and the response carries
`official_source`.

Shared requirements that bind your screens:

- **X-2.** Wherever the app shows the Hawaiʻi place name, it displays "Hawaiʻi County". (Use
  `ctx.displayText` on every string from a pack or the CSV; CONTRACTS.md section 9.)
- **X-8.** No screen names a private business that a pack withholds by name; it shows the pack's public
  description.
- **X-12.** The app is a web app laid out for phone width, built on the same TypeScript stack as the
  engine.

## 5. Files and folders you may create or change

Only these (CONTRACTS.md section 2.1). Anything else is another builder's or read-only.

| Path | What |
|---|---|
| `app/src/features/locator/**` | `routes.ts` (`GET /api/sites`), `sites.ts` (pack and CSV reading) |
| `app/src/features/locator/dev/**` | a local harness to run your screens before merge |
| `app/public/features/locator/**` | `screens.js`, its stylesheet, and `vendor/` with Leaflet 1.9.4 |
| `app/test/locator/**` | your tests and fixtures |
| `app/docs/locator.md` | your build notes and final report |

Provided in the base commit, read-only for every builder: `app/package.json`, `app/package-lock.json`,
`app/tsconfig.json`, `app/.env.example`, the root `.gitignore`, `SCORED-RUN.md`, the whole of `engine/`
(code, rules packs and `engine/data/facilities.csv`), `orchestrator/` (except your own change-request
files), and `specs/`. If you need another dependency, a script change or a data fix, file a change request
(section 10).

## 6. Interfaces you build against

Fixed in CONTRACTS.md sections 2.1, 6 and 7. Change them only through a change request.

- **Server:** `app/src/features/locator/routes.ts` exports `handle(req, res, url): Promise<boolean>`,
  `true` only for `GET /api/sites`. `app/src/features/locator/sites.ts` loads the packs with `loadPacks`
  imported read-only from `engine/code/src/rules.ts`, pointed at `engine/rules`, and the CSV with
  `csv-parse`. If loading fails, respond 500 `{ "error": "Site data could not be loaded" }` and log the
  detail on the server only.
- **Response:** `{ rules: RuleWhere[], sites: Facility[], official_source }` exactly as CONTRACTS 6 and
  7.2. `rule_ids` absent means every linked site for the place (LOC-12); present but empty means no cited
  rules (LOC-11). The item page also calls this route to show `rules[].where`, so `rules` must be right
  even when `sites` is empty.
- **Client:** `app/public/features/locator/screens.js` exports `mount(route, container, ctx)` for
  `/locations` and `/locations/:facilityId`, with query parameters `view` (`list` default, or `map`),
  `item`, `rule_ids`, `material`. Plain ES module, no build step, no CDN. Use only the six `ctx` members in
  section 2.1; pass every pack and CSV string through `ctx.displayText`. Return a cleanup function that
  removes the map.
- **What the item page passes you:** Dispose opens `/locations?item=<query>&rule_ids=<ids>`, only for
  `answer` and `conditional` answers, never during a `clarify`.
- **Map library:** copy Leaflet 1.9.4's `dist/` files from `app/node_modules/leaflet/dist/` into
  `app/public/features/locator/vendor/` and load them from there (the server does not serve
  `node_modules`). Load Leaflet only when at least one shown record has a pin.
- **Styles:** use the CSS custom properties of CONTRACTS 11 only; they are defined by the shared
  `tokens.css`. Your dev harness defines its own copy of every token it uses (including the type tokens)
  inside your own `dev/` folder.

## 6b. Common rules for tests and styles (all builders)

These hold for all three slices, so the merged tree stays green:

1. **Test files** end in `.test.ts` and live under your own `app/test/<slice>/` (or `app/test/shared/` for
   the shell). Run them with a glob, for example `node --import tsx --test "test/locator/**/*.test.ts"`;
   a bare folder path does not work with this Node version. `npm test` runs every slice's tests.
2. **Every commit is green**: `npm run check` and your tests pass at every milestone commit, not only the
   last one.
3. **No test depends on what another slice has or has not built.** Before merge the other slices' files do
   not exist; after merge they do. A test that needs "a module that is missing" uses a path that will never
   exist, such as `/features/not-a-feature/screens.js`.
4. **No test depends on facts about the data that can change**, such as how many facility records exist
   or which ones have coordinates. Test each state (pins, no pins, an event before and after its date, an
   unknown type) on fixtures you build in your test folder; test the real packs and the real CSV only for
   invariants (they load, links resolve, every record fits the schema).
5. **Source scans** (tests that read files to check for forbidden code or text) scan only code you own or
   the shell owns, and skip any `vendor/` folder: vendored third-party code (Leaflet 1.9.4) is approved
   as it is. The approved external URLs are `https://tile.openstreetmap.org` and
   `https://www.openstreetmap.org/copyright` (CONTRACTS 7.4).
6. **Styles** (CONTRACTS 11): every color, font family, radius, font size and spacing value goes through
   the tokens in `app/public/shared/tokens.css`. Font sizes use `var(--type-<style>-size)`. Spacing
   (margin, padding, gap, inset) is a multiple of 4px written through `--space-unit`, for example
   `calc(var(--space-unit) / 2)`. Px are allowed only for border and outline widths and element sizes.
   No San Marino (`--color-blue`) text or links on a Wheatfield (`--color-sand`) background: set text and
   links in ink there. Text on the red card is ink, bold (700) and at least 19px.
7. **Logs** (`logs/*.jsonl`) are written under `app/logs/`, which git ignores. Tests write logs to a
   temporary folder, never to `app/logs/`.
8. Insert every engine, pack or CSV string with `textContent`, never as HTML.

## 7. How to run and test

1. Once per worktree: `cd engine/code && npm ci`, then `cd app && npm ci`.
2. Tests: `cd app && node --import tsx --test "test/locator/**/*.test.ts"`. Typecheck: `npm run check`. No
   model provider is needed. Test invariants on the real packs and the real CSV (read-only); test each
   state on your own fixture CSV and fixture pack in `app/test/locator/` (a record with and without a
   pin, an unknown type, a superseded source, an event before and after its last date, a rule with no
   `where` and no record). Inject the clock for event dates and a fake Leaflet for the map.
3. Screens before merge: run your harness in `app/src/features/locator/dev/`, which serves your
   `screens.js` with a fake `ctx`.

Milestones, each ending with a green commit: M1 `sites.ts` and `GET /api/sites`; M2 list view with all
four kinds and the filter; M3 detail screen; M4 map view and the no-pins state; M5 hand-back
(`app/docs/locator.md`).

## 8. Acceptance checks (each an automated test where it can be)

1. `GET /api/sites?place=<id>` returns every record for that place with a non-empty `rule_ids`, sorted by
   name case-insensitively, never a record with an empty `rule_ids` (LOC-12, LOC-14).
2. No response contains `internal_notes` or its text.
3. With `rule_ids`, `sites` holds exactly the records whose `rule_ids` include one of them, and `rules`
   holds one `RuleWhere` per id from that place's pack (with `applies_to`); an id from another place's
   pack returns nothing. Every response has `official_source` with the pack's `official_contact_url`
   (LOC-2, LOC-4, LOC-11).
4. `rule_ids=hc-plastic-011` returns only f-hc-06 with `only_site: true`, and the screen states it is the
   only place that takes the item; same for hc-plastic-012 and f-hc-07 (LOC-5).
5. Field sources show their kind and date; f-hc-06 and f-hc-07 show "phone report, 2026-11-03" (LOC-7).
6. A fixture rule whose source is `superseded` is never read (LOC-8).
7. `material=<value>` returns only records whose materials include it (LOC-18).
8. Kinds follow CONTRACTS 7.2: `how_to` and `category` records show name, notes and source with no
   address and no pin; an unknown `type` fails loudly at load (LOC-15, LOC-16).
9. Address rule: "withheld ..." and "not listed ..." are hidden; "location to be announced" is shown
   (LOC-13).
10. Events show "Tentative", notes, "checked <date>" and the source link; with the clock after
    `event_last_date` they show "Check the source for the next event"; on the last date itself they are
    still tentative (LOC-17).
11. Map, on fixtures: with no pinned records it shows "No mapped locations yet; see the list" and the List
    button, and loads no map library; with pinned records it shows a marker for each pinned record only,
    OpenStreetMap tiles from `tile.openstreetmap.org` with the attribution in CONTRACTS 7.4, and a note
    when some records have no pin (LOC-1, LOC-13).
12. List and map show the same records and switch with the Map and List buttons (LOC-1).
13. Real CSV invariants: every record's `rule_ids` resolve in its place's pack; every record with `lat` or
    `lng` has both, as valid numbers in range and inside its place (Seattle, Austin or Hawaiʻi County);
    the served `pin` matches the CSV.
14. No screen shows ratings, review counts, distances or any field the CSV and packs do not give; no
    geolocation call (LOC-10, LOC-14).
15. hc-oil-015's `where` text and p-hc-04 never show "Big Island Biodiesel" on screen (LOC-3, X-8).
16. A rule with `where: null` and no linked record, or an empty `rule_ids`, shows "The rules for this place
    don't name a place for this item" with the official source link (LOC-11).
17. A conditional request lists sites grouped under each cited rule (G19).
18. The detail screen lists, for each rule linked to the site, that rule's `applies_to` items from the
    place's pack, through `ctx.displayText`, and nothing from rules not linked to it (LOC-9).
19. Styles meet section 6b rule 6; in particular links inside a Wheatfield box are ink. Layout works from
    320 px to 430 px.

## 9. Must not

- Edit anything outside section 5's paths, including `engine/` data, the shell and the item page.
- Add, rename or "fix" a facility, a coordinate or a link in code; data changes go through a change
  request.
- Show a business name a pack withholds, or "Big Island Biodiesel".
- Use a geocoder, a places or directory service, device location, ratings or distances.
- Show `also_acceptable` routes.
- Call any network service; the browser loads only OpenStreetMap tiles from outside the app.
- Read anything under the forbidden paths in section 3, or tune anything to an answer key.
- Guess when the contract is unclear. Raise a change request instead.
- Merge, rebase onto other branches, or push.
- Use em dashes in any file you write.

## 10. Change requests

If a contract is wrong, unclear or missing, stop that piece of work and write
`orchestrator/change-requests/CR-locator-<NNN>-<short-name>.md` (the only file you may create outside
section 5) with: your slice, the date, the contract section, what it says, the problem with evidence
(test output, file and line), your proposed change, and which other slices it affects. Carry on with
other work while you wait. The orchestrator replies in the same file: a clarification it decides, or a
change that goes to Kiley. Until a change is approved, build to CONTRACTS.md v1.3. Never patch a pack, the
facility CSV or the engine to make a test pass.

## 11. Hand back

Your branch with one commit per milestone, every commit green, and `app/docs/locator.md` holding your final
report: milestones and commit hashes; the result of `npm run check` and `npm test`; each acceptance check
in section 8 marked pass, fail or not testable, with how it was tested; your decisions where the contracts
left a choice; the change requests you filed; anything you could not do. Your final message is the same
report.
