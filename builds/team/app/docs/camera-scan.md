# Camera scan: build notes and final report

Slice: Camera scan (`POST /api/identify`, `/scan`, `/scan/confirm`). Branch `scored/camera-scan`. Built to
CONTRACTS.md v1.3 and `BRIEF-camera-scan.md`. No model-provider key was used; every test uses a fake provider
or a fake transport.

## Milestones and commits

| Milestone | Commit | Content |
|---|---|---|
| M1 | 487e7cf | `POST /api/identify` with a fake provider: body limit, validation, schema reduction, label sanitizing, log |
| M2 | 2f28e32 | Anthropic and OpenAI image adapters, per-request config, fake-transport tests |
| M3 | 9da8152 | `/scan` screen (viewfinder, Identify, Photos, Snap Tips, close, flash, flip, upload fallback), stylesheet. `screens.js` was committed whole here, so it already held the `/scan/confirm` code; that screen was tested in M4. |
| M4 | 7ef11f6 | `/scan/confirm` tests (identified, edit, multiple, unclear/error), dev harness, style and source-scan tests, one CSS tidy |
| M5 | this commit | this report |

## Results

- `npm run check` (in `app/`): passes, no errors.
- `npm test` (in `app/`): 59 tests, 59 pass, 0 fail. All 59 are in `test/camera-scan/` because the other
  slices are not in this worktree.
- Not run: any real provider, any real camera or browser. The screens run in Node against a small fake DOM
  (`test/camera-scan/fake-dom.ts`), because no DOM library is in `package.json`. The dev harness
  (`src/features/camera-scan/dev/serve.ts`, port 3011) was started once and its files and fake
  `/api/identify` answered over HTTP; it was not opened in a browser.

## Acceptance checks (brief section 8)

| # | Result | How tested |
|---|---|---|
| 1 | pass | `screens.test.ts`: all six controls visible with a torch and two cameras; flash and flip hidden when the track has no torch or only one camera exists. Not tested on a real device. |
| 2 | pass | `screens.test.ts`: denied, `NotFoundError` and no `mediaDevices` each show a visible `<input type=file accept="image/jpeg,image/png,image/webp">`, with the viewfinder and Identify hidden. A GIF choice is refused on screen and nothing is sent. |
| 3 | pass | `identify-route.test.ts`: wrong content type, bad JSON, extra keys, missing image, GIF, SVG, text, JPEG/PNG/WebP bytes under the wrong declared type, a decoded image over 5 MB, and a 9 MB body each give 400 `{ "error" }` and never reach the provider. |
| 4 | pass | `identify-route.test.ts`: response keys are exactly `status, label, candidates, model`; a reply with `stream`, `verdict`, `advice` and other keys is reduced; malformed, null and unknown-status replies become `unclear`. |
| 5 | pass | `sanitize.test.ts`, `identify-route.test.ts`. See "How labels are cleaned" below. |
| 6 | pass | `confirm.test.ts`: the question text is exactly "We think this is: plastic milk jug. Is that right?" with Yes and Edit, and no navigation happens before a tap. |
| 7 | pass | `confirm.test.ts`: up to 4 candidates plus a text box; a candidate tap shows the confirm prompt and does not navigate; only Yes navigates. Candidates are never joined. |
| 8 | pass | `confirm.test.ts`: `unclear`, HTTP 502, network failure, malformed reply and an empty identified label all show Retake and "Type the item", with no navigation to `/item` until a label is typed. Retake goes to `/scan`. |
| 9 | pass | `confirm.test.ts`: Yes, an edited label, a candidate then Yes, and a typed label all call `navigate('/item?q=' + encodeURIComponent(label) + '&origin=scan')`. Empty text is refused. |
| 10 | pass | `styles.test.ts` source scan: the only `/api/` string in `screens.js` is `/api/identify`; no `api/ask` anywhere in the slice's code; no stream, bin or disposal wording in `screens.js`. |
| 11 | pass | `identify-route.test.ts`: the log file holds only `time, status, label, model, duration_ms` and no base64; the log folder holds only `identify.jsonl`. `styles.test.ts`: no write calls in server code except the log append, no browser storage in `screens.js`. |
| 12 | pass | `provider.test.ts`: unset variables give `anthropic` and `claude-sonnet-5-5`; set variables are used with the matching key; with no key the real route returns 502 and a key added later is picked up without a restart. |
| 13 | pass | `provider.test.ts`: both adapters send the engine's request shape plus an image block, start with `temperature: 0`, retry once without it only on a temperature rejection, remember that, and do not retry other 400s. |
| 14 | pass for the CSS; layout not seen in a browser | `styles.test.ts`: only token variables for color, font, radius and font size; spacing evaluated with `--space-unit: 8px` and every value is a multiple of 4; px only on borders, outlines and element sizes; no San Marino text; sand boxes set ink text; fluid widths, wrapping controls, 430 px maximum, one rule below 360 px. |

