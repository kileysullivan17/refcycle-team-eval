# Builder brief: Recyclopedia (and the shared app shell)

Status: Approved by Kiley Sullivan, 2026-11-05, for the scored team run. Builds to
`orchestrator/CONTRACTS.md` v1.3 (final, including design tokens).

You are one of three builders working in parallel, each in its own git worktree, on branch
`scored/recyclopedia`. This brief is your whole assignment. Read it in full before you write anything, then
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

You build **the Recyclopedia** (browse and search a catalog of materials, open an item page with the
engine's answer for the selected place) and **the shared app shell** that the other two builders plug
into: the app server, the place picker, the header, the tab bar, the shared item page, `displayText`, and
`tokens.css` with the bundled fonts. The Camera scan and Locator builders build against CONTRACTS.md
section 2.1 without your code, so your shell must match it exactly.

## 3. Read first

1. `orchestrator/PRD.md` (v2, approved). Your requirements are quoted in section 4 below.
2. `orchestrator/CONTRACTS.md` (v1.3): sections 1, 2 (including 2.1), 3, 5, 8, 9, 10, 11 and 12. Skim 4,
   6 and 7 so you know what the other slices serve.
3. `engine/code/src/contract.ts` and `engine/code/src/rules.ts` (read-only) for the exact schemas.

Do not open, list or search anything under these paths: `/home/claude/refcycle-private`,
`/home/claude/refcycle-eval`, `/home/claude/refcycle-team-build`, `/home/claude/refcycle-wt`,
`/home/claude/refcycle-scored/baseline`, and `engine/code/eval/` in your worktree. Do not read engine logs.
Your acceptance checks come from the PRD and the contracts, not from any answer key or other build.

## 4. Requirements you own (quoted from PRD v2)

Shared:

- **X-1.** The resident selects one place from exactly three: Seattle, WA; Austin, TX; Hawaiʻi County, HI.
  The list comes from `GET /api/jurisdictions`. No other place is offered. A place picker appears on
  first use and in the header; the choice is remembered on the device. There is no default place and no
  device location is used to choose it.
- **X-2.** Wherever the app shows the Hawaiʻi place name, it displays "Hawaiʻi County", although the pack
  and the jurisdictions endpoint name it "County of Hawaiʻi, HI". The swap replaces only "County of
  Hawaiʻi" or "County of Hawaii" with "Hawaiʻi County", happens at display time, and is logged. Every
  other word stays as the engine returned it. (CONTRACTS.md section 9 extends the swap to every spelling of
  the county name and to one business name; implement section 9.)
- **X-3.** Every recycling answer (stream, prep, explanation, rule ids, sources) comes from
  `POST /api/ask` with the selected place's `jurisdiction` id. No feature stores, writes, infers or
  hardcodes a stream, prep step or rule.
- **X-4.** Each feature renders all four engine behaviors: `answer` (stream, prep, explanation, source
  link); `clarify` (the engine's one question, an input for the reply, then a new request); `conditional`
  (each `if` case with its stream); `abstain` (a clear "we don't know" state with the official source
  link).
- **X-5.** The explanation is shown as the engine returns it, without additions or edits other than the
  place-name swap in X-2, so that a named site (location-limited rules) and the source date of a field
  observation or field report reach the resident.
- **X-6.** When the behavior is `abstain` or `clarify`, no feature shows a verdict, card color or stream
  for the item. A feature never turns an abstention into a guess.
- **X-7.** If the engine returns HTTP 400 or cannot be reached, the feature says it has no answer and does
  not fall back to any other content.
- **X-9.** The selected place is shared by all three features; changing it re-requests any answer on
  screen.
- **X-10.** Verdict cards keep the Figma colors and map to streams as follows: blue flag for
  `recycle_bin`, `compost_bin` and `deposit_return`; yellow card for `garbage`; red card for
  `drop_off_special`. `clarify`, `conditional` and `abstain` show a neutral "referee check" state with no
  card. Card copy names the stream; the words "Score!" and "Hazardous" are not used.
- **X-11.** The item page title is the engine's `item_interpreted`. No brand or model names are shown.
- **X-12.** The app is a web app laid out for phone width, built on the same TypeScript stack as the
  engine.
- **X-13.** No feature treats a rule differently because of its `verified_by_ks` or
  `destination_inferred` value.
- **CON-1.** Recyclopedia and Camera scan open the same item page, which shows the engine's response.
- **CON-3.** One selected place drives all three features (X-9).

Recyclopedia:

- **RC-1.** The landing screen shows material categories as cards, in the Figma card layout. The
  categories and entries are those of the approved catalog: one entry per material group that the rules
  packs cover in at least one place.
- **RC-2.** Selecting a category opens a material page listing that category's catalog entries.
- **RC-3.** A search box on the landing and material pages filters entries as the resident types; typing
  "Plastic" lists the plastic entries.
- **RC-4.** Selecting an entry opens its item page. A material entry sends the material name to the
  engine as the `query`, and the item page shows the engine's response for the selected place, per X-4
  and X-5. In a place with no coverage for the entry, the page shows "we don't know".
- **RC-5.** The item page's verdict card is driven only by the engine's `behavior` and `stream` for the
  selected place, never by a fixed label per material.
- **RC-6.** The item page shows no recycling guidance other than the engine's output. Static text in the
  Figma frames that states a disposal rule (for example "they must be recycled at specialized facilities"
  on Item page - Plastic #2) is not carried over as written.
- **RC-7.** When an entry's answer is `conditional` (for example a resin number whose stream depends on
  form or deposit status), the item page lists every case with its stream, and does not pick one.
  Conditional answers to material entries are expected.
- **RC-8.** The item page shows no "How long to decompose" or "Percentage recycled annually" figures.
- **RC-9.** Search text that matches no catalog entry is sent to the engine as a free question, and the
  result opens on the item page.

You also build the Dispose button on the item page (CONTRACTS.md section 8), which links to the Locator's
route; the Locator builder builds what it opens.

## 5. Files and folders you may create or change

Only these (CONTRACTS.md section 2.1). Anything else is another builder's or read-only.

| Path | What |
|---|---|
| `app/src/server.ts` | app server: own routes, static files, dynamic feature loading |
| `app/src/shared/**` | server helpers (forwarding, JSONL logging) |
| `app/src/features/recyclopedia/**` | `GET /api/catalog` |
| `app/data/catalog.json` | the approved catalog, exactly CONTRACTS.md section 5.3 |
| `app/public/index.html` | the single page |
| `app/public/shared/**` | router, header, place picker, tab bar, item page, `displayText`, `tokens.css`, fonts, icons |
| `app/public/features/recyclopedia/**` | Recyclopedia screens |
| `app/test/shared/**`, `app/test/recyclopedia/**` | your tests and fixtures |
| `app/docs/recyclopedia.md` | your build notes and final report |
| `app/README.md` | how to run the app |

Provided in the base commit, read-only for every builder: `app/package.json`, `app/package-lock.json`,
`app/tsconfig.json`, `app/.env.example`, the root `.gitignore`, `SCORED-RUN.md`, the whole of `engine/`
(code, rules packs and `engine/data/facilities.csv`), `orchestrator/` (except your own change-request
files), and `specs/`. If you need another dependency, a script change or a data fix, file a change request
(section 10).

## 6. Interfaces the other builders rely on

All of CONTRACTS.md section 2.1, exactly: the path table, `handle(req, res, url)` modules loaded with
dynamic `import()` in the order recyclopedia, camera-scan, locator (a missing module is skipped), the
client router and `mount(route, container, ctx)` with an optional cleanup return, the six `ctx` members,
the "not available yet" message for a missing or failing module, and the hand-off routes. Points that
matter at merge:

- Unknown paths, including a missing `/features/<x>/screens.js`, return 404 JSON, not `index.html`, so a
  missing module fails its `import()`.
- The router calls a screen's cleanup function before the next mount, and keeps one loaded instance of
  each feature module across that feature's routes.
- The server does not serve `node_modules`. The Locator vendors Leaflet in its own folder.
- Security headers may restrict sources to the app itself, but must allow images from
  `https://tile.openstreetmap.org`, `blob:` and `data:` images and media (camera preview and uploads), and
  inline styles that Leaflet sets.
- The item page calls `GET /api/sites?place=<id>&rule_ids=<ids>` for `answer` and `conditional` and shows
  each `rules[].where` (G5). On a 404 or any failure it hides that block and shows everything else.
- `tokens.css` defines every token in CONTRACTS 11, including the type tokens and `--type-card-red-size`
  and `--type-card-red-weight`. The red card uses them (bold MuseoModerno: bundle a real 700 face, not only
  400, so the bold is not synthesized).

## 6b. Common rules for tests and styles (all builders)

These hold for all three slices, so the merged tree stays green:

1. **Test files** end in `.test.ts` and live under your own `app/test/<slice>/` (or `app/test/shared/` for
   the shell). Run them with a glob, for example `node --import tsx --test "test/recyclopedia/**/*.test.ts"`;
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
2. Tests: `cd app && node --import tsx --test "test/shared/**/*.test.ts" "test/recyclopedia/**/*.test.ts"`.
   Typecheck: `npm run check`. Use a fake engine: a local HTTP server on a free port that returns fixture
   responses, each validated with the engine's own `AnswerSchema` (import from
   `engine/code/src/contract.ts`). Write the fixtures by hand from CONTRACTS.md section 3, one per display
   state. Do not start the real engine: it needs keys you do not have.
3. Manual run: start your fake engine, set `ENGINE_URL` to it, `cd app && npm run dev` (port 3001), and
   open http://127.0.0.1:3001 at 320 and 430 px width.

Milestones, each ending with a green commit: M1 shell (server, forwarding, router, picker, header, tab
bar); M2 catalog and search; M3 item page and all display states; M4 `displayText`, logging, tokens and
fonts; M5 hand-back (`app/docs/recyclopedia.md`, `app/README.md`).

## 8. Acceptance checks (each an automated test where it can be)

1. `GET /api/jurisdictions` and `POST /api/ask` through port 3001 return exactly what the engine returns,
   including HTTP 400 bodies; an unreachable engine gives the item page's `error` state (CONTRACTS 2, 3).
2. First visit with no stored place shows the picker with exactly the three places, "Hawaiʻi County, HI"
   displayed; nothing preselected; no geolocation call; the choice is stored in `localStorage` key
   `refcycle.place` and survives reload (X-1).
3. Changing the place in the header re-requests the answer on screen (X-9).
4. `GET /api/catalog` returns the 10 categories of CONTRACTS 5.2 in order (no Textiles) and the 50 entries
   of 5.3, field for field; every `query` equals `name` (RC-1, RC-2).
5. Category cards are plain (no photographs); a category page lists only its entries (RC-2).
6. Typing "plastic" lists exactly the entries whose name contains "plastic", case-insensitive (13,
   including "Wax, plastic or foil coated paper"); text matching no entry opens the item page with that
   text as `query` (RC-3, RC-9).
7. Selecting an entry sends its `query` and the stored place to `/api/ask` (RC-4).
8. One fixture per state renders exactly the state in CONTRACTS 8: blue for `recycle_bin`, `compost_bin`,
   `deposit_return`; yellow for `garbage`; red for `drop_off_special`; no card for `clarify`,
   `conditional`, `abstain`, `loading`, `error`. Each card shows its stream label text (X-10, RC-5).
9. `conditional` lists every case with its `if` text and stream label (RC-7). `clarify` sends the
   original query, a space and the reply as one new query (G20).
10. `abstain` shows "We don't know" and the official source link (X-4, RC-4).
11. HTTP 400, network failure and the 150 second timeout show the `error` state with Retry and nothing else
    (X-7). The timeout may be tested with a shortened value; assert the 150 s constant separately.
12. The title is `item_interpreted` after `displayText`, or the query as sent when it is null (X-11, G14).
13. No rendered page contains "Score!", "Hazardous", "decompose" or "Percentage recycled", or any disposal
    text not from the engine (X-10, RC-6, RC-8).
14. Upcycle is absent; Dispose appears exactly as CONTRACTS 8 says and opens
    `/locations?item=<query>&rule_ids=<ids>`.
15. `displayText`: each county-name spelling in CONTRACTS 9 outside “ ” becomes "Hawaiʻi County"; the same
    text inside “ ” is unchanged; "Big Island Biodiesel" becomes "a local biodiesel company"; each
    replacement writes one log line through `POST /api/log/display-swap`; nothing else changes (X-2, X-5).
16. Engine text is inserted with `textContent`; no client file uses `innerHTML`, `outerHTML`,
    `insertAdjacentHTML`, `document.write` or `eval`.
17. Tokens: `tokens.css` holds every CONTRACTS 11 token with its value; the red card text resolves to ink,
    weight 700 or more and 19px or more, and nothing inside the card overrides it; no San Marino text or
    link on Wheatfield; MuseoModerno has a 700 face. Layout works from 320 px to 430 px with no
    horizontal scroll.
18. A missing camera-scan or locator module shows "This part of RefCycle is not available yet"; the server
    returns 404 for `/features/not-a-feature/screens.js`.

## 9. Must not

- Edit anything outside section 5's paths.
- Write, infer or hardcode any stream, prep step, rule or disposal text (X-3), or decide a card from the
  catalog's `covered_in` (G4).
- Show a business name a pack withholds, or "Big Island Biodiesel".
- Call any network service except the engine; load nothing in the browser from outside the app except
  OpenStreetMap tiles.
- Use device location, store photos, or add accounts, sharing, upcycling, history or onboarding.
- Read anything under the forbidden paths in section 3, or tune anything to an answer key.
- Guess when the contract is unclear. Raise a change request instead.
- Merge, rebase onto other branches, or push.
- Use em dashes in any file you write.

## 10. Change requests

If a contract is wrong, unclear or missing, stop that piece of work and write
`orchestrator/change-requests/CR-recyclopedia-<NNN>-<short-name>.md` (the only file you may create outside
section 5) with: your slice, the date, the contract section, what it says, the problem with evidence
(test output, file and line), your proposed change, and which other slices it affects. Carry on with
other work while you wait. The orchestrator replies in the same file: a clarification it decides, or a
change that goes to Kiley. Until a change is approved, build to CONTRACTS.md v1.3. Never patch a pack, the
facility CSV or the engine to make a test pass.

## 11. Hand back

Your branch with one commit per milestone, every commit green, and `app/docs/recyclopedia.md` holding your final
report: milestones and commit hashes; the result of `npm run check` and `npm test`; each acceptance check
in section 8 marked pass, fail or not testable, with how it was tested; your decisions where the contracts
left a choice; the change requests you filed; anything you could not do. Your final message is the same
report.
