# Recyclopedia and shared shell: build notes and final report

Builder: Recyclopedia (and the shared app shell). Branch `scored/recyclopedia`. Built to
`orchestrator/CONTRACTS.md` v1.3 and `orchestrator/PRD.md` v2. No model keys were used or needed.

## Milestones

| Milestone | Commit | Content |
|---|---|---|
| M1 shell | `7f8cfa1` | app server, forwarding, static files, security headers, display-swap endpoint, router, place picker, header, tab bar, `tokens.css`, bundled fonts, `index.html` |
| M2 catalog and search | `5a4818b` | `GET /api/catalog`, `app/data/catalog.json`, landing, material page and search screens |
| M3 item page | `8751068` | shared item page with all display states, Dispose, where block, clarify flow, error handling, tests |
| M4 text, tokens, scans | `83e159c` | `displayText` tests and swap logging end to end, token, contrast, style and source-scan tests, SVG class fix |
| M5 hand-back | this commit | this report and `app/README.md` |

Every commit was checked out clean (git archive, no working-tree files) and passed `npm run check` and
`npm test`: 28, 43, 74 and 105 tests at M1 to M4.

## Results

- `cd app && npm run check`: passes (tsc --noEmit, no output).
- `cd app && npm test`: 105 tests, 105 pass, 0 fail (the count is the same for the M5 commit, which only adds docs).
- Headless Chrome (`/usr/bin/google-chrome` through Playwright, not committed) against the real app server and
  a fake engine, at 320 and 430 px wide: picker, landing, search, material page, conditional, red card,
  yellow card, clarify and abstain pages all had `scrollWidth == innerWidth` (no horizontal scroll); the red
  card label computed to rgb(23, 33, 44), 22px, weight 700, MuseoModerno (700 face loaded); changing the place
  in the header sent a second `/api/ask`; no geolocation call; the swap log file received lines. This run
  found one real bug that the fake DOM could not show (SVG `className` is read-only), fixed in M4, and the fake
  DOM now throws the same error so the tests would catch it.

## Acceptance checks (brief section 8)

