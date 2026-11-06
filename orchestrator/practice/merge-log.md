# Merge log

Merges of the three builder branches into `main` at `/home/claude/refcycle-team-build`, following
`orchestrator/briefs/MERGE-PLAN.md` and `CONTRACTS.md` v1.1. Orchestrator, 2026-11-05. The live end-to-end
check (MERGE-PLAN 3, after Camera scan) has **not** been run: it needs Kiley's key and decision K1.

Builder heads merged: `feat/recyclopedia` be3b51d, `feat/locator` ccfd001, `feat/camera-scan` 739400e (the
first all-green commit; its M5 commit bfb3d45 had one failing test). Messages from the session assistant to
builders after launch: none (`builder-log.md` has no rows).

## Merges

| Step | Branch | Merge commit | Result |
|---|---|---|---|
| 1 | `feat/recyclopedia` | d0cd438 | Merged. All checks passed with no edits: 117 of 117 tests, typecheck clean. |
| fix | base config | d579e51 | `.gitignore` fix approved in CR-camera-scan-001 and CR-recyclopedia-001. |
| 2 | `feat/locator` | 01e905b | Merged. Tests failed at first (5 of 149) because the shell's content tests scanned vendored Leaflet and flagged the approved OpenStreetMap URLs and the locator's px font sizes. Fixed by orchestrator test edits H1 to H3 (5e75f81): 149 of 149. |
| 3 | `feat/camera-scan` | 53168d3 | Merged. Tests failed at first (2 of 205): one stale shell test, and camera's raw 4px spacing (NB-4). Fixed by H3 (final form), H4 and H5 (db95a65): 205 of 205, Chrome layout test included, typecheck clean. |

No textual merge conflicts.

## Checks per merge (MERGE-PLAN 2)

| Check | Recyclopedia | Locator | Camera scan |
|---|---|---|---|
| 1 Ownership (only brief section 5 paths and own CR files) | pass | pass | pass |
| 2 Read-only files untouched (`engine/`, `orchestrator/` except CRs, `specs/`, app config, `.gitignore`) | pass | pass | pass |
| 3 `npm ci`, `npm run check`, `npm test` on the merged tree | pass | pass after H1 to H3 | pass after H3 to H5 |
| 4 Interfaces (`handle`, `mount`, loaded by the shell, routes resolve) | pass | pass | pass |
| 5 API schemas | pass: `/api/catalog` 10 and 50; forwarding unchanged; engine down gives 502 | pass on a patched pack copy (all 26 records have exactly the contract keys; `only_site` true for f-hc-06); on the real packs `/api/sites` returns 500 (CR-locator-001) | pass: no key gives 502 and the server still starts; GIF gives 400; log lines hold no image data and are git-ignored |
| 6 Content scan | pass | pass | pass |
| 7 Builder acceptance checks | pass (builder report, spot-checked) | pass on the patched copy; 15 and 17 depend on K5 | pass with fakes; live provider untested |

Content scan detail: no em or en dashes in `app/`; "Score!", "Hazardous", "decompose", "Percentage recycled"
appear only in tests and in camera's advice filter (`sanitize.ts`); "Big Island Biodiesel" appears only in the
swap rule (`display-text.js`) and the locator's dev harness; no geolocation in app code (vendored Leaflet has
it but `locate()` is never called); external hosts are only the two provider APIs (server), the OpenStreetMap
tile and copyright URLs, and license and package metadata; stream names in client code are only the
display mapping of CONTRACTS 8.

## Contract breaks

Definition and counting as in MERGE-PLAN 4.

| Id | Slice | Step | Check | Contract | Description | Severity | Resolution |
|---|---|---|---|---|---|---|---|
| NB-1 | Recyclopedia | 1 | spacing review | CONTRACTS 11 ("paddings and gaps in multiples of 8") | `app.css` uses half and one-and-a-half units (`--space-unit / 2`, `* 1.5`), so 4px and 12px | non-blocking | Closed by K4 (multiples of 4px allowed), no code change |
| NB-2 | Locator | 2 | spacing review | CONTRACTS 11 | `screens.css` uses `/ 2` and `* 1.5` | non-blocking | Closed by K4, no code change |
| NB-3 | Camera scan | 3 | spacing review | CONTRACTS 11 | `scan.css` uses `* 2.5` and `* 1.5` | non-blocking | Closed by K4, no code change |
| NB-4 | Camera scan | 3 | 3 (tests) | CONTRACTS 11 ("used only through the CSS custom properties") | three spacing values hardcoded as `4px`, outside `--space-unit` | non-blocking | Fixed by orchestrator edit H5 (same value, now through the token) |

Totals: **blocking 0, non-blocking 4** (Recyclopedia 1, Locator 1, Camera scan 2).

Not counted as breaks:

