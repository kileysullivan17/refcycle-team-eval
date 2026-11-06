# Builder brief: Camera scan

Status: Approved by Kiley Sullivan, 2026-11-05, for the scored team run. Builds to
`orchestrator/CONTRACTS.md` v1.3 (final, including design tokens).

You are one of three builders working in parallel, each in its own git worktree, on branch
`scored/camera-scan`. This brief is your whole assignment. Read it in full before you write anything, then
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

You build **Camera scan**: the resident takes or picks a photo, the app identifies the item with an image
model, the resident confirms or edits it, and the app opens the shared item page with that confirmed
label. You own `POST /api/identify` and the two scan screens. You do **not** build the item page, the
engine call or the app shell: the Recyclopedia builder builds those in parallel. You build against
CONTRACTS.md section 2.1.

## 3. Read first

1. `orchestrator/PRD.md` (v2, approved). Your requirements are quoted in section 4 below.
2. `orchestrator/CONTRACTS.md` (v1.3): sections 2 (including 2.1), 4, 9, 10, 11 and 12. Skim 3 and 8 so
   you know what the item page does with your label.
3. `engine/code/src/provider.ts` and `engine/code/src/config.ts` (read-only): follow the engine's request
   shape, temperature handling and `.env` loading (`loadEnv`) for your image-provider adapter.

Do not open, list or search anything under these paths: `/home/claude/refcycle-private`,
`/home/claude/refcycle-eval`, `/home/claude/refcycle-team-build`, `/home/claude/refcycle-wt`,
`/home/claude/refcycle-scored/baseline`, and `engine/code/eval/` in your worktree. Do not read engine logs.
Your acceptance checks come from the PRD and the contracts, not from any answer key or other build.

## 4. Requirements you own (quoted from PRD v2)

- **CS-1.** The Camera Scan screen shows a live viewfinder with an "Identify" capture button, a "Photos"
  option to choose an existing image, "Snap Tips", a close control, a flash control and a camera flip
  control.
- **CS-2.** After capture, the app identifies the item with an image model through the engine's existing
  model provider, turns the photo into an item description, and sends the confirmed description as the
  `query` to `POST /api/ask` with the selected place. There is no barcode lookup. (You send it by opening
  the shared item page, section 6.3; identification has its own model setting, CONTRACTS.md section 4.)
- **CS-3.** The result opens the same item page used by Recyclopedia, with the engine's response per X-4
  and X-5.
- **CS-4.** Identification never produces a stream, verdict or disposal instruction itself; those come
  only from the engine.
- **CS-5.** When the photo is unclear or the item cannot be identified, the app asks the resident to
  retake the photo or name the item, and does not call the engine with a guess.
