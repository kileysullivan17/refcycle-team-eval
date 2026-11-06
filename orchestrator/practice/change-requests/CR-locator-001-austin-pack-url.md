# CR-locator-001: the Austin pack does not load with the engine's `loadPacks`

- Builder: locator
- Date: 2026-11-05
- Contract section: 6 ("Load packs with `loadPacks` ... pointed at `engine/rules`"), 2 (the app imports
  `loadPacks` from `engine/code/src/rules.ts`), and the shared pack format (`engine/rules/_FORMAT.md`)
- Kind: blocker for the whole app, not only the locator

## What the contract says

The locator loads the three public packs in `engine/rules/` with the engine's `loadPacks`.

## The problem

`loadPacks('engine/rules')` throws on `austin_tx.yaml`. `Source.url` is `z.string().url().nullable()`, and
three `business_page` sources in the public Austin pack carry the placeholder `"[withheld: business page]"`
(src-05, src-06, src-07, `engine/rules/austin_tx.yaml` lines 47, 54, 61), which is not a URL.

Evidence (run from `engine/code` after `npm ci`):

```
loadPacks('rules') -> ZodError: invalid_format url, path sources.4.url / sources.5.url / sources.6.url
```

The same call succeeds when those three values are `null` (checked on a copy in a scratch folder; no file
under `engine/` was changed). The engine's own server calls the same function, so the pinned engine cannot
start on these packs either, which will affect the live end-to-end check at merge.

## Proposed change

Either of these, orchestrator's choice (both are outside the locator's paths):

1. In `engine/rules/austin_tx.yaml`, set `url: null` on src-05, src-06 and src-07 (the format already allows
   null and says business names stay private), or
2. relax `Source.url` in `engine/code/src/rules.ts` to accept the placeholder.

## What I did meanwhile

Production code (`routes.ts`, `sites.ts`) calls `loadPacks` as the contract says, so `GET /api/sites` returns
500 with the load error until this is fixed. My tests and dev harness run against a temporary copy of the three
packs in which only those three values are replaced by `null`; the copy is made at run time and nothing under
`engine/` is edited. When the packs load unchanged, the copy step has no effect.

## Affects

Every slice that starts the engine (Recyclopedia shell, Camera scan live checks) and the orchestrator's merge
check.

## Orchestrator reply (2026-11-05)

Type: **change**, outside the orchestrator's authority (it touches `engine/rules` or `engine/code`). Sent to
Kiley as decision K1. Not applied.

Confirmed: `loadPacks('rules')` in `engine/code` throws on `austin_tx.yaml` (sources 4, 5 and 6, "Invalid
URL"), so neither the pinned engine nor `GET /api/sites` can start on the public packs. This is also a
contract defect on the orchestrator's side (merge-log CD-1): CONTRACTS 2 and 6 said to load these packs with
`loadPacks` without checking that they load.

Recommendation to Kiley: option 1, set `url: null` on src-05, src-06 and src-07 in
`engine/rules/austin_tx.yaml`. The format already allows a null URL, the names stay private, and the engine
code stays as pinned. The engine reads only a rule's `source` and `destination_source` when it builds
`source_urls`; these three sources appear only as `also_acceptable_source` (atx-metal-020) or in a comment, so
no engine answer changes. Option 2 would change the pinned engine's validation for every pack.

Until K1 is decided: `/api/sites` returns 500 on main and the item page hides its `where` block (it handles
the failure). The locator's tests keep using their run-time copy; remove that copy step once the pack loads.

## Outcome (2026-11-05)

Kiley approved option 1 (K1, `orchestrator/MERGE-DECISIONS.md`). Applied on main by the orchestrator: `url:
null` on src-05, src-06 and src-07 in `engine/rules/austin_tx.yaml`, nothing else under `engine/` changed.
The pinned engine's `loadPacks` now loads all three packs, and `GET /api/sites` returns 200 for each place on
the real packs (Seattle 6, Austin 6, Hawaiʻi County 14 records). The locator tests now read `engine/rules`
directly (the run-time copy is gone), and the 500 body no longer includes the load error. The same fix is
owed to the public packs in kileysullivan17/refcycle-eval (Kiley's follow-up). Closed.
