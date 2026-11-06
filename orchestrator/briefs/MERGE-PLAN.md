# Merge plan: scored team run

Status: Approved by Kiley Sullivan, 2026-11-05, for the scored team run. Merges against
`orchestrator/CONTRACTS.md` v1.3.

## 0. Base

The three builder branches start from `scored-base` (6920487 plus the commit that adds these briefs) in
the clone `/home/claude/refcycle-scored/team`. The base holds `specs/`, `engine/` (pinned engine, public
rules packs, facility list with coordinates), `orchestrator/` (PRD, contracts, decision records, these
briefs), `SCORED-RUN.md`, the root `.gitignore`, and the shared app configuration (`app/package.json`,
`app/package-lock.json`, `app/tsconfig.json`, `app/.env.example`). It holds no app code.

Branches and worktrees (created by the session assistant, see `orchestrator/briefs/BUILDER-DISPATCH.md`):
`scored/recyclopedia`, `scored/camera-scan`, `scored/locator`, under
`/home/claude/refcycle-scored/team-wt/<feature>`.

Merges go into a new branch `scored/team`, created from `scored-base` when merging starts, so
`scored-base` stays the common starting point for both scored runs. The orchestrator starts a fresh
`orchestrator/merge-log.md` on `scored/team` with the first merge.

## 1. Merge order and why

1. **Recyclopedia** (`scored/recyclopedia`): the app server, route loading, router, place picker, header,
   tab bar, item page, `displayText` and `tokens.css`. The other two plug into these.
2. **Locator** (`scored/locator`): fills the item page's `where` block and makes Dispose work.
3. **Camera scan** (`scored/camera-scan`): needs only the item page route. Last, because it is the only
   slice with a live model dependency, so its live check runs once, on the complete app.

Each merge is `git merge --no-ff`. A branch that fails a blocking check goes back to its builder with the
findings. The orchestrator resolves textual merge conflicts, and edits builder code only when a check
fails because of a contract defect or a cross-slice conflict the builders could not see; every such edit
is logged.

## 2. Checks at every merge

Run in this order; stop at the first blocking failure.

1. **Ownership.** `git diff --name-only scored-base...<branch>` touches only the paths in that builder's
   brief section 5 (CONTRACTS 2.1), plus its own `orchestrator/change-requests/CR-<feature>-*.md` files.
2. **Read-only files.** `git diff scored-base...<branch> -- engine/ specs/ SCORED-RUN.md .gitignore
   app/package.json app/package-lock.json app/tsconfig.json app/.env.example` is empty, and nothing under
   `orchestrator/` changed except change-request files.
3. **Build and tests.** `npm ci`, `npm run check` and `npm test` in `app/` pass on the merged tree,
   including every earlier slice's tests. Every milestone commit on the branch was green (spot-check by
   running the tests at those commits in a scratch worktree if the hand-back report is unclear).
4. **Interfaces.** The feature module exports `handle` and `mount` with the signatures in CONTRACTS 2.1;
   the shell loads it; its client routes resolve; a missing module still shows "not available yet".
5. **API schemas.** `/api/catalog`, `/api/sites` (on the real packs) and `/api/identify` (no key: 502, and
   a fake provider) match CONTRACTS 4, 5, 6 and 7. `/api/ask` and `/api/jurisdictions` through port 3001
   match the engine byte for byte.
6. **Content scan** of the merged `app/` tree (excluding `node_modules` and `vendor/`) and rendered
   pages: no em dashes; no "Score!", "Hazardous", "decompose", "Percentage recycled" outside tests and
   filters; no "Big Island Biodiesel" in rendered output; no `internal_notes` in any response; no
   geolocation call; no external URL except the configured provider APIs (server) and the two
   OpenStreetMap URLs (browser); no stream or rule text outside the display mapping of CONTRACTS 8 and test
   fixtures.
7. **Styles and contrast** (CONTRACTS 11): tokens only; font sizes through type tokens; spacing in 4px
   multiples through `--space-unit`; red card text ink, bold, 19px or more; no San Marino on Wheatfield.
8. **Acceptance checks** from the merging builder's brief section 8, rerun by the orchestrator.

## 3. After each merge

- **Recyclopedia:** picker, catalog (50 entries, 10 categories), search, all eight item states against a
  fake engine, `displayText` and its log, "not available yet" for `/scan` and `/locations`.
- **Locator:** item page `where` block filled from `/api/sites`; Dispose opens the locator with the right
  `rule_ids`; list for each place with no item; map shows the pinned records; conditional grouping;
  Recyclopedia checks rerun.
- **Camera scan:** `/scan` to `/scan/confirm` to `/item?q=...&origin=scan`. Then the live end-to-end pass,
  run on Kiley's machine with his key: for each place, one catalog entry, one free search, one photo and
  one Dispose path, recording the engine's behavior for each. No expected answers are assumed; the check is
  that every screen shows the engine's response and the contract states.

## 4. Counting

All counts go in `orchestrator/merge-log.md` on `scored/team`, each with id, slice, merge step, check that
found it, contract or brief section, description, and resolution.

- **Contract break:** anything in a merged branch that departs from CONTRACTS.md v1.3 (or a later approved
  version) or from the brief's paths and interfaces, without an approved change request. One per distinct
  departure, however many files show it.
  - **Blocking:** wrong path ownership, edits to read-only files, an API or interface that does not match,
    forbidden content (business names, rule text, invented facts), a missing display state, failing
    tests on the merged tree caused by the branch. The branch goes back to its builder.
  - **Non-blocking:** a departure that changes no interface or behavior another slice or the resident
    depends on. Logged, and fixed by the builder in a follow-up commit.
- **Not breaks, counted separately:** change requests (by outcome: clarification, approved change,
  rejected), textual merge conflicts, contract defects (a failure caused by a contract or brief that was
  itself wrong or silent; owned by the orchestrator), and process deviations (for example a milestone
  without its own commit).
- **Orchestrator edits to builder code:** each one logged with file, edit and reason.
- **Builder messages:** every message the session assistant sends a builder after launch, from
  `orchestrator/builder-log.md`.

The merge log ends with totals per slice: breaks (blocking, non-blocking), change requests by outcome,
merge conflicts, contract defects, process deviations, orchestrator edits and builder messages.
