# Merge log: scored team run

Merges of the three scored builder branches into `scored/team` (created from `scored-base` at 0f8e5f3), in
`/home/claude/refcycle-scored/team`, following `orchestrator/briefs/MERGE-PLAN.md` and `CONTRACTS.md` v1.3.
Orchestrator, 2026-11-05. The live end-to-end check (MERGE-PLAN 3, after Camera scan) has **not** been run:
it needs Kiley's key and runs on his machine.

Builder heads merged: `scored/recyclopedia` 60c2d54, `scored/locator` 289ff3d, `scored/camera-scan` faf8e27.
Messages from the session assistant to team builders after launch: **0** (the scored builder log's one row is
an addendum to the solo baseline, not a team builder).

## Merges

| Step | Branch | Merge commit | Result |
|---|---|---|---|
| 1 | `scored/recyclopedia` | c0b8fd9 | Merged. Every check passed with no edits: 105 of 105 tests, typecheck clean. |
| 2 | `scored/locator` | a7e528c | Merged. Every check passed: 187 of 187 tests on the merged tree, typecheck clean. Content scan found one literal em dash in a test file (NB-1). |
| 3 | `scored/camera-scan` | 2c757e8 | Merged. Every check passed: 246 of 246 tests, typecheck clean. |
| fix | locator test | (this commit) | NB-1 fixed by orchestrator edit O1: 246 of 246 tests, typecheck clean. |

No textual merge conflicts.

## Checks per merge (MERGE-PLAN 2)

| Check | Recyclopedia | Locator | Camera scan |
|---|---|---|---|
| 1 Ownership | pass | pass | pass |
| 2 Read-only files untouched | pass | pass (only its two CR files under `orchestrator/`) | pass |
| 3 `npm ci`, check, tests on the merged tree; every milestone commit green | pass (5 of 5 commits green) | pass (5 of 5) | pass (5 of 5) |
| 4 Interfaces (`handle`, `mount`, loading, "not available yet") | pass | pass | pass |
| 5 API schemas | pass: `/api/catalog` 10 and 50; engine down gives 502; 404 for a missing feature module | pass on the real packs: Seattle 6 records (4 pinned), Austin 6 (1), Hawaiʻi County 14 (2); every record has exactly the contract keys; `official_source` and `applies_to` present; no `internal_notes`; `only_site` true for f-hc-06 | pass: no key gives 502 and the server starts; GIF gives 400; `/scan` and `/scan/confirm` resolve; the identify log is git-ignored |
| 6 Content scan | pass | NB-1 (em dash), otherwise pass | pass |
| 7 Styles and contrast | pass: red card label ink, `--type-card-red-size` and `-weight`; links on sand are ink | pass: blue text only on white buttons; links ink everywhere | pass: sand panels set ink text |
| 8 Builder acceptance checks | pass (rerun in the merged suite) | pass | pass (live provider untested by design) |

Every milestone commit was checked by running `npm test` and the typecheck at that commit in a scratch
worktree: all 15 green (Recyclopedia 28, 43, 74, 105, 105; Locator 29, 47, 57, 82, 82; Camera scan 18, 32, 40,
59, 59).

Content scan detail: "Big Island Biodiesel" appears only in the swap rule (`display-text.js`) and the
locator's dev harness; "hazardous" and similar words only in camera's advice filter; the only external
hosts are the two provider APIs, the two OpenStreetMap URLs, and license and namespace URLs; stream names
in client code are only the CONTRACTS 8 display mapping; px only for element sizes, borders and outlines.

## Contract breaks

| Id | Slice | Step | Check | Contract | Description | Severity | Resolution |
|---|---|---|---|---|---|---|---|
| NB-1 | Locator | 2 | 6 (content scan) | brief section 9 ("no em dashes in any file you write") | `app/test/locator/static.test.ts` held a literal em dash as the search needle of its own no-em-dash test, and excluded itself from that test | non-blocking | Fixed by orchestrator edit O1 |

Totals: **blocking 0, non-blocking 1** (Recyclopedia 0, Locator 1, Camera scan 0).

## Contract defects (orchestrator-owned)

| Id | Defect | Found by | Status |
|---|---|---|---|
| CD-1 | The facility links the orchestrator drafted tie p-hc-01 to hc-system-000, a service statement ("no curbside pickup"), so LOC-9 makes the detail screen list "curbside pickup" and "rubbish pickup" as items the transfer stations take | CR-locator-001 | Decision S1 for Kiley |
| CD-2 | CONTRACTS 7.3 lists `event_last_date` values without saying where they come from, and the CSV has no column for them | CR-locator-002 | Clarified (built reading is approved); optional S2 |

## Process deviations

None. Every milestone has its own commit and every commit is green. (Observations only: Camera scan's M3
commit already holds the confirm screen code, tested in M4; Locator's M5 hand-back commit also carries
small spacing changes.)

## Orchestrator edits to builder code

| Id | File | Edit | Why |
|---|---|---|---|
| O1 | `app/test/locator/static.test.ts` | the em dash needle is now the escape `'\u2014'`, and the test no longer excludes its own file | NB-1. MERGE-PLAN 4 has the builder fix non-blocking breaks; the builders have finished, the fix changes no behavior, so the orchestrator made it |

Total: **1**.

## Change requests

| CR | Outcome |
|---|---|
| CR-locator-001-detail-service-rule | Change (interface or CSV): to Kiley as S1, recommended option 2. Not applied |
| CR-locator-002-event-last-date-source | Clarification, approved as built (orchestrator); optional S2 for Kiley |

## Totals

| Slice | Breaks (blocking, non-blocking) | Change requests | Merge conflicts | Contract defects | Process deviations | Orchestrator edits | Builder messages |
|---|---|---|---|---|---|---|---|
| Recyclopedia | 0, 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Locator | 0, 1 | 2 (1 to Kiley, 1 clarification) | 0 | 2 | 0 | 1 | 0 |
| Camera scan | 0, 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **All** | **0, 1** | **2** | **0** | **2** | **0** | **1** | **0** |

Tests on `scored/team`: 246 of 246 (Recyclopedia and shell 105, Locator 82, Camera scan 59), typecheck clean.

## Decisions for Kiley

- **S1 (CR-locator-001).** Stop the transfer stations detail screen listing "curbside pickup" as an item
  it takes. Recommended: remove `hc-system-000` from the `rule_ids` of p-hc-01 in
  `engine/data/facilities.csv` (CSV change, no code change). The item page still shows that rule's `where`
  text for a curbside question.
- **S2 (optional, CR-locator-002).** Add an `event_last_date` column to the CSV so event dates are data
  rather than parsed from notes. Recommended: not before the scored run; the current reading gives the
  approved values.
