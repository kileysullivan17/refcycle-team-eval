# RefCycle agent team eval: results

> RefCycle began as a student concept by a five-person team in the Berkeley UX/UI Boot Camp, UC Berkeley Extension, January 2024. This rebuild and evaluation are solo work.

## What was tested

Three RefCycle features (Recyclopedia, Camera scan, Recycling center locator) were built twice from the same approved PRD and contracts v1.3:

- **Solo baseline:** one Claude Sonnet 5.5 agent, one session, no delegation.
- **Agent team:** an orchestrator (Claude Opus 5.5) wrote the briefs and merged; three Sonnet 5.5 builders worked in parallel.

Both builds called the same pinned engine on Claude Sonnet 5.5 and were driven through their own screens by the same harness on Kiley's Mac on 2026-11-05: the baseline from 14:28 to 14:44 HST, the team from 14:44 to 15:00 HST. Each case ran once. Every percentage comes with its count, and a gap of one or two cases between builds is not a finding.

## Predictions, written before any build existed

| Prediction (Kiley) | Result |
|---|---|
| The agent team scores higher, because of its checks and balances | Not supported: the builds tied within one case on every measure |
| Recyclopedia is the weakest feature | Partly: its misses were the HI-5 deposit cases, which the camera scan also missed; the locator was strongest |
| The expected contract break: a slice asserting the wrong thing about materials that are not accepted | Did not happen; the scored team's only break was an em dash in a test |
| 5 PRD changes | 0: Kiley answered 25 open questions and changed no requirement the orchestrator wrote |

## Test split

| Measure | Target | Solo baseline | Agent team |
|---|---|---|---|
| Confident-wrong, Recyclopedia and Scan | 2% or less | 5.6% (3 of 54) | 5.6% (3 of 54) |
| Recyclopedia accuracy, answerable | 90% or more | 100% (26 of 26) | 100% (26 of 26) |
| Recyclopedia abstention recall | 80% or more | 100% (2 of 2) | 100% (2 of 2) |
| Recyclopedia citation validity | 95% or more | 100% (27 of 27) | 100% (28 of 28) |
| Locator accuracy | none set | 100% (18 of 18) | 100% (18 of 18) |
| Locator facilities shown with no source | 0 | 0 of 32 | 0 of 32 |
| Scan: wrong item, no follow-up | 2% or less | 0% (0 of 24) | 0% (0 of 24) |
| Scan identification correct | none set | 100% (24 of 24) | 100% (24 of 24) |
| Scan routed accuracy, answerable | 90% or more | 95.2% (20 of 21) | 95.2% (20 of 21) |
| Scan over-abstention | 10% or less | 4.5% (1 of 22) | 0% (0 of 22) |
| Scan: item and answer both right | none set | 91.7% (22 of 24) | 91.7% (22 of 24) |
| Page did not show the engine's verdict | none set | 0 of 30 | 0 of 30 |

Scan rows use the answer key after one change, made after results (ph22, below); before it, identification was 23 of 24, routed accuracy 19 of 21 and item-and-answer 21 of 24 for both builds. Both builds miss the confident-wrong target on the test split, with the same three cases.

## Held-out final

| Measure | Solo baseline | Agent team |
|---|---|---|
| Confident-wrong, Recyclopedia and Scan | 0% (0 of 16) | 0% (0 of 16) |
| Recyclopedia accuracy | 80% (8 of 10) | 90% (9 of 10) |
| Locator accuracy | 100% (6 of 6) | 100% (6 of 6) |
| Scan: item and answer both right | 100% (6 of 6) | 100% (6 of 6) |

## Invented rules (blind)

| Grade | Solo baseline | Agent team |
|---|---|---|
| 2, faithful | 87 | 86 |
| 1, loose | 5 | 6 |
| 0, invented | 0 | 0 |

Ten of the eleven 1s, five per build, are the same wording: the explanation of two Hawaiʻi County phone-report rules adds "before the final run" to the report date. That phrase is in the rules pack's own source record, which the grader did not see, so the engine quoted the pack faithfully. It was internal wording that should not reach residents, and Kiley had it removed from the pack after scoring ("2026-11-03 (phone call)" now); the scored runs used the old wording. The one real loose answer was the team's: its follow-up question for the oil-based paint photo added a water-based paint option that neither cited rule covers. It asked rather than answered.

