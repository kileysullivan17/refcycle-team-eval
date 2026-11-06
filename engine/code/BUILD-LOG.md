# Build log: Codex (real build, scored)

One copy per build, kept in that build's repo. Log every human message. The counts are data.

## Setup

- Repo: refcycle-b (~/refcycle-builds/refcycle-b, outside career-agent)
- Cursor version: 3.27.22
- Cursor AI features off (Tab and built-in agent):
- Coding agent and version: Codex CLI 0.166.0, launched with ~/refcycle-builds/start-real-b.sh (--approve-for-me)
- Model the coding agent ran on: GPT-6 Astra (gpt-6-astra) (pinned in ~/refcycle-builds/start-real-b.sh; KS confirmed "GPT-6-Astra" at startup 2026-11-01 15:10)
- Builder billing: ChatGPT Pro ($100 tier), upgraded by KS 2026-11-01 so Astra limits do not stall the build (Plus estimated at 5 to 45 Astra messages per 5 hours)
- Runtime model for the app: Run 1 claude-sonnet-5-5 (Anthropic); Run 2 gpt-6.1-sol (OpenAI)
- Seeded before start (identical in both repos): rules/ (3 packs and _FORMAT.md), eval/dev.csv (18 cases, notes column blank), shared-build-brief.md, .gitignore (.env, node_modules/)
- Start date and time: 2026-11-01 15:09 HST (user-recorded brief submission; first agent milestone note was written at 2026-11-02T01:10:52Z)

## Milestones

Per eval-spec 9.4: no per-milestone time box. Record each milestone's commit time and the total build time.

| Milestone | Start | Commit time | Met? | Interventions |
|---|---|---|---|---|
| M1 Skeleton | 2026-11-01 15:09 HST | 2026-11-01T15:10:56-10:00 | Yes: startup validation and 2 tests | 0 |
| M2 Contract | after M1 | 2026-11-02T01:12:15.636041+00:00 | Yes: typecheck and 8 tests | 0 |
| M3 The agent | after M2 | 2026-11-02T01:48:09.706469+00:00 | Yes: live providers, 15 local tests, dev 14/18 | 2 |
| M4 Behavior | after M3 | 2026-11-02T01:54:02.558733+00:00 | Yes: 26 local, 17/17 live behavior, dev 14/18 reported | 0 |
| M5 UI and handoff | after M4 | 2026-11-02T01:59:04.423765+00:00 (commit checkpoint) | Yes: 26 local, 11 browser checks, live UI and startup | 0 |

Total build time: 50.1 minutes wall clock from the user-recorded brief submission through the M5 checkpoint, including credential/approval waiting.

## Interventions

Type is one of: **clarification** (answered a question), **correction** (told it something was wrong),
**unblock** (it was stuck), **scope** (pulled it back to the brief), **hand-edit** (a human changed a file).

| # | Time | Milestone | Type | What was said or done | Shared with the other build? |
|---|---|---|---|---|---|
| 1 | M3; exact message time not captured | M3 | clarification | User supplied .env keys and confirmed Anthropic/OpenAI model IDs (verbatim below). | Not known |
| 2 | M3; exact message time not captured | M3 | unblock | User explicitly authorized sending packs including field observations and queries to both providers after automatic approval review rejected the run (verbatim below). | Not known |

## Observations

Things worth noting that the tables don't capture. Write them as they happen, not afterward.

Initial human message: full build brief, preserved verbatim in shared-build-brief.md. Environment supplied repo, shell, date, timezone, and sandbox roots.

Clarification pending (M1): requested runtime keys in .env and confirmation of model IDs listed in this log. No secrets requested in chat.

M3 work in progress: implemented environment loading, both HTTP provider adapters, full-pack selection prompt and dev CSV evaluator. Typecheck and all 12 local tests pass. `npm run eval` exits before model calls because no .env/configuration exists. Output saved to artifacts/dev-run-blocked.txt. Awaiting answer to the credential/model clarification; no dev pass rate claimed, and no M3 completion commit made.

Human follow-up (M3): “Keys are in .env now. Use LLM_PROVIDER=anthropic and LLM_MODEL=claude-sonnet-5-5 for the dev run; gpt-6.1-sol is the OpenAI model. Continue.” This resolves the credential/model clarification.

Automatic approval review rejected the Anthropic dev run before execution, stating that sending unpublished field observations in the selected pack requires explicit authorization. Asked the user to authorize sending selected packs and test queries to Anthropic and OpenAI. No model request was made by this rejected command.

Human authorization (M3): “Yes, you’re authorized to send the rules packs, including the field observations, and the dev queries to Anthropic and OpenAI. That is how the app is meant to work. Continue.”

M3 complete: OpenAI smoke 3/3; Anthropic dev 14/18 after fixing a deprecated temperature parameter and reducing unnecessary clarification through a general wording change. Earlier results retained in artifacts. No pack/dev edits.

M4: 17/17 live behavioral checks and 26 local tests pass. Final dev 14/18 (A/B/C/D 3/3 each; E 0/3; F 2/3). Four clarification mismatches remain, documented rather than hardcoded away.

M5 complete: 26 local tests, TypeScript, 11 browser checks including a live Anthropic-backed response, mobile/desktop screenshots, and the documented npm run dev startup all verified. README and DECISIONS include measured limitations. Supplied rules/dev CSV unchanged; .env and runtime logs ignored by Git.
