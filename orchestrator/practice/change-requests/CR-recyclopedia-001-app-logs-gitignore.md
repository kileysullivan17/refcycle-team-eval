# CR-recyclopedia-001: app log files are not covered by the root .gitignore

- Slice: Recyclopedia builder (shared shell)
- Date: 2026-11-05
- Contract section: CONTRACTS.md 9 (`logs/display-swaps.jsonl`), 4 (`logs/identify.jsonl`); base commit `.gitignore`
- Kind requested: clarification (no behavior or interface change)

## What the contract says

`POST /api/log/display-swap` appends to `logs/display-swaps.jsonl`, and `/api/identify` writes
`logs/identify.jsonl`. The app runs from `app/` (`npm run dev`), so these files are written to
`app/logs/`. The root `.gitignore` is read-only for builders and contains `logs/*.jsonl`.

## The problem

A `.gitignore` pattern with a slash in the middle is anchored to the folder that holds the
`.gitignore`. `logs/*.jsonl` therefore matches only `<repo root>/logs/*.jsonl`, not `app/logs/*.jsonl`.
Evidence, from the worktree after one manual run:

```
$ echo '{}' > app/logs/display-swaps.jsonl && git status --short
?? app/logs/
$ git check-ignore -v app/logs/display-swaps.jsonl
(no output: the file is not ignored)
```

So a manual run leaves untracked log files in `app/logs/`, and `git add -A` or `git add app` would commit
them. The log lines can hold the swapped place text and, for identify, labels and model names, so they
should not be committed by accident.

## What I did meanwhile

I did not edit `.gitignore` (read-only). I stage files by explicit path, and my tests write their logs to a
temporary folder (the server takes a `logDir` option), never to `app/logs/`.

## Proposed change

Either of these, orchestrator's choice:

1. Add `app/logs/*.jsonl` (or the unanchored `**/logs/*.jsonl`) to the root `.gitignore` at merge.
2. Add a one-line `app/logs/.gitignore` containing `*.jsonl`. This path is not in any builder's
   section 5 list, so it would be created by the orchestrator.

## Other slices affected

Camera scan (`logs/identify.jsonl`) and Locator, if it logs. Both write under the same `app/logs/`.
No code change is needed in any slice.

## Orchestrator reply (2026-11-05)

Type: **clarification**, approved and applied. The root `.gitignore` is base configuration written by the
orchestrator, and the pattern was the orchestrator's error (merge-log CD-3). No interface or behavior changes.

Applied on main in commit d579e51: `logs/*.jsonl` became `**/logs/*.jsonl`. Checked with `git check-ignore`:
both `logs/x.jsonl` and `app/logs/x.jsonl` are now ignored, and a merged-app smoke run left no untracked log
file. Same answer as CR-camera-scan-001.
