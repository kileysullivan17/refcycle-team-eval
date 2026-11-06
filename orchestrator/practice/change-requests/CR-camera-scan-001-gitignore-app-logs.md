# CR-camera-scan-001: root .gitignore does not cover app/logs

- Slice: camera-scan
- Date: 2026-11-05
- Contract section: CONTRACTS.md section 4 (log `logs/identify.jsonl`), section 9 (`logs/display-swaps.jsonl`), section 2.1 (`.gitignore` is read-only for builders)

## What the contract says

The app appends `logs/identify.jsonl` (and the shell appends `logs/display-swaps.jsonl`). The base commit's
root `.gitignore` has the line `logs/*.jsonl`.

## The problem

A pattern with a slash in the middle is anchored to the directory of the `.gitignore`, so `logs/*.jsonl`
matches only `/logs/*.jsonl` at the repo root. The app writes to `app/logs/` (path resolved from the module
location, so it does not depend on the working directory). Evidence, run in this worktree:

```
$ touch app/logs/identify.jsonl && git check-ignore -v app/logs/identify.jsonl ; echo rc=$?
rc=1                                  (not ignored)
$ touch logs/x.jsonl && git check-ignore -v logs/x.jsonl
.gitignore:5:logs/*.jsonl	logs/x.jsonl   (ignored)
```

So the first real run of the app, or of any test that uses the default log path, leaves an untracked
`app/logs/*.jsonl` that `git add -A` would commit. The identify log holds only time, status, label, model and
duration (no image data), but it is still runtime data that should not be committed.

## Proposed change

In the root `.gitignore`, change `logs/*.jsonl` to `**/logs/*.jsonl` (or add `app/logs/*.jsonl`).

## Slices affected

All three: the shell writes `app/logs/display-swaps.jsonl` the same way. No code change in any slice.
Camera scan tests do not depend on it: they write their logs to a temp directory.

## Orchestrator reply (2026-11-05)

Type: **clarification**, approved and applied. The root `.gitignore` is base configuration written by the
orchestrator, and the pattern was the orchestrator's error (merge-log CD-3). No interface or behavior changes.

Applied on main in commit d579e51: `logs/*.jsonl` became `**/logs/*.jsonl`. Checked with `git check-ignore`:
both `logs/x.jsonl` and `app/logs/x.jsonl` are now ignored, and a merged-app smoke run left no untracked log
file. Same answer as CR-recyclopedia-001.
