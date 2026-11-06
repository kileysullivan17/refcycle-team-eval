# Reviewer brief: scoring the RefCycle scored runs

You are the reviewer agent. You score two builds of the same three RefCycle features against frozen answer keys, the same way for both. You never change a build.

## The builds

- Solo baseline: /home/claude/refcycle-scored/baseline, branch scored-base, head a6b297f. Score this one first.
- Agent team: merged later into /home/claude/refcycle-scored/team on branch scored/team. You will be told when it is ready.

Both are a TypeScript web app (app/, port 3001) in front of the same pinned engine (engine/code, port 3000), built to orchestrator/PRD.md and orchestrator/CONTRACTS.md v1.3. Read the PRD and contracts in the baseline clone; they are identical in both builds.

## The keys (frozen, read-only)

/home/claude/refcycle-private/frozen-2026-11-05/: recyclopedia.key.csv (50 cases), locator.key.csv (30), camera-scan.key.csv (36, with the photos in photos/), and SHA256SUMS.txt. Verify the checksums before you use them and record the result. Each key has practice, test and held_out splits. Score test and held_out separately; practice is for checking the harness only. Never copy keys or photos into either build's folder.

## Scoring rules

Follow the first RefCycle eval's definitions in /home/claude/refcycle-eval/EVAL.md and RESULTS.md (confident-wrong, accuracy on answerable cases, abstention recall, over-abstention, citation validity, invented rules), and the locked ship bar in the plan, which adds three measures:

- Locator: facilities shown with no source (target 0).
- Scan: wrong item identified, with no follow-up question (target 2% or less).
- Team build: contract breaks (target 0; taken from the orchestrator's merge log, not scored by you).

Key columns: expected_behavior may list several acceptable behaviors separated by ";"; acceptable_streams likewise; rule_ids_expected lists the rules a correct answer cites. "conditional" and "clarify" are both answers that do not commit to one stream. A Locator case expects facility_ids_expected (the records the screen should list) or one of the behaviors curbside, none_listed, abstain, conditional. A Camera scan case has two parts: identification (the label is a fair generic name for identification_expected, with no brand) and the routed answer for its place.

## The harness

1. Drive each build the way a user does, through its own UI, so neither build is favored by how its API happens to be shaped: headless Chrome via playwright-core. Recyclopedia: pick the place, type the search phrase, follow the app's own path to the item page, read what the page shows. Camera scan: upload the photo through the scan screen's file input, confirm the suggested label, read the item page. Locator: from the item page, follow Dispose (or open Locations for the item) and read the listed sites. Capture for every case: the visible verdict or state, the stream label, cited rule ids if the page exposes them, the listed facility names, the scan label, and the raw /api/ask and /api/sites responses observed on the network.
2. The harness must run unchanged against either build: point it at a folder and a port.
3. Model calls cannot run from this sandbox or from the sandboxed shell on Kiley's Mac. The scored runs execute on Kiley's Mac from his own Terminal, like the earlier live check (see /home/claude/refcycle-team-build/orchestrator/merge-log.md, "Live end-to-end smoke check"): his Mac has Node 22 and Google Chrome is likely installed (use playwright-core with channel "chrome"; fall back to a clear error). His key is in ~/refcycle-builds/refcycle-b/.env and is copied to engine/.env and app/.env on his Mac only; run the engine with LLM_PROVIDER=anthropic LLM_MODEL=claude-sonnet-5-5 and the app with LLM_IMAGE_PROVIDER=anthropic LLM_IMAGE_MODEL=claude-sonnet-5-5. Packages must be installed natively on the Mac (npm ci in the run script). Start the engine from engine/ so its default rules folder resolves, as run-live-check.sh does.
4. Prove the harness here first, against the baseline with a fake engine and a fake image provider, on the practice cases only. Do not run test or held-out cases anywhere except the real scored run.
5. Produce: harness code and a single run script for Kiley (one command, writes all raw outputs to one results folder and stops the servers at the end), and a grading script that reads the raw outputs and the keys and writes per-case grades and the summary metrics.

## Blind grading of invented rules

Explanations are graded for invented rules blind, as in the first eval: after both builds have run, export every explanation with build identity removed and shuffled, and have it graded without knowing which build wrote it. You prepare that export; the session assistant runs the blind grader.

## Rules

- Never edit either build. If a build cannot be driven for a case (a crash, a missing control), that case is scored as the build's failure, with the reason recorded.
- Write everything under /home/claude/refcycle-scored/review/.
- No em dashes in anything you write.
- Report back with: the harness design in a few lines, the practice-case dry run result, the exact command for Kiley, and anything that worries you about fairness between the two builds.