## Every case either build got wrong

| Case | Place | Item | Expected | Baseline | Team |
|---|---|---|---|---|---|
| rp13 (test) | Hawaiʻi County | clear plastic water bottle, searched | follow-up (HI-5 or not) | deposit return | deposit return |
| rp25 (test) | Hawaiʻi County | soda can, searched | follow-up (HI-5 or not) | deposit return | deposit return |
| ph10 (test) | Hawaiʻi County | soda can photo, no marking | follow-up (HI-5 or not) | deposit return | deposit return |
| ph13 (test) | Austin | flattened cardboard box photo | Recycling | abstain | correct |
| ph21 (test) | Seattle | oil-based paint can photo | Special drop-off | correct | follow-up question |
| rp41 (held-out) | Austin | seltzer bottle | Recycling | conditional (both cases Recycling) | correct |
| rp46 (held-out) | Austin | salsa jar | Recycling | conditional (both cases Recycling) | conditional (both cases Recycling) |

## Changes to the answer key, and what they did

| Case | Change | Decided | Effect |
|---|---|---|---|
| ph22, banana peel and apple core photo | Asking which item is now correct, as for the other two-item photo (ph24); answering Compost is also correct | Kiley, 2026-11-05, after results | Both builds gain the case: identification 23 to 24 of 24, item-and-answer 21 to 22 of 24 |

The frozen key (SHA-256 ab03722e…745d for the camera key) is kept unchanged beside the amended one (07f29e35…094cc), and both gradings are kept. The grader's rule for this photo was changed to match and logged.

## What the numbers say

**The two structures scored the same.** Across 94 scored cases each, the builds differ on three cases: two went the team's way (ph13, rp41) and one the baseline's (ph21). That is noise at this size.

**Both stayed safe in the ways the first eval measured.** No invented rules in 184 explanations, no facility shown without a source, no scan naming the wrong item without asking, and every page showed the engine's own verdict.

**Every confident wrong answer came from one shared engine behavior.** In Hawaiʻi County, asked about a soda can or a clear water bottle, the engine assumed the HI-5 deposit applies instead of asking. It did this in both builds, from search and from a photo. The key expects a question because an out-of-state container carries no deposit. This is the engine from the first eval, not either build, and it is the single change that would move both builds under the 2% bar.

### A note on the HI-5 cases

These three cases are scored as misses because the frozen key says so: Kiley decided, before any run, that a soda can or clear bottle in Hawaiʻi County should get a follow-up question, matching the first eval's key. That score stands as the headline.

They are also a narrow edge case, and the practical harm is small. Kiley has redeemed cans in Hawaiʻi County about two dozen times, and no one at a redemption point has once inspected a can for the HI-5 marking. Soda cans and water bottles sold in Hawaiʻi carry the deposit, so "deposit return" is the answer a resident almost always needs, and following it would not have sent anything to the wrong place. The engine's answer is the practical one; the key's question is the strictly correct one, because an out-of-state container technically carries no deposit.

Counted the practical way, a judgment made after seeing the results, confident-wrong on the test split falls to 0 of 54 for both builds, and both meet the 2% bar. The headline numbers above do not use this reading.

**Small display differences favored the team.** The baseline told a resident "The local rules do not cover this item" for a cardboard box when the real problem was an engine failure, which blames the rules for a system fault. The baseline also returned two harmless conditional answers where both cases led to the same bin. The team's one weakness was the paint can follow-up that went past the rules.

## Limits

- One pass per case on a model that is not deterministic.
- Generated photos, uploaded rather than taken with a camera.
- Keys drafted by Claude from the packs, with Kiley's decisions on every CHECK row.
- Contracts v1.3 already holds the practice run's fixes.
- The engine's dependency zod 4.1.11 carries a published high-severity advisory (oversized input); it was left pinned so the engine matches the first eval.