- **CS-6.** When the answer depends on something a photo cannot show (deposit status, resin number, clean
  or food-soiled), the app does not assume it; it passes on the engine's clarifying question or
  conditional cases. (For you: the label never asserts deposit status, resin number or cleanliness that
  the photo cannot show; the item page relays the engine's question.)
- **CS-7.** When the photo shows more than one item, the app asks which one the resident means and does
  not merge them.
- **CS-8.** After identification, the app always shows "Is this a ___?" with the identified item and an
  option to edit it, before the engine is asked. (The wording is set by CONTRACTS.md section 4: "We think
  this is: <label>. Is that right?")
- **CS-9.** If camera access is denied, the app offers photo upload instead.
- **CS-10.** Photos go to the model provider for identification only and are not stored.

Shared requirements that bind your screens:

- **X-3.** Every recycling answer (stream, prep, explanation, rule ids, sources) comes from
  `POST /api/ask` with the selected place's `jurisdiction` id. No feature stores, writes, infers or
  hardcodes a stream, prep step or rule.
- **X-11.** The item page title is the engine's `item_interpreted`. No brand or model names are shown.
  (For you: your `label` contains no brand or model names.)
- **X-12.** The app is a web app laid out for phone width, built on the same TypeScript stack as the
  engine.

## 5. Files and folders you may create or change

Only these (CONTRACTS.md section 2.1). Anything else is another builder's or read-only.

| Path | What |
|---|---|
| `app/src/features/camera-scan/**` | `routes.ts` (`POST /api/identify`), the image-provider adapter, the prompt, label sanitizing |
| `app/src/features/camera-scan/dev/**` | a local harness to run your screens before merge |
| `app/public/features/camera-scan/**` | `screens.js` and its stylesheet |
| `app/test/camera-scan/**` | your tests and fixture images (made or generated by you, no real people) |
| `app/docs/camera-scan.md` | your build notes and final report |

Provided in the base commit, read-only for every builder: `app/package.json`, `app/package-lock.json`,
`app/tsconfig.json`, `app/.env.example`, the root `.gitignore`, `SCORED-RUN.md`, the whole of `engine/`
(code, rules packs and `engine/data/facilities.csv`), `orchestrator/` (except your own change-request
files), and `specs/`. If you need another dependency, a script change or a data fix, file a change request
(section 10).

## 6. Interfaces you build against

Fixed in CONTRACTS.md section 2.1 and section 4. Change them only through a change request.

- **Server:** `app/src/features/camera-scan/routes.ts` exports `handle(req, res, url): Promise<boolean>`,
  `true` only for `POST /api/identify`. The shell does not read the request body before your `handle`, so
  read and limit it yourself. Read the image-model configuration per request, so a missing key gives HTTP
  502 and the server still starts.
- **Client:** `app/public/features/camera-scan/screens.js` exports `mount(route, container, ctx)` for
  `/scan` and `/scan/confirm` (plain ES module, no build step, no CDN). Return a cleanup function that
  stops the camera; the shell calls it before the next mount and keeps one loaded instance of your module
  across your two routes. Use only the six `ctx` members in section 2.1.
- **Hand-off:** when the resident confirms (Yes) or edits and submits a label, call
  `ctx.navigate('/item?q=' + encodeURIComponent(label) + '&origin=scan')`. Never call `/api/ask` yourself.
- **Styles:** use the CSS custom properties of CONTRACTS 11 only; they are defined by the shared
  `tokens.css`. Your dev harness defines its own copy of every token it uses (including the type tokens)
  inside your own `dev/` folder.

## 6b. Common rules for tests and styles (all builders)

These hold for all three slices, so the merged tree stays green:

1. **Test files** end in `.test.ts` and live under your own `app/test/<slice>/` (or `app/test/shared/` for
   the shell). Run them with a glob, for example `node --import tsx --test "test/camera-scan/**/*.test.ts"`;
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
2. Tests: `cd app && node --import tsx --test "test/camera-scan/**/*.test.ts"`. Typecheck: `npm run check`.
   Never call a real provider: inject a fake transport that returns canned provider replies, including
   malformed ones and ones that try to add a stream, a verdict, advice or a brand.
3. Screens before merge: run your harness in `app/src/features/camera-scan/dev/`, which serves your
   `screens.js` with a fake `ctx` that records `navigate` calls.

Milestones, each ending with a green commit: M1 `/api/identify` with a fake provider; M2 provider adapters
(both providers, fake transport); M3 `/scan` with camera, upload fallback and Snap Tips; M4 `/scan/confirm`
with the identified, multiple and unclear paths; M5 hand-back (`app/docs/camera-scan.md`).

## 8. Acceptance checks (each an automated test where it can be)

1. `/scan` shows the viewfinder, Identify, Photos, Snap Tips, close, flash and camera flip controls (CS-1).
   Flash and flip are hidden, not broken, where the device does not support them.
2. Camera permission denied or no camera: the screen offers photo upload limited to JPEG, PNG and WebP
   (CS-9).
3. `POST /api/identify` rejects a decoded image over 5 MB, a non-image, a GIF, and a body whose leading
   bytes do not match the declared type, each with HTTP 400 and `{ "error": ... }` (CONTRACTS 4).
4. A valid image returns exactly `status`, `label`, `candidates`, `model`; a provider reply that adds a
   stream, verdict or disposal advice is reduced to the schema (CS-4).
5. `label` holds no brand or model names, and no resin number, deposit status or cleanliness the photo
   cannot show (X-11, CS-6). Record how you strip or re-ask.
6. `identified` always shows "We think this is: <label>. Is that right?" with Yes and Edit before anything
   else happens (CS-8, CONTRACTS 4).
7. `multiple` asks which item, offering up to 4 candidates and a text box; nothing is merged; a candidate
   tap still goes through the confirm prompt (CS-7, CS-8).
8. `unclear`, HTTP 502 or a timeout offers Retake and "Type the item"; no navigation to the item page
   until the resident confirms or types a label (CS-5).
9. Yes, or an edited label, navigates exactly to `/item?q=<label>&origin=scan` (CS-2, CS-3, CON-1).
10. No code path calls `/api/ask`, and no screen shows a stream, card or disposal text (CS-4, X-3).
11. No image bytes are written to disk or any log, and no browser storage is used; `logs/identify.jsonl`
    lines hold only time, status, label, model and duration (CS-10).
12. With `LLM_IMAGE_PROVIDER` and `LLM_IMAGE_MODEL` unset, the adapter uses `anthropic` and
    `claude-sonnet-5-5`; set, it uses them; with no key, `/api/identify` returns 502 and the server starts.
13. Both adapters build requests in the engine's shape plus an image block, start with temperature 0, and
    retry once without temperature only when the provider rejects it (as the engine does).
14. Styles meet section 6b rule 6 (tokens only, type tokens, spacing in 4px multiples through the token, no
    San Marino on Wheatfield). Layout works from 320 px to 430 px.

## 9. Must not

- Edit anything outside section 5's paths, including the shell and the item page.
- Produce or display any stream, verdict, recyclability claim or disposal advice.
- Add barcode lookup, store photos, or send them anywhere but the configured provider.
- Call any network service except the configured image-model provider. Use device location.
- Read anything under the forbidden paths in section 3, or tune anything to an answer key.
- Guess when the contract is unclear. Raise a change request instead.
- Merge, rebase onto other branches, or push.
- Use em dashes in any file you write.

## 10. Change requests

If a contract is wrong, unclear or missing, stop that piece of work and write
`orchestrator/change-requests/CR-camera-scan-<NNN>-<short-name>.md` (the only file you may create outside
section 5) with: your slice, the date, the contract section, what it says, the problem with evidence
(test output, file and line), your proposed change, and which other slices it affects. Carry on with
other work while you wait. The orchestrator replies in the same file: a clarification it decides, or a
change that goes to Kiley. Until a change is approved, build to CONTRACTS.md v1.3. Never patch a pack, the
facility CSV or the engine to make a test pass.

## 11. Hand back

Your branch with one commit per milestone, every commit green, and `app/docs/camera-scan.md` holding your final
report: milestones and commit hashes; the result of `npm run check` and `npm test`; each acceptance check
in section 8 marked pass, fail or not testable, with how it was tested; your decisions where the contracts
left a choice; the change requests you filed; anything you could not do. Your final message is the same
report.