| # | Check | Result | How tested |
|---|---|---|---|
| 1 | `/api/jurisdictions` and `/api/ask` through 3001 equal the engine, including HTTP 400 bodies; unreachable engine gives the item page `error` state | pass | `test/shared/server.test.ts` (byte-equal bodies for four kinds of 400, 502 JSON when unreachable); `test/shared/api.test.ts` (end to end through the app to a fake engine: 400 and unreachable both give `error`) |
| 2 | First visit: picker with exactly three places, "Hawaiʻi County, HI", nothing preselected, no geolocation, key `refcycle.place`, survives reload | pass | `test/shared/shell.test.ts` (fake DOM boot, reload with the same storage, invalid stored id, blocked storage); `source-scan.test.ts` (no geolocation in any client file); headless Chrome (a spy on `navigator.geolocation` was never called) |
| 3 | Changing the place in the header re-requests the answer on screen | pass | `shell.test.ts` (header select calls subscribers, `ctx.place` updates); `item.test.ts` (new request with the new place, stale answer and stale sites response ignored); headless Chrome (1 to 2 `/api/ask` calls) |
| 4 | `/api/catalog`: 10 categories in order (no Textiles), 50 entries field for field, `query == name` | pass | `test/recyclopedia/catalog.test.ts` parses the tables in CONTRACTS 5.2 and 5.3 and compares them with the endpoint; also checks the rule ids and `covered_in` against the real packs (invariants only) |
| 5 | Category cards plain; a category page lists only its entries | pass | `test/recyclopedia/screens.test.ts` (every category page, card holds only its name, no `img`) |
| 6 | "plastic" lists 13 entries including "Wax, plastic or foil coated paper"; unmatched text opens the item page with that text as `query` | pass | `screens.test.ts` (four casings and padding; submit with no match navigates to `/item?q=...&origin=search`); `api.test.ts` (free text reaches the engine as typed); headless Chrome counted 13 |
| 7 | An entry sends its `query` and the stored place to `/api/ask` | pass | `api.test.ts` (entry `plastic-2` through the app, the fake engine saw `{jurisdiction, query: "Plastic #2 HDPE"}`); `item.test.ts` |
| 8 | One fixture per state: blue (recycle, compost, deposit), yellow (garbage), red (special drop-off), none for clarify, conditional, abstain, loading, error; each card shows its stream label | pass | `item.test.ts` (fixtures validated with the engine's `AnswerSchema`) |
| 9 | `conditional` lists every case with `if` and stream label; `clarify` sends original query, a space and the reply | pass | `item.test.ts` (two and three cases; empty reply sends nothing; two rounds) |
| 10 | `abstain` shows "We don't know" and the official source link | pass | `item.test.ts`; `api.test.ts` (provider-failure abstention shown like any abstention) |
| 11 | HTTP 400, network failure and 150 s timeout give `error` with Retry and nothing else | pass | `api.test.ts` (400, 502, network, invalid shape, timeout with a 40 ms value, constant `ASK_TIMEOUT_MS == 150000` asserted separately); `item.test.ts` (page text is exactly "No answer available right now" and "Retry", no links, Retry asks again) |
| 12 | Title is `item_interpreted` after `displayText`, or the query as sent when null | pass | `item.test.ts` |
| 13 | No page contains "Score!", "Hazardous", "decompose", "Percentage recycled" or disposal text not from the engine | pass | `item.test.ts` (every fixture rendered and scanned, also "specialized facilities" and "Upcycle"); `source-scan.test.ts` (client files and catalog). "Not from the engine" is by construction: the item page builds text only from engine fields, pack `where` text from `/api/sites`, and fixed labels (stream names, "Prep", "Explanation", "Where", "Sources", "Referee check", "We don't know", button names) |
| 14 | Upcycle absent; Dispose per CONTRACTS 8 and opens `/locations?item=<query>&rule_ids=<ids>` | pass | `item.test.ts` (nine answers: shown for red, deposit and conditional with a drop-off or deposit case; hidden otherwise; href parsed and compared) |
| 15 | `displayText`: every county spelling outside “ ” swaps, inside “ ” unchanged, "Big Island Biodiesel" swaps, one log line per replacement through `POST /api/log/display-swap`, nothing else changes | pass | `display-text.test.ts` (all six spellings, quote handling, near misses, logger failure; end to end through the real server to a temp `display-swaps.jsonl`); `shell.test.ts` (place names logged) |
| 16 | No client file uses `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` or `eval` | pass | `source-scan.test.ts`; `item.test.ts` (hostile engine text stays text, a `javascript:` URL is not made a link) |
| 17 | Tokens, red card contrast, no San Marino on Wheatfield, MuseoModerno 700 face, layout 320 to 430 | pass (layout also manual) | `tokens.test.ts`, `contrast.test.ts`, `styles.test.ts` (a small cascade resolver for the red label, every Wheatfield box sets ink, raw colors and px spacing rejected); layout by CSS assertions plus the headless Chrome run above (the Chrome run is not part of `npm test`) |
| 18 | Missing camera-scan or locator module shows "This part of RefCycle is not available yet"; server returns 404 for `/features/not-a-feature/screens.js` | pass | `shell.test.ts` (missing and throwing modules); `server.test.ts` (404 JSON, not `index.html`; missing server module skipped) |

## Interfaces for the other builders (CONTRACTS 2.1)

- Server: `handle(req, res, url)` modules are loaded in the order recyclopedia, camera-scan, locator with dynamic
  `import()` of `src/features/<name>/routes.ts`; a missing file is skipped, a module that throws on load is
  logged and skipped. Own routes run first, then static files, then client routes (index.html), then the modules,
  then 404 JSON. `node_modules` is not served; dot files and path traversal are refused.
- Security headers: `default-src 'self'`; `img-src 'self' https://tile.openstreetmap.org blob: data:`;
  `media-src 'self' blob: data:`; `style-src 'self' 'unsafe-inline'` (Leaflet inline styles); `connect-src 'self'`;
  `Permissions-Policy: geolocation=(), microphone=(), camera=(self)`.
- Client: `mount(route, container, ctx)` with the six `ctx` members only (a test asserts the key set). Each mount
  gets its own `ctx` whose place-change subscriptions are dropped when the screen is replaced, so a screen that
  forgets to unsubscribe cannot leak. One loaded instance per feature module. `ctx.place` is always live.
- Item page: `/item?entry=<id>` or `/item?q=<text>&origin=search|scan`. Camera scan only navigates there.
- Dispose link: `/locations?item=<encoded query>&rule_ids=<ids joined by commas>`.
- The item page calls `GET /api/sites?place=<id>&rule_ids=<ids>` and shows each distinct non-empty `rules[].where`
  through `displayText`; on a 404 or any failure it hides that block. It reads only `rules[].where`.

## Decisions where the contracts left a choice

1. **Swap log granularity.** CONTRACTS 9 gives one record shape with a single `from` and a `count`, and check 15
   says "each replacement writes one log line". A call that swaps several different matched texts sends one
   record per distinct matched text, each with its count (for example two `County of Hawaii` and one
   `County of Hawaiʻi` in one string give two lines). Before a place is chosen the record carries `place: "none"`
   (the server requires a non-empty place).
2. **Unclosed quote.** A “ with no closing ” leaves the rest of the string as written (the conservative reading of
   "quoted source lines are left as written").
3. **Other spellings.** Only the spellings listed in CONTRACTS 9 are swapped, and case-sensitively. Lower case
   `county of hawaii` is not swapped.
4. **Several clarify rounds.** G20 says "the original query, a space and the reply". When the engine asks again, the
   next request is the query as last sent plus a space and the new reply, because the engine keeps no state and the
   first reply would otherwise be lost. For the first round this is exactly G20. The reply box is limited so the
   query stays within 2000 characters.
5. **What counts as `error`.** CONTRACTS 8 names HTTP 400, network failure and the 150 s timeout. Any other
   non-200 status (including the app's own 502 for an unreachable engine) and a 200 body that does not have the
   engine's shape (unknown stream, `answer` without a stream, `conditional` without cases and so on) also give
   `error`, so the page never renders a guess from a malformed response (X-6, X-7).
6. **Search scope.** Typed text searches the whole catalog on the landing page, a material page and `/search`. On a
   material page an empty box shows that category's entries. Typing filters in place; Search (Enter) with matches
   opens `/search?q=` from the landing and material pages, and with no match opens the item page (RC-9). Opening
   `/search?q=zzzz` directly with no match shows "Ask about this", which opens the item page; it does not send a
   request by itself.
7. **Abstain source link.** The abstain state lists every `source_urls` entry under "Official source" (the engine
   always includes the place's official source). The link text is the URL.
8. **Title in the header.** The item title is set through `ctx.setTitle` into the shell header, not repeated in the
   page body. While loading it shows the query; in `error` it shows "Item".
9. **Header place picker.** A native `select` in the header (hidden until a place is chosen); the first-use picker is
   a full-screen list of three buttons with none preselected. `/place` also shows the picker, with the current
   place marked.
10. **Fonts.** Outfit (300, 400, 600, 700) and MuseoModerno (400, 700) latin subsets, woff2, taken from the npm
    packages `@fontsource/outfit` and `@fontsource/museomoderno` 5.3.0 (SIL Open Font License, licence files kept
    beside the fonts). They were copied into `app/public/shared/fonts/`; no dependency was added.
11. **Token names.** Hex values are written in upper case as in CONTRACTS 11. `--font-text` and `--font-display`
    list fallbacks after the bundled family.
12. **Back control.** Hidden on the first screen of a visit; otherwise it goes back in history, or to
    `/recyclopedia` when the page was opened directly.
13. **Where block label.** The heading "Where" and the headings "Prep", "Explanation", "Sources" are fixed labels, not
    rules. The where text itself is the pack's.
14. **Forwarding.** The request body is piped to the engine, not parsed, so the engine's own validation produces the
    400 bodies. The app waits up to 170 s for the engine (the browser gives up at 150 s).
15. **Item page test seam.** `mount(route, container, ctx, deps)` takes an optional fourth argument (engine call,
    sites call, catalog) used only by tests; the router never passes it.

## Change requests filed

None. Nothing in CONTRACTS v1.3 blocked the slice; the choices above are within what it leaves open.

## Not done, and limits

- `GET /api/sites` is the Locator's route and is not served by this slice, so the where block was exercised only
  with stubs and with the real 404 path. After merge it shows the pack `where` text. The Dispose target
  `/locations` is likewise built by the Locator.
- The live engine and any model were not called (no keys). Answers in tests are hand-written fixtures validated
  with the engine's `AnswerSchema`.
- The headless Chrome layout and computed-style check is manual and not part of `npm test` (the repository has no
  browser test dependency and `package.json` is read-only).
- `app/package.json` `test` script runs `test/**/*.test.ts`, so after merge it also runs the other slices' tests;
  nothing in this slice's tests depends on them.
