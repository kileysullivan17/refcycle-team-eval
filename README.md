# RefCycle agent team eval

> RefCycle began as a student concept by a five-person team in the Berkeley UX/UI Boot Camp, UC Berkeley Extension, January 2024. This rebuild and evaluation are solo work.

This repo holds the second RefCycle eval. Three features (Recyclopedia, Camera scan and the Recycling center locator) were built twice from the same approved PRD and contracts: once by one solo agent, once by an agent team (an orchestrator that wrote the PRD, contracts and builder briefs, plus three builders working in parallel). Both builds were scored by the same harness against answer keys frozen before any scored build finished.

The first eval, which built the guidance engine these features call, is at [kileysullivan17/refcycle-eval](https://github.com/kileysullivan17/refcycle-eval).

## Read first

| File | What it is |
|---|---|
| [EVAL.md](EVAL.md) | The specification: questions, keys, scoring, ship bar, run protocol, threats to validity |
| [RESULTS.md](RESULTS.md) | The numbers, every miss, and the note on the HI-5 cases |
| [BUILD-COMPARISON.md](BUILD-COMPARISON.md) | Cost and process: time, tokens, merge results, the practice run |

## How the build was run

The orchestrator (Claude Opus 5.5) wrote each builder's launch prompt word for word. The session assistant launched the builders, because agents the orchestrator starts cannot start agents of their own. The builders and the solo baseline ran on Claude Sonnet 5.5.

## Folders

| Folder | What it holds |
|---|---|
| `specs/` | The list of 2024 Figma frames the PRD was written from. The 2024 team's deck and Figma file are theirs and are not published here |
| `engine/` | The guidance engine from the first eval (Build B), pinned; the three public rules packs; the facility list. See `engine/code/PINNED.md` for what was changed in this copy |
| `orchestrator/` | PRD, contracts v1.3, gate decisions, scored briefs and merge plan, change requests and the scored merge log. `orchestrator/practice/` holds the unscored practice run's merge log, builder log and change requests |
| `builds/baseline/`, `builds/team/` | The app code of each build exactly as scored, without logs |
| `keys/` | The answer keys as frozen (`frozen-2026-11-05/`) and with the one change made after results (`v2-2026-11-05/`, ph22), each with SHA-256 sums, plus the 36 photos |
| `review/` | The scoring harness, the reviewer brief, gradings for both builds under both keys, and the blind grading sheets |

## Three things to know about the keys and photos

- The keys were drafted by Claude from the rules packs. Kiley Sullivan decided every row marked CHECK and every naming rule; he did not review each of the 116 rows himself.
- The 36 photos were generated in Higgsfield, with no brand names or logos, and checked by hand. Scan scores describe these generated photos, not real phone photos.
- The three Hawaiʻi County HI-5 cases are scored as misses under the frozen key. RESULTS.md explains why, and gives the practical reading beside the headline.

## What is not here

Private business names never appear: private sites are described publicly ("a private recycler in the Shipman Industrial Park"). The engine's run logs, raw model responses and server logs are not published. No `.env` file or provider key is included; each app has a `.env.example`.
