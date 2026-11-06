# RefCycle rebuild: shared contracts (v1.3)

Status: Approved by Kiley Sullivan, 2026-11-05 (gate 2; gate 3 decisions 4 and 7; post-merge decisions K1
to K5; design tokens approved as final 2026-11-05). Design tokens are final (section 11).

Version 1.3 makes the design tokens final, records the Figma Components page read (G16 done) and the new
Figma source file, and adds a contrast rule (section 11). Version 1.2 folded in the post-merge decisions in `orchestrator/MERGE-DECISIONS.md`: the Austin pack fix (K1,
section 6), the confirm wording (K2, sections 4 and 10), type-scale token names (K3, section 11), spacing in
multiples of 4px (K4, section 11), and two added `/api/sites` fields (K5, section 6).

Version 1.1 adds the workspace layout and the interfaces between slices (section 2.1, Gate 3 #7) and
settles how provisional tokens are used (section 11, Gate 3 #4), from `orchestrator/GATE3-DECISIONS.md`.
The v1.0 text is otherwise unchanged. Version 1.0 folded in the product owner's answers to the 21 gate 2 questions
(`orchestrator/CONTRACTS-DECISIONS.md`, G0 to G20). The v0.1 draft is kept as
`orchestrator/CONTRACTS-v0.1-draft.md`. Each change from v0.1 cites its G#.

Every builder follows these contracts. A builder who needs one changed uses the change-request process in
section 12; nobody edits this file, the engine, the rules packs, the facility list or the catalog
directly. Requirement ids (X-, RC-, CS-, LOC-, CON-) refer to `orchestrator/PRD.md` v2.

Sources: `PRD.md` v2, `PRD-DECISIONS.md` (Q1 to Q25), `CONTRACTS-DECISIONS.md` (G0 to G20); the pinned
engine at `engine/code` (Build B, `PINNED.md`: refcycle-b commit 486bf17, M5); `engine/rules/`
(read-only); `engine/data/facilities.csv`; Figma: from v1.3 the source is Kiley's re-imported Pro-team copy,
file key `ikM9P253MTdZnskq3ol665` (read only). Earlier versions cite node ids from the original file
`Xm6zxibJrl0tgP7l1db7NP` (pages "Hi-Fi Wireframes (Second Iteration)" and "Style"); frame names are the
same in both.

---

## 1. Places

| id | Engine name (`GET /api/jurisdictions`) | Display name | Official source (pack `official_contact_url`) |
|---|---|---|---|
| `seattle_wa` | Seattle, WA | Seattle, WA | https://www.seattle.gov/utilities/your-services/collection-and-disposal/where-does-it-go |
| `austin_tx` | Austin, TX | Austin, TX | https://www.austintexas.gov/recycling |
| `hawaii_county_hi` | County of Hawaiʻi, HI | Hawaiʻi County, HI | https://www.hawaiizerowaste.org/recycle/drop-off/ |

- The place list is read from `GET /api/jurisdictions` at startup, not hardcoded; the display name is the
  engine name after the swap in section 9. (X-1, X-2)
- Picker: shown on first use and in the header on every screen. The chosen id is stored on the device in
  `localStorage` key `refcycle.place` (string id). No default; no device location. If the stored id is
  not in the jurisdictions list, the picker shows again. (Q1)
- Every engine call, catalog view and locator view uses the stored id. Changing it re-requests what is on
  screen. (X-9)

## 2. System layout (G1)

A TypeScript app (Node 20 or later, same stack as the engine: Node `http`, Zod, `tsx`; Q22) in `app/`
serves the phone-width web UI and its own API on `127.0.0.1:3001`. It forwards `POST /api/ask` and
`GET /api/jurisdictions` unchanged to the pinned engine on `127.0.0.1:3000` (`engine/code`, started with
`npm run dev`). The engine code, its rules packs and its request log stay unchanged (Q11, G1). The app
imports nothing from `engine/code` except, read-only, `loadPacks` and the `Pack` and `Rule` types from
`engine/code/src/rules.ts`, and `loadEnv` from `engine/code/src/config.ts`.

### 2.1 Workspace layout and interfaces between slices (Gate 3 #7)

Three builders work in separate git worktrees. Each owns only its paths:

| Path | Owner |
|---|---|
| `app/src/server.ts`, `app/src/shared/**`, `app/src/features/recyclopedia/**`, `app/data/catalog.json`, `app/public/index.html`, `app/public/shared/**`, `app/public/features/recyclopedia/**`, `app/test/shared/**`, `app/test/recyclopedia/**`, `app/docs/recyclopedia.md`, `app/README.md` | Recyclopedia builder (also the shared shell) |
| `app/src/features/camera-scan/**`, `app/public/features/camera-scan/**`, `app/test/camera-scan/**`, `app/docs/camera-scan.md` | Camera scan builder |
| `app/src/features/locator/**`, `app/public/features/locator/**`, `app/test/locator/**`, `app/docs/locator.md` | Locator builder |
| `orchestrator/change-requests/CR-<feature>-*.md` | each builder, its own files only |
| `app/package.json`, `app/package-lock.json`, `app/tsconfig.json`, `app/.env.example`, `.gitignore`, `engine/**`, `orchestrator/**` (other files), `specs/**` | read-only for all builders (base commit) |

**Server feature modules.** Each slice exports, from `app/src/features/<feature>/routes.ts`:

```ts
export function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean>;
```

It returns `true` only for a request it handled. `app/src/server.ts` loads the three modules with dynamic
`import()` at startup, in the order recyclopedia, camera-scan, locator, and skips any module that is
missing. It handles its own routes first (`GET /api/jurisdictions` and `POST /api/ask` forwarded to
`ENGINE_URL`, default `http://127.0.0.1:3000`; `POST /api/log/display-swap`; static files from
`app/public/`), then asks each loaded module in order. Any client route in section 10 returns
`app/public/index.html`; any other unhandled request returns 404 `{ "error": "Not found" }`.

**Client screen modules.** The client is plain ES modules served as static files, with no build step and
no CDN. The shell's router loads, with dynamic `import()`:

| Routes | Module | Owner |
|---|---|---|
| `/`, `/place`, `/item` | `app/public/shared/*.js` | Recyclopedia builder |
| `/recyclopedia`, `/recyclopedia/:categoryId`, `/search` | `app/public/features/recyclopedia/screens.js` | Recyclopedia builder |
| `/scan`, `/scan/confirm` | `app/public/features/camera-scan/screens.js` | Camera scan builder |
| `/locations`, `/locations/:facilityId` | `app/public/features/locator/screens.js` | Locator builder |

Each `screens.js` exports `mount(route, container, ctx)`, where `route` is `{ path, params, query }`
(`query` is an object of decoded string values) and `container` is the element to render into. It may
return a cleanup function, which the router calls before the next mount. If a module is missing or fails
to load, the router shows "This part of RefCycle is not available yet".

**Shared `ctx`** (built by the shell; feature modules use only these):

| Member | Type | Meaning |
|---|---|---|
| `ctx.place` | string | the stored place id |
| `ctx.places` | `{ id, name }[]` | from `/api/jurisdictions`, names already passed through `displayText` |
| `ctx.displayText` | `(text, surface) => string` | section 9 |
| `ctx.navigate` | `(path) => void` | client-side navigation |
| `ctx.setTitle` | `(text) => void` | header title |
| `ctx.onPlaceChange` | `(callback) => unsubscribe` | X-9 |

**Hand-offs.** Catalog entries open `/item?entry=<id>`; search opens `/item?q=<text>&origin=search`;
Camera scan opens `/item?q=<confirmed label>&origin=scan` and never calls `/api/ask` itself; Dispose
opens `/locations?item=<query>&rule_ids=<comma-separated ids>`. The item page calls
`GET /api/sites?place=<id>&rule_ids=<ids>` for the `where` text and hides that block if the route
returns 404 (before the locator slice is merged).

| Route | Owner | Purpose |
|---|---|---|
| `GET /api/jurisdictions` | engine (forwarded) | Section 1 |
| `POST /api/ask` | engine (forwarded) | Section 3 |
| `POST /api/identify` | app | Section 4 |
| `GET /api/catalog` | app | Section 5 |
| `GET /api/sites` | app | Sections 6 and 7 |
| `POST /api/log/display-swap` | app | Section 9 |

The app server makes no network calls except to the engine and, for `/api/identify`, the configured
image-model provider. The browser loads map tiles from OpenStreetMap (section 7.4, G10) and nothing else
from outside the app: fonts, icons and any map library are served by the app (G15). Secrets stay in
`.env`.

## 3. Engine call: `POST /api/ask` (as pinned, unchanged)

Request (Zod `AskRequest`, strict): `Content-Type: application/json`, body at most 16,384 bytes.

```json
{ "jurisdiction": "<place id>", "query": "<1 to 2000 characters after trim>" }
```

Extra keys, a missing or empty field, invalid JSON or a wrong content type return HTTP 400
`{ "error": "..." }`. Anything else returns 200 with all of these keys (Zod `AnswerSchema`, strict):

| Key | Type | Rule |
|---|---|---|
| `jurisdiction` | string | the requested id |
| `item_interpreted` | string or null | may be null on `abstain` |
| `behavior` | `answer`, `abstain`, `clarify`, `conditional` | |
| `stream` | stream enum or null | non-null only when `behavior` is `answer` |
| `conditions` | list of `{ if, stream }` or null | non-null only for `conditional`; at least 2 cases |
| `clarifying_question` | string or null | non-null only for `clarify` |
| `prep` | string list | empty on `clarify` |
| `explanation` | string | never empty; see below |
| `rule_ids` | string list | at least one for `answer` and `conditional`; empty on `abstain` |
| `source_urls` | URL list | at least the place's official source |
| `model` | string | `provider/model` actually used |

Streams: `recycle_bin`, `compost_bin`, `garbage`, `drop_off_special`, `deposit_return`.

Facts about the pinned engine that callers rely on (from `src/agent.ts`, `src/server.ts`):

- `explanation` is assembled from the pack, one block per cited rule, separated by a blank line:
  `<rule_id>: [Field report|Field observation] dated <date>; not a published page. [inference note]
  “<quote>” [“<destination quote>”] [Where: <where>]`. Text between the curly quotes “ and ” is a quoted
  source line. Render the explanation as plain text (`textContent`), keep the line breaks, and apply only
  `displayText` (section 9). (X-5)
- An unsupported place id returns 200 `abstain` naming the supported places.
- A provider failure returns 200 `abstain` with the explanation "We could not produce a verified answer
  from the local rules. Please try again or check the official source." The UI shows it like any
  abstention (X-6).
- The engine can take two provider attempts of up to 60 seconds each. Client timeout: 150 seconds, then
  the `error` state (section 8).
- Clarify flow (G20): the engine keeps no conversation state. The UI sends a new request whose `query` is
  the original query, a space, and the resident's reply.

## 4. Identification: `POST /api/identify` (app)

Implements CS-2, CS-4 to CS-10 with an image model through the engine's provider adapters (Q7), using a
separate image-model setting that defaults to Sonnet 5.5 (G2):

| Variable | Default | Meaning |
|---|---|---|
| `LLM_IMAGE_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `LLM_IMAGE_MODEL` | `claude-sonnet-5-5` | exact model id for identification |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | none | the key for `LLM_IMAGE_PROVIDER`, as in the engine's `.env` |

Temperature 0 where the provider accepts it; log the exact model string on every call.

Request: `Content-Type: application/json`, `{ "image": "data:image/<jpeg|png|webp>;base64,..." }`. The
decoded image is at most 5 MB and must be JPEG, PNG or WebP; otherwise HTTP 400 (G2). The client may
downscale before sending.

Response 200:

```json
{ "status": "identified", "label": "plastic milk jug", "candidates": [], "model": "provider/model" }
```

| Field | Rule |
|---|---|
| `status` | `identified` (one item, clear), `unclear` (cannot tell), `multiple` (more than one item) |
| `label` | generic item name, no brand or model names (Q10), at most 120 characters; null unless `identified` |
| `candidates` | for `multiple`: up to 4 generic item names; otherwise empty |
| `model` | `provider/model` used |

- The model instruction asks only what the item is. The response must not contain a stream, verdict,
  recyclability claim or disposal advice; the app drops any such field (CS-4).
- UI: `identified` shows "We think this is: <label>. Is that right?" with Yes and Edit (CS-8, K2). `multiple` asks which one, from
  the candidates or typed (CS-7). `unclear` asks to retake or type the item (CS-5). Only a confirmed or
  typed label goes to `POST /api/ask` as `query`.
- Provider error or timeout: HTTP 502 `{ "error": "..." }`; the UI offers retake or typing (CS-5).
- Photos are held in memory for the call only: never written to disk, never logged, never sent anywhere
  but the provider (CS-10, Q9). The app log `logs/identify.jsonl` records time, status, label, model and
  duration only.
- Camera access denied or unavailable: the scan screen shows photo upload (`<input type="file"
  accept="image/jpeg,image/png,image/webp">`) instead of the viewfinder (CS-9).

## 5. Recyclopedia catalog (approved, G3)

### 5.1 Schema

`GET /api/catalog` returns `{ "categories": Category[], "entries": Entry[] }`, built from a static file
`app/data/catalog.json` that holds exactly the approved list below.

```ts
type Category = { id: string; name: string; order: number };
type Entry = {
  id: string;            // slug, stable
  category: string;      // Category.id
  name: string;          // display name
  query: string;         // sent to POST /api/ask; equals name (Q6)
  rule_ids: string[];    // pack rules the entry maps to
  covered_in: string[];  // place ids with at least one mapped rule
};
```

- An entry opens the item page by sending `query` to the engine (RC-4, Q6). The page always shows the
  engine's response. `rule_ids` and `covered_in` document coverage and drive no answer; when they and
  the engine disagree, the engine's answer is shown (X-3, G4).
- Search (RC-3) matches typed text against entry `name`, case-insensitive substring. Text that matches no
  entry is sent to the engine as typed (RC-9, Q5).
- Category cards are plain cards with the category name, no photographs (G18).

### 5.2 Categories

Figma card order (F: Recyclopedia 820:3856). Textiles is dropped: no pack rule covers textiles (Q4, G3).

| order | id | name |
|---|---|---|
| 1 | batteries | Batteries |
| 2 | biodegradable | Biodegradable |
| 3 | electronics | Electronics |
| 4 | glass | Glass |
| 5 | metal | Metal |
| 6 | paper | Paper |
| 7 | plastic | Plastic |
| 8 | rubber | Rubber |
| 9 | wood | Wood |
| 10 | miscellaneous | Miscellaneous |

### 5.3 Entries (50, approved G3)

One entry per material group that the packs cover in at least one place (Q4). Every pack rule maps to at
least one entry except `hc-system-000` (curbside pickup in Hawaiʻi County), which is a service, not a
material. The seven resin-number entries follow the Figma Plastic page and overlap the form-based plastic
entries. Coverage: SEA = `seattle_wa`, ATX = `austin_tx`, HC = `hawaii_county_hi`.

| Category | id | name (= query) | rule_ids | covered_in |
|---|---|---|---|---|
| batteries | batteries | Batteries | sea-special-017, sea-special-018, atx-special-017, hc-hhw-010 | SEA, ATX, HC |
| batteries | battery-toys | Battery-operated toys | atx-special-010 | ATX |
| biodegradable | food-scraps | Food scraps | sea-compost-006, atx-compost-013, hc-green-009 | SEA, ATX, HC |
| biodegradable | coffee-tea | Coffee grounds, filters and tea bags | sea-compost-020, atx-compost-013, atx-compost-014 | SEA, ATX |
| biodegradable | yard-trimmings | Yard trimmings, leaves and branches | sea-compost-007, atx-compost-015, hc-green-008 | SEA, ATX, HC |
| biodegradable | compostable-packaging | Compostable bags and food packaging | sea-compost-008 | SEA |
| electronics | electronics | Electronics | sea-special-018, atx-special-018 | SEA, ATX |
| electronics | bulbs-fluorescent | Fluorescent bulbs and CFLs | sea-special-018, hc-hhw-010 | SEA, HC |
| electronics | bulbs-incandescent-led | Incandescent and LED bulbs | sea-garbage-016, hc-hhw-016 | SEA, HC |
| electronics | smoke-detectors | Smoke detectors | hc-hhw-010 | HC |
| glass | glass-bottles-jars | Glass bottles and jars | sea-glass-014, atx-glass-012, hc-glass-004, hc-deposit-005 | SEA, ATX, HC |
| metal | metal-cans | Aluminum, steel and tin cans | sea-metal-013, atx-metal-011, atx-metal-020, hc-metal-007, hc-deposit-005 | SEA, ATX, HC |
| metal | metal-foil-pans | Aluminum foil and foil pans | sea-metal-013, atx-metal-011, hc-metal-013 | SEA, ATX, HC |
| metal | metal-scrap | Scrap metal | sea-metal-013 | SEA |
| metal | metal-gas-cylinders | Propane and compressed gas cylinders | hc-hhw-010, hc-hhw-018 | HC |
| paper | paper-cardboard | Cardboard | sea-paper-002, atx-paper-003, hc-paper-001 | SEA, ATX, HC |
| paper | paper-greasy-cardboard | Greasy, oil-stained or food-soiled cardboard | sea-garbage-023, atx-garbage-024, hc-paper-002 | SEA, ATX, HC |
| paper | paper-pizza-boxes | Pizza boxes | sea-paper-004, sea-compost-005, atx-compost-014, hc-paper-002 | SEA, ATX, HC |
| paper | paper-mixed | Mixed paper, mail, magazines and newspaper | sea-paper-001, atx-paper-001, atx-paper-019, hc-paper-003 | SEA, ATX, HC |
| paper | paper-bags | Paper bags | sea-paper-001, sea-compost-019, atx-compost-014, hc-paper-001 | SEA, ATX, HC |
| paper | paper-boxboard | Boxboard and paperboard boxes | sea-paper-003, atx-paper-001, hc-paper-003 | SEA, ATX, HC |
| paper | paper-cartons | Milk, juice and aseptic cartons | sea-paper-003, atx-paper-002, hc-paper-003 | SEA, ATX, HC |
| paper | paper-cups-plates | Paper cups, plates and take-out containers | sea-paper-001, atx-paper-002, atx-compost-014, hc-paper-003 | SEA, ATX, HC |
| paper | paper-towels-napkins | Paper towels, napkins and tissues | sea-compost-005, atx-compost-014, hc-paper-003 | SEA, ATX, HC |
| paper | paper-shredded | Shredded paper | atx-compost-016, hc-paper-003 | ATX, HC |
| paper | paper-coated-foil | Wax, plastic or foil coated paper | hc-paper-003 | HC |
| plastic | plastic-1 | Plastic #1 PET | sea-plastic-009, hc-plastic-006, hc-plastic-011 | SEA, HC |
| plastic | plastic-2 | Plastic #2 HDPE | sea-plastic-009, hc-plastic-006, hc-plastic-012 | SEA, HC |
| plastic | plastic-3 | Plastic #3 PVC | sea-plastic-009, sea-plastic-011, hc-plastic-006 | SEA, HC |
| plastic | plastic-4 | Plastic #4 LDPE | sea-plastic-009, hc-plastic-006 | SEA, HC |
| plastic | plastic-5 | Plastic #5 PP | sea-plastic-009, hc-plastic-006 | SEA, HC |
| plastic | plastic-6 | Plastic #6 PS | sea-plastic-009, hc-plastic-006 | SEA, HC |
| plastic | plastic-7 | Plastic #7 Other | sea-plastic-009, hc-plastic-006 | SEA, HC |
| plastic | plastic-bottles-jugs | Plastic bottles and jugs | sea-plastic-009, atx-plastic-004, hc-plastic-006, hc-plastic-011, hc-plastic-012, hc-deposit-005 | SEA, ATX, HC |
| plastic | plastic-tubs-containers | Plastic tubs, cups and food containers | sea-plastic-010, atx-plastic-005, hc-plastic-006 | SEA, ATX, HC |
| plastic | plastic-bags-film | Plastic bags, wrap and film | sea-plastic-012, atx-plastic-008, hc-plastic-006 | SEA, ATX, HC |
| plastic | plastic-foam | Styrofoam | atx-foam-009 | ATX |
| plastic | plastic-rigid-household | Rigid household plastics (buckets, baskets, furniture, toys, plant pots) | sea-plastic-011, atx-plastic-006, hc-plastic-006 | SEA, ATX, HC |
| plastic | plastic-small-items | Straws, plastic utensils and small plastic items | atx-plastic-007, hc-plastic-006 | ATX, HC |
| plastic | plastic-medicine-bottles | Pill and medicine bottles | sea-plastic-011, atx-plastic-021, hc-plastic-006 | SEA, ATX, HC |
| plastic | plastic-bottle-caps | Bottle caps and lids | sea-plastic-010, atx-plastic-004, atx-plastic-007, atx-glass-012, hc-glass-004, hc-metal-007, hc-deposit-014 | SEA, ATX, HC |
| rubber | tires | Tires | sea-special-024, atx-special-023, hc-tires-019 | SEA, ATX, HC |
| wood | wood-untreated | Untreated wood, pallets and wood scraps | atx-compost-016, hc-green-008 | ATX, HC |
| miscellaneous | hi5-containers | HI-5 deposit beverage containers | hc-deposit-005, hc-deposit-014 | HC |
| miscellaneous | motor-oil-fluids | Motor oil and automotive fluids | sea-special-021, atx-special-022, hc-hhw-010 | SEA, ATX, HC |
| miscellaneous | cooking-oil | Used cooking oil | sea-special-021, hc-oil-015 | SEA, HC |
| miscellaneous | paint | Paint | sea-special-022, hc-hhw-010, hc-hhw-017 | SEA, HC |
| miscellaneous | household-chemicals | Household chemicals, pesticides and poisons | sea-special-022, hc-hhw-010 | SEA, HC |
| miscellaneous | medicines-sharps | Medicines and syringes | sea-special-018, hc-hhw-010 | SEA, HC |
| miscellaneous | diapers-hygiene | Diapers, pet waste and hygiene products | sea-garbage-015 | SEA |

## 6. Locator: reading `where` and `location_limited` (Q11)

- Module `app/src/features/locator/sites.ts` (Gate 3 #7) loads the packs once at startup with the engine's `loadPacks('engine/rules')`
  (read-only) and the facility list from `engine/data/facilities.csv` (section 7).
- For an item, the client passes the engine response's `rule_ids`. For each id the module returns, from
  the selected place's pack only:
  `{ rule_id, where, location_limited, source_kind, source_date, source_url, applies_to }`, where
  `source_kind` and the date come from the rule's `source` (the `observed` value, else `page_date`, else
  `retrieved`) for LOC-7, and `applies_to` is the rule's list as written in the pack (LOC-9, Gate 3 #8,
  K5). Rules whose source is `superseded` are never read (LOC-8).
- The public packs load unchanged with `loadPacks` since K1 set `url: null` on the three Austin
  `business_page` sources (src-05, src-06, src-07). If loading fails, `GET /api/sites` returns 500 with
  `{ "error": "Site data could not be loaded" }` and the detail goes only to the server log.
- It then returns the facility records whose `rule_ids` column contains any of those ids (section 7, G7).
  A rule with `location_limited: true` returns its linked record with `only_site: true` (LOC-5). A rule
  with `where: null` and no linked record returns nothing, and the UI shows LOC-11.
- Pack `where` text is shown through `displayText` (section 9), which also replaces the business name in
  hc-oil-015 (G13). The item page shows the `where` text of the cited rules as well (G5).
- The locator shows only where the engine's answer points: no `also_acceptable` routes in this run (G8).
- The locator is opened for an item only after the engine has returned `answer` or `conditional`; never
  while a `clarify` is open. For `conditional`, it lists sites for every cited rule, grouped by case
  (G19).

`GET /api/sites?place=<id>[&rule_ids=a,b][&material=<value>]`: without `rule_ids`, every linked record
for the place (LOC-12); with `material`, only records whose `materials` list contains that value
(LOC-18). Records with an empty `rule_ids` column are never returned (G8). Sorted by `name`,
case-insensitive (LOC-14). Response: `{ "rules": RuleWhere[], "sites": Facility[], "official_source":
{ "title": "Official recycling information", "url": <the pack's official_contact_url> } }` (LOC-11, K5).

## 7. Facility records

### 7.1 Source file

`engine/data/facilities.csv` is the locator's site data (G0), read-only for builders. It is the single
place rule-to-facility links live (G7). Columns:

`facility_id, place, name, type, materials, address, lat, lng, source_url, source_label, date_checked,
rule_ids, notes, internal_notes`

- `notes` is shown to residents; `internal_notes` is never shown or sent to the browser (G0).
- `rule_ids` is a `;`-separated list. An empty value means the record is not shown in this run (G8:
  p-sea-03, p-atx-04).
- `lat` and `lng` are entered by hand for sourced addresses and spot-checked by Kiley; they are empty
  for now (G10).
- `source_label` holds a non-URL source, for example "phone report, 2026-11-03" (G9).

### 7.2 Record schema (as served by `/api/sites`)

```ts
type Facility = {
  facility_id: string;
  place: string;                 // place id
  name: string;                  // public description; never a withheld business name (LOC-3)
  kind: 'site' | 'event' | 'category' | 'how_to';   // from type, see below
  type: string;                  // CSV type, unchanged
  materials: string[];           // CSV materials split on "; " (filter values, LOC-18)
  address: string | null;        // see address rule below
  pin: { lat: number; lng: number } | null;   // from lat and lng; null when either is empty
  source_url: string | null;     // null when empty
  source_label: string | null;   // null when empty
  date_checked: string | null;   // shown as "checked <date>" (Q18)
  rule_ids: string[];
  notes: string;                 // shown as written after displayText: fees, appointments, limits (LOC-6)
  only_site: boolean;            // set per request when a location_limited rule links here (LOC-5)
  event_last_date: string | null; // events only, section 7.3
};
```

- `internal_notes` is not part of the served record.
- Address rule: empty, or a value starting "withheld" or "not listed", becomes `null` and is not shown.
  Any other value is shown as written, including "location to be announced" for the two Hawaiʻi County
  events (G9).
- `type` to `kind`: `transfer_station`, `hhw_facility`, `city_dropoff`, `reuse_center`,
  `private_recycler`, `site` are `site`; `hhw_event` is `event` (Q18); `retail_dropoff_unnamed`,
  `library_unnamed`, `redemption_center`, `tire_company`, `category` are `category` (Q16, Q17); `how_to`
  is `how_to` (Q16). An unknown type is a contract break (section 12).
- Only a record with a `pin` appears on the map. Every record appears in the list (G10). `category` and
  `how_to` records never get a pin.

### 7.3 Events (Q18, LOC-17)

`event_last_date` per record: f-hc-01 `2027-02-28`; f-hc-02 `2027-02-28` (G11); f-hc-03 `2027-03-06`;
f-hc-04 `2027-03-07`. Display: "Tentative", the notes, "checked <date_checked>", source link. When today
is after `event_last_date`: "Check the source for the next event" with the source link.

### 7.4 Map (G10)

The map uses OpenStreetMap tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) with the visible
attribution "© OpenStreetMap contributors" linking to https://www.openstreetmap.org/copyright. Any map
library is bundled with the app. The map shows only records with a `pin`; when none has one, it shows
the message "No mapped locations yet; see the list" and the List button.

## 8. Item page and display states (Q2, X-4, X-6, X-10, X-11)

One shared item page serves Recyclopedia and Camera scan (CON-1). Input: `{ origin: 'catalog' | 'search'
| 'scan', entry_id?: string, query: string }` plus the stored place. It calls `POST /api/ask` and renders
exactly one state:

| State | When | Shows |
|---|---|---|
| `card-blue` | `answer` with `recycle_bin`, `compost_bin` or `deposit_return` | blue flag card with the stream label |
| `card-yellow` | `answer` with `garbage` | yellow card with the stream label |
| `card-red` | `answer` with `drop_off_special` | red card with the stream label |
| `referee-check-clarify` | `clarify` | neutral state, no card; the question, a reply box, Send (G20) |
| `referee-check-conditional` | `conditional` | neutral state, no card; each case: its `if` text and stream label as text, no card color (RC-7) |
| `referee-check-abstain` | `abstain` | neutral state, no card; "We don't know" and the official source link |
| `loading` | request in flight | the query and a spinner; no card |
| `error` | HTTP 400, network failure or 150 s timeout | "No answer available right now" and Retry; no card (X-7) |

Every state except `loading` and `error` also shows: the title (`item_interpreted` after `displayText`;
when null, the query as sent, G14); `prep` as a list; the explanation (section 3); the `where` text of the
cited rules from `/api/sites` (G5); and each `source_urls` entry as a link.

Stream labels on cards and in conditional cases (G5): `recycle_bin` "Recycling", `compost_bin`
"Compost", `garbage` "Garbage", `drop_off_special` "Special drop-off", `deposit_return` "Deposit return".
Cards never say "Score!" or "Hazardous" (Q2). The label text always appears, so color is never the only
signal.

Buttons: Upcycle is hidden (Q21). Dispose opens `/locations?item=<query>&rule_ids=<ids>` (CON-2, Q21). It
shows on `card-red`, on `card-blue` when the stream is `deposit_return`, and on
`referee-check-conditional` when any case is `drop_off_special` or `deposit_return` (G19).

No decomposition or percent-recycled figures (RC-8); no static rule text from the Figma frames (RC-6).

## 9. Display-time text swap (Q24, X-2, G12, G13)

- One shared function, `displayText(text: string, surface: string): string`, in the shared client
  code, used for every string from the engine, a pack or the facility list before it is shown.
- **Place name (G12).** Every spelling of the county name in text the app or engine writes becomes
  "Hawaiʻi County": `County of Hawai` followed by `ʻ` (U+02BB), `‘` (U+2018), `’` (U+2019), `'`, a
  backtick, or nothing, then `i`. Quoted source lines (text between “ and ” in an engine explanation) are
  left as written.
- **Business name (G13).** The string `Big Island Biodiesel` (from hc-oil-015 `where`) becomes "a local
  biodiesel company". This applies everywhere it appears outside quoted source lines.
- Nothing else in a string changes. The data is never altered, only what is shown.
- Each call that replaced at least once sends `POST /api/log/display-swap` with
  `{ "surface": "<screen and field>", "from": "<matched text>", "to": "<replacement>", "count": <n>,
  "place": "<id>" }`; the app appends it with a timestamp to `logs/display-swaps.jsonl`. Logging failures
  never block display.

## 10. Routes and screen names

Phone-width web app (Q22): designed at 430 px wide (the Figma frames are 430 by 932), usable from 320 px,
centered with a 430 px maximum width above that. Client-side routes:

| Route | Screen | Figma frame(s) | Feature |
|---|---|---|---|
| `/` | redirect to `/recyclopedia`, or the place picker when no place is stored | none | shared |
| `/place` | Place picker | none (Q1) | shared |
| `/recyclopedia` | Recyclopedia | Recyclopedia (820:3856) | RC |
| `/recyclopedia/:categoryId` | Material page | Plastic (820:4364), Metal (820:4336) | RC |
| `/search?q=` | Search | Recyclopedia Search Active (820:3241), Search Item Overlay (869:10486) | RC |
| `/item?entry=<id>` or `/item?q=<text>&origin=search|scan` | Item page | Item page - Plastic #2 (820:3402), Item page - Electronic Appliance (820:3417), Hazardous Waste (820:3511) | RC, CS |
| `/scan` | Camera Scan | Camera Scan (820:3040), Group 39311 (820:3044) | CS |
| `/scan/confirm` | "We think this is: ___. Is that right?" | none (Q8, K2) | CS |
| `/locations?view=list|map[&item=][&rule_ids=][&material=]` | Locations | Location List (820:3114), Location Map (820:3068) | LOC |
| `/locations/:facilityId` | Facility detail | frame "Capital Area Corporation" (820:4204) | LOC |

Header on every screen: back control, title, place picker. Bottom tab bar (Figma "Iteration tab Bar"):
Recyclopedia, Camera (center button), Locations (G17).

## 11. Design tokens (final)

Approved as final by Kiley Sullivan, 2026-11-05. Token names and values are fixed; a change goes through
section 12. Every color, font, radius and spacing value is used only through the CSS custom properties
below, defined once in `app/public/shared/tokens.css`; no feature hardcodes a value.

From the Figma hi-fi frame "Refcycle Style Tile" (820:3557), Frame 39307 (820:3734), the Style page
(861:14506) and deck slides 35 and 36. **G16 done** (2026-11-05): the session assistant read the Components
page in file `ikM9P253MTdZnskq3ol665`. Card - Red Card uses Pelati Red `#FF2D35` and Wheatfield `#F0E2C3`;
Card - Blue Card and Card - Yellow Card use San Marino `#4468A1` and Gold `#FFD809`. No other color
appears, so the six color values below stand.

| Token | Value | Source |
|---|---|---|
| `--color-blue` | `#4468A1` (San Marino) | Style Tile, Frame 39307 (blue flag card) |
| `--color-ink` | `#17212C` (Mirage Blue) | Style Tile, Style page |
| `--color-gold` | `#FFD809` | Style Tile, Frame 39307 (yellow card) |
| `--color-red` | `#FF2D35` (Pelati Red) | Style Tile, Frame 39307 (red card); G15; Components page, Card - Red Card (G16) |
| `--color-sand` | `#F0E2C3` (Wheatfield) | Style Tile; Components page, Card - Red Card (G16) |
| `--color-white` | `#FFFFFF` | Style page variable |
| `--font-text` | Outfit, bundled with the app | Style Tile, Style page, D35; G15 |
| `--font-display` | MuseoModerno, bundled with the app | Style page, D35; G15 |
| `--radius-control` | 15px (buttons and cards) | D36, Style page; G15 |
| `--space-unit` | 8px; paddings, margins, gaps and insets in multiples of 4px (half a unit), always written through the token, for example `calc(var(--space-unit) / 2)` | Style page "Spacing"; K4 |
| `--icon-max` | 20px icon height | Style page |

Type scale (sizes from the Style Tile, in px at phone width; the pairing of size and style name follows
the order on the tile). Token names are fixed (K3) and defined once in `tokens.css`. Every font size in any
stylesheet uses `var(--type-<style>-size)`; weights use the matching `var(--type-<style>-weight)` where a
rule sets a whole style, and may otherwise be a plain numeric weight.

| Style | Size token | Weight token | Value |
|---|---|---|---|
| H1 Title 1 | `--type-h1-size` | `--type-h1-weight` | 28 Light (300) |
| H2 Title 2 | `--type-h2-size` | `--type-h2-weight` | 22 Regular (400) |
| H3 Title 3 | `--type-h3-size` | `--type-h3-weight` | 20 Regular (400) |
| Headline | `--type-headline-size` | `--type-headline-weight` | 17 Semi-Bold (600) |
| Body | `--type-body-size` | `--type-body-weight` | 17 Regular (400) |
| Callout | `--type-callout-size` | `--type-callout-weight` | 16 Regular (400) |
| Subhead | `--type-subhead-size` | `--type-subhead-weight` | 15 Regular (400) |
| Footnote | `--type-footnote-size` | `--type-footnote-weight` | 13 Regular (400) |
| Caption | `--type-caption-size` | `--type-caption-weight` | 11 Regular (400) |
| Red card label | `--type-card-red-size` | `--type-card-red-weight` | `var(--type-h2-size)` (22), Bold (700); never under 19px or under 700 |

**Contrast rule** (approved by Kiley, 2026-11-05). Normal text needs 4.5:1. Ink `#17212C` on Pelati Red
measures 4.40:1 and white on Pelati Red 3.70:1, so:

- Text on the red card is ink, bold (700), and at least 19px, which makes it large text with a 3:1
  minimum. It uses `--type-card-red-size` and `--type-card-red-weight`; no rule inside the card overrides
  its size, weight or color. The bold face is a real MuseoModerno 700 file bundled with the app, not a
  synthesized bold.
- No San Marino text on Wheatfield (4.38:1). Any box with a `--color-sand` background sets its text and its
  links in ink.
- `app/test/shared/contrast.test.ts` checks both rules.

Icons: Heroicons as named on the Style Tile (for example `magnifying-glass`, `camera`, `map-pin`,
`arrow-long-left`, `arrow-path`), inlined as SVG. Components seen on the hi-fi frames (names only):
Primary Button, Back Button, Dispose Button, Item card, Hand For Card, Recyclopedia Card, Search List
Item, View All Button, Map Ping, Hi-Fi v2 navbar, Iteration tab Bar. Category cards are plain (G18).

## 12. Change requests

1. Builders do not edit this file, `PRD.md`, `engine/` (code, rules, data), `app/data/catalog.json` or any
   path another builder owns. If a contract is wrong, unclear or missing, the builder stops that piece of
   work and files a change request.
2. File: `orchestrator/change-requests/CR-<feature>-<NNN>-<short-name>.md` (feature is `recyclopedia`,
   `camera-scan` or `locator`) with: builder, date, contract section, what the contract says, the problem
   (with evidence: test output, file and line), the proposed change, and which other builders it affects.
3. The orchestrator answers in the same file: **clarification** (no behavior or interface change; the
   orchestrator decides and logs it) or **change** (any change to an interface, schema, data, display
   state or requirement; goes to Kiley for approval).
4. An approved change bumps this file's version, adds a line to the changelog below, and is announced to
   every builder. Until then, builders work to the current version.
5. Builders never resolve an ambiguity by guessing, and never change a rules pack, the facility list or
   the engine to make a test pass.

Changelog:

- 0.1 (2026-11-05): first draft.
- 1.0 (2026-11-05): gate 2 decisions G0 to G20 folded in. Notes split into `notes` and `internal_notes`
  (G0); app layout approved (G1); separate image-model setting, 5 MB JPEG/PNG/WebP limit (G2); catalog
  approved (G3); engine wins over catalog (G4); stream labels and `where` text on the item page (G5); 12
  facility records added to the CSV (G6); link table replaced by the CSV `rule_ids` column (G7); no
  also-acceptable routes (G8); addresses and phone-report labels (G9); hand-entered coordinates and
  OpenStreetMap tiles (G10); February event last date (G11); swap covers every county-name spelling
  outside quoted source lines (G12); hc-oil-015 business replaced by a description (G13); title fallback
  (G14); red, radius and bundled fonts (G15); tokens provisional (G16); tab bar (G17); plain category
  cards (G18); Dispose and conditional locator view (G19); clarify replies (G20).
- 1.1 (2026-11-05): workspace layout, path ownership, `handle` and `mount` signatures, shared `ctx`,
  dynamic feature loading and hand-off routes added as section 2.1, and the locator module moved to
  `app/src/features/locator/sites.ts` (Gate 3 #7); tokens: names fixed, values provisional, used only
  through `tokens.css` (Gate 3 #4).
- 1.2 (2026-11-05): public Austin pack loads after `url: null` on src-05 to src-07, and the `/api/sites`
  500 body no longer carries the load error (K1); confirm prompt "We think this is: <label>. Is that
  right?" (K2); type-scale token names `--type-<style>-size` and `--type-<style>-weight` (K3); spacing in
  multiples of 4px through `--space-unit` (K4); `applies_to` on `RuleWhere` and `official_source` on the
  `/api/sites` response (K5, CR-locator-002).
- 1.3 (2026-11-05): design tokens final; the six color values stand; G16 done (Components page read in
  file `ikM9P253MTdZnskq3ol665`, now the Figma source); contrast rule with `--type-card-red-size` and
  `--type-card-red-weight` for the red card label and no San Marino text on Wheatfield (approved by Kiley).

## 13. Decision record

All gate 2 questions are answered in `CONTRACTS-DECISIONS.md` and all gate 3 questions in
`GATE3-DECISIONS.md`, and the post-merge decisions K1 to K5 in `MERGE-DECISIONS.md`. G16 is done (v1.3); the
design tokens and the contrast rule were approved as final by Kiley on 2026-11-05.