## How labels are cleaned (check 5)

The prompt asks for a generic name only, but the app does not rely on it. `sanitize.ts` cleans every label and
every candidate:

1. Remove ®, ™ and ©.
2. Remove names from a built-in list of common brands and device lines (about 200). Ambiguous words such as
   "apple" or "target" are left out of the list on purpose.
3. Remove resin numbers and codes (`#2`, "type 5", PET, HDPE, PVC and similar), deposit words (HI-5, CRV,
   deposit, refundable), cleanliness words (clean, empty, dirty, greasy, soiled and similar), and verdict
   adjectives (recyclable, compostable, hazardous).
4. Drop whole clauses that mention a bin, recycling, trash, disposal or an instruction ("goes in the bin").
5. Drop tokens with digits (model numbers, quantities) and the unit word after them; drop camelCase tokens
   (iPhone style); drop Capitalized words that are not first in a label that is not Title Case (likely proper
   nouns such as an unlisted brand).
6. Lower-case, trim stop words at the ends, limit to 120 characters.

If an identified label was non-empty before cleaning and empty after it (for example a brand-only answer), the
route asks the model once more with a stricter instruction; if that is also empty the status is `unclear`.
Known limit: an unlisted brand written in lower case with no digits would pass. The confirm step ("Is that
right?" with Edit) is the safety net, and nothing here decides a recycling answer.

## Decisions where the contracts left a choice

- Over-size or unreadable bodies, wrong content type and bad JSON all return HTTP 400 (the contract names
  400 for the image rules only; 413 was not used).
- The body limit is 7 MB plus 4 KB of JSON wrapper. Size is checked from the base64 length before decoding.
- A provider reply that cannot be parsed, or has an unknown status, returns 200 `unclear`, not 502. 502 is for
  provider errors, timeouts and missing configuration. The log records failures as status `error` and
  rejected requests as `rejected`, with null label and model.
- Provider timeout is 30 seconds per attempt (the engine uses 60); the browser gives up after 75 seconds and
  shows the retake/type screen. `max_tokens` is 1024 (Anthropic) and `max_completion_tokens` 2048 (OpenAI).
- The route logs before it sends the response, so the log line exists when the client sees the answer.
- `.env` is read from `app/.env` on every request through the engine's `loadEnv`, so a missing key gives 502
  and the server still starts.
- `/scan` makes the identify call and then calls `ctx.navigate('/scan/confirm')`; the result is kept in a
  module variable (memory only) for the confirm screen. Opening `/scan/confirm` with no result offers Retake
  and "Type the item". The photo is dropped as soon as it is sent.
- A typed label (unclear path, or typed on the multiple screen) goes straight to the item page, because the
  resident named the item. A candidate tap, which is an identification, goes through "Is that right?".
- Edit shows a text box and a "Check this item" button. Close goes to `/recyclopedia` because `ctx` has no
  back function.
- Snap Tips is a text panel of four general photo tips; none states a recycling rule.
- `screens.js` takes an optional fourth argument to `mount` (a test environment). The shell passes three
  arguments, so behavior there is unchanged. The module adds its own `<link>` to `screens.css` once.
- The harness writes its log to the system temp folder, not to `app/logs/`.

## Change requests filed

None.

## What I could not do

- No live check against a real image model, a real camera, or on a phone. The orchestrator runs the live
  end-to-end check at merge.
- No check against the real shell, `tokens.css` or item page, which are not in this worktree. `screens.js`
  only uses the six `ctx` members in section 2.1 (`navigate` and `setTitle` are the ones it calls).
- The brand list is a fixed list. It was not checked against any answer key.