- Locator's `applies_to` and `official_source` fields: raised as CR-locator-002 before hand-back.
- Locator and Camera scan font sizes in px: CONTRACTS 11 gives the type scale but no token names for it, so
  there was nothing to use (contract defect CD-4). The shell invented `--type-<style>-size|weight`.
- Process deviations (not contract): Locator put M2 to M4 in one commit; Camera scan's M5 commit had a
  failing test that its next commit fixed.

## Contract defects (orchestrator-owned)

| Id | Defect | Found by | Status |
|---|---|---|---|
| CD-1 | CONTRACTS 2 and 6 tell the app to load the public packs with the engine's `loadPacks`, but `austin_tx.yaml` fails the engine's URL schema. I read both and missed it. | CR-locator-001 | Decision K1 |
| CD-2 | CONTRACTS 6 `RuleWhere` lacks `applies_to` (needed for Gate 3 #8) and the response has no official source (needed for LOC-11) | CR-locator-002 | Decision K5 |
| CD-3 | Base `.gitignore` pattern `logs/*.jsonl` is anchored to the root and misses `app/logs/` | CR-camera-scan-001, CR-recyclopedia-001 | Fixed, d579e51 |
| CD-4 | CONTRACTS 11 lists the type scale without token names | merge step 2 | Decision K3 |
| CD-5 | The contracts approve Leaflet and OpenStreetMap URLs but do not exempt them from the content rules the shell tests enforce | merge step 2 | Fixed by H1 and H2 |
| CD-6 | CONTRACTS 4 and CS-8 spell the prompt "Is this a <label>?", which reads "Is this a aluminum can?" | Camera scan report | Decision K2 |

## Orchestrator edits to builder code

All in commits 5e75f81 and db95a65 on `main`. None changes app behavior except H5, which changes no
rendered value.

| Id | File | Edit | Why |
|---|---|---|---|
| H1 | `app/test/shared/item.test.ts` (two walkers), `shell.test.ts`, `tokens.test.ts` | skip `vendor/` folders in source scans | vendored Leaflet (Gate 3 #5) uses `innerHTML`, inline styles and contains `geolocation`; it is third-party code the contract approved (CD-5) |
| H2 | `app/test/shared/tokens.test.ts` | treat `https://tile.openstreetmap.org` and `https://www.openstreetmap.org` as allowed in the external-resource check | both are required by CONTRACTS 7.4 (G10) (CD-5) |
| H3 | `app/test/shared/tokens.test.ts` | for stylesheets under `features/`, check px only in spacing declarations (margin, padding, gap, inset); the shell's own stylesheet keeps the strict no-px rule | the shell test was stricter than CONTRACTS 11, which covers spacing, color, font family and radius but names no type tokens (CD-4) and says nothing on borders or element sizes |
| H4 | `app/test/shared/server.test.ts` | the "missing feature module is a 404" test now requests `/features/not-a-feature/screens.js` | it used `/features/camera-scan/screens.js`, which exists after merge |
| H5 | `app/public/features/camera-scan/scan.css` | `4px` spacing in three declarations replaced with `calc(var(--space-unit) / 2)` | NB-4; same rendered value, now reached by a token correction |

Also edited by the orchestrator, not builder code: root `.gitignore` (d579e51) and the reply sections of the
four change requests.

## Change requests

| CR | Outcome |
|---|---|
| CR-recyclopedia-001 | Clarification, approved and applied (d579e51) |
| CR-camera-scan-001 | Clarification, approved and applied (d579e51); same issue as CR-recyclopedia-001 |
| CR-locator-001 | Change outside orchestrator authority (engine/rules or engine code): to Kiley as K1 |
| CR-locator-002 | Additive interface change: to Kiley as K5, recommended for approval; merged as built |

## Decisions for Kiley

- **K1 (CR-locator-001).** Fix the public Austin pack, or relax the pinned engine's URL check? Recommended:
  set `url: null` on src-05, src-06 and src-07 in `engine/rules/austin_tx.yaml`; it changes no engine answer.
  Blocks the live check and `/api/sites`.
- **K2 (wording).** Replace "Is this a <label>?" Recommended: "We think this is: <label>. Is that right?"
  with the same Yes and Edit buttons; it reads correctly for any label ("aluminum can", "eggs", "foil").
- **K3 (type tokens).** Adopt the shell's `--type-<style>-size` and `--type-<style>-weight` names into
  CONTRACTS 11 (v1.2), and have Locator and Camera scan use them before the scored run? Recommended: yes.
- **K4 (spacing).** All three slices use half-unit spacing (4px, 12px, 20px). Allow multiples of 4px
  (half `--space-unit`), always through the token, or hold to multiples of 8? Recommended: allow multiples of
  4px; then NB-1 to NB-3 close with no code change.
- **K5 (CR-locator-002).** Add `applies_to` to `RuleWhere` and `official_source` to the `/api/sites`
  response? Recommended: approve.

## Observations (not breaks)

- `/api/sites` returns the raw schema error text in its 500 body while K1 is open. The contract does not
  specify error bodies; worth trimming in a follow-up.
- Camera scan's brand filter is a fixed list plus what the model reports; the live check should look for
  brand names in labels.
- Before the scored run (MERGE-PLAN 5): token values from Kiley, and coordinates in `facilities.csv`.

## Post-merge decisions applied (K1 to K5, 2026-11-05)

Kiley accepted all five recommendations (`orchestrator/MERGE-DECISIONS.md`). Applied on `main` by the
orchestrator. Defect status: CD-1 closed by K1, CD-2 by K5, CD-4 by K3, CD-6 by K2. NB-1 to NB-3 closed by
K4. Contract: CONTRACTS.md v1.2.

| Id | File | Edit | Decision | Builder code? |
|---|---|---|---|---|
| E1 | `engine/rules/austin_tx.yaml` | `url: null` on src-05, src-06, src-07; nothing else in `engine/` | K1 (Kiley approved this one edit) | no |
| E2 | `app/src/features/locator/routes.ts` | 500 body is now `{ "error": "Site data could not be loaded" }`; the load error goes to `console.error` | K1 follow-up | yes |
| E3 | `app/test/locator/helpers.ts` | tests load `engine/rules` directly; the run-time copy that nulled the three URLs is removed | K1 | yes |
| E4 | `app/public/features/camera-scan/screens.js`, `app/test/camera-scan/confirm-screen.test.ts` | prompt "We think this is: <label>. Is that right?" (same Yes and Edit); three test expectations and two test names updated | K2 | yes |
| E5 | `app/public/features/camera-scan/scan.css` | local `--cs-fs-*` properties removed; 14 uses now `var(--type-<style>-size)` | K3 | yes |
| E6 | `app/public/features/locator/screens.css` | 17 px font sizes now `var(--type-<style>-size)` (size and weight matched to the scale) | K3 | yes |
| E7 | `app/src/features/locator/dev/tokens-dev.css`, `app/src/features/camera-scan/dev/tokens.css` | type size tokens added so the dev harnesses still render | K3 | yes |
| E8 | `app/test/shared/tokens.test.ts` | H3 tightened: in feature stylesheets no px in spacing, font sizes or any custom property, and spacing must be a multiple of half `--space-unit` (K4); checked by injecting a 14px font size and a 0.3-unit margin, both caught | K3, K4 | yes |

Not restored: the fully strict no-px rule for `features/`. After the switch, feature stylesheets still use px
for border and outline widths (1px to 3px), the scan stage's `min-height: 360px` and the 1px visually hidden
file input. CONTRACTS 11 has no tokens for these (the shell's `--border-width` and `--focus-width` are not in
the contract), so E8 checks everything the contract names and leaves those.

Not changed (outside this task): `PRD.md` CS-8 and `BRIEF-camera-scan.md` still quote "Is this a ___?"; the
contract (v1.2) now holds the wording. The builders' own reports in `app/docs/` are left as written.

Checks after the edits: `npm run check` clean; `npm test` 205 of 205 (Chrome layout test included);
`GET /api/sites` 200 for all three places on the real packs (26 records; the item page's `where` block now
loads); the pinned engine's server starts on the real packs and `GET /api/jurisdictions` returns all three
(stub provider, no key).

Pinned engine test suite (`engine/code`, `npm test`, no key): before E1 it could not load the packs at all
(6 of 6 files failing); after E1 it passes 25 of 26. The one failure, "R12 and R13: field observations
include date and exact site", is pre-existing and not caused by E1: the test expects "Field observation" for
hc-plastic-011 and hc-plastic-012, but since the 2026-11-03 recheck those rules cite `field_report` sources,
so the engine correctly says "Field report". The engine is pinned and read-only, so the test is not
changed; Kiley's call.

Orchestrator edits to builder code, running total: H1 to H5 and E2 to E8, **12**. Contract breaks unchanged:
blocking 0, non-blocking 4 (all now closed: NB-4 by H5, NB-1 to NB-3 by K4).

## Live end-to-end smoke check (practice cases only), 2026-11-05

Run by Kiley on his Mac from his own Terminal (run-live-check.sh), engine and app on anthropic/claude-sonnet-5-5, key from his local Build B folder. No scored key case was used.

| Check | Result |
|---|---|
| Seattle, "newspaper" | answer, recycle_bin, sea-paper-001, prep and source returned |
| Austin, "styrofoam cooler" | answer, drop_off_special, atx-foam-009, where text names the Recycle and Reuse Drop-off Center |
| Hawaii County, "wine bottle" | answer, recycle_bin, hc-glass-004, prep includes no lids |
| Identify, practice photo ph26 (milk carton) | identified, label "gable-top carton", no brand, no disposal advice |
| /api/sites, Austin, atx-foam-009 | Recycle and Reuse Drop-off Center |

Harness notes, not build defects: the sandboxed device shell could not reach the provider (every call returned provider_error, and the engine abstained, as designed); packages installed from the sandbox were built for Linux and had to be reinstalled natively, so run-live-check.sh now runs npm ci first.

## Design tokens final and contrast rule (2026-11-05)

Kiley approved the design tokens as final, with one change (a contrast rule). The session assistant read the
Figma Components page (G16) in Kiley's re-imported Pro-team copy, file key `ikM9P253MTdZnskq3ol665`, now the
Figma source: no new color, so the six values stand. CONTRACTS.md v1.3 records this. This also clears the
"token values corrected" item of MERGE-PLAN section 5; map coordinates remain.

| Id | File | Edit | Builder code? |
|---|---|---|---|
| E9 | `app/public/shared/fonts/museomoderno-latin-700-normal.woff2` (new), `app/public/shared/app.css` | MuseoModerno 700 added from `@fontsource/museomoderno` 5.2.6, the same package as the bundled 400 file (byte-identical); new `@font-face`, so the red card bold is a real face (same SIL OFL license file already alongside) | yes |
| E10 | `app/public/shared/tokens.css`, `app/public/shared/app.css` | tokens `--type-card-red-size: var(--type-h2-size)` (22px) and `--type-card-red-weight: 700`; `.verdict-red` now sets both (it was 22px at weight 400, in ink) | yes |
| E11 | `app/public/features/locator/screens.css` | `.loc-empty a, .loc-only a { color: var(--color-ink); }`: the LOC-11 official source link in the sand `.loc-empty` box was San Marino on Wheatfield (4.38:1), a real case of the new rule | yes |
| E12 | `app/test/shared/contrast.test.ts` (new) | fails if the red card text resolves under 19px, under weight 700, or not ink, if any rule inside the card overrides them, if MuseoModerno has no 700 face, or if a sand box sets blue text or leaves links blue; checked by setting the size to 18px, the weight to 600 and removing E11, each caught | yes |

Contrast checked: ink on Pelati Red 4.40:1, white on Pelati Red 3.70:1, San Marino on Wheatfield 4.38:1,
ink on Wheatfield 12.69:1, San Marino on the sand-tinted `--color-surface` 5.16:1 (allowed).

Orchestrator edits to builder code, running total: H1 to H5 and E2 to E12, **16**. Contract breaks
unchanged: blocking 0, non-blocking 4 (all closed).

## Map coordinates, 2026-11-05

Kiley entered coordinates from Google Maps for the seven sourced sites (f-sea-01 to f-sea-04, f-atx-01, f-hc-03, f-hc-04). The MERGE-PLAN section 5 item "map coordinates" is cleared; nothing now blocks the scored runs.

## Map coordinates and locator tests (2026-11-05)

Kiley entered coordinates for the seven sourced sites (f-sea-01 to f-sea-04, f-atx-01, f-hc-03, f-hc-04),
commit 2383f7b. Three locator tests then failed because they asserted that the real CSV has no pins. The
data was not changed; the tests were.

**Contract defect CD-7 (orchestrator-owned).** BRIEF-locator check 11 told the builder "with today's CSV
(none filled) it shows 'No mapped locations yet; see the list'", so the builder wrote tests that relied on
temporary data. Not counted as a builder break.

| Id | File | Edit | Builder code? |
|---|---|---|---|
| E13 | `app/test/locator/screens.test.ts` | check 11 (no pins) now runs on fixture data: the real response with every pin removed. Checks 11 and 12 (pinned map) now pin exactly f-sea-01 and f-sea-02 and remove every other pin, so it still expects two markers and the "more without a map location" line | yes |
| E13 | `app/test/locator/sites.test.ts` | the real-CSV test keeps the rule-link check, now explicit against each place's pack, and replaces "no pin yet" with: lat and lng both set or both empty, valid numbers in range, inside a rough box for the record's place (Seattle 47.4 to 47.8, -122.5 to -122.2; Austin 30.0 to 30.6, -98.0 to -97.5; Hawaiʻi County 18.8 to 20.4, -156.2 to -154.7), and the served `pin` matches the CSV | yes |

All seven coordinates fall inside their place's box. Results: locator suite 32 of 32; full suite 208 of 208;
typecheck clean.

Orchestrator edits to builder code, running total: H1 to H5 and E2 to E13, **17**. Contract defects: CD-1 to
CD-7. Contract breaks unchanged: blocking 0, non-blocking 4 (all closed).
