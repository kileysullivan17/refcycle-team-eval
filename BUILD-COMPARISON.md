# RefCycle agent team eval: build comparison

## Setup

| | Solo baseline | Agent team |
|---|---|---|
| Builders | 1 agent, Claude Sonnet 5.5 | 3 agents in parallel, Claude Sonnet 5.5 |
| Coordination | None; the agent was told not to delegate | Orchestrator on Claude Opus 5.5: briefs, change-request triage, merge |
| Inputs | Approved PRD, contracts v1.3, scored base | The same, plus one brief per builder |
| Separate copies | Its own clone | Its own clone, one git worktree per builder |

The PRD and contracts were written by the orchestrator and approved by Kiley before either scored build started, so both builds had the orchestrator's planning. What differs is the build structure: briefs, parallel builders and a merge.

## Time

| Step | Solo baseline | Agent team |
|---|---|---|
| Briefs | none | about 4 minutes |
| Building | 21.5 minutes | 18.3, 11.6 and 9.8 minutes, in parallel |
| Merge | none | about 6 minutes |
| End to end | about 22 minutes | about 28 minutes |

Parallel building did not make the team faster end to end: the shell builder took nearly as long as the solo agent, and the briefs and merge added about 10 minutes.

## Tokens

| | Tokens |
|---|---|
| Solo baseline | 344,320 |
| Team builders (Recyclopedia and shell, Locator, Camera scan) | 836,992 (312,612; 275,790; 248,590) |

The team's builders alone used about 2.4 times the baseline. The orchestrator's tokens are not included: its reported count covers its whole running session since the practice run, so no fair figure exists for the scored run alone. The real ratio is higher than 2.4.

## Human messages after the brief

| | Solo baseline | Agent team |
|---|---|---|
| Messages to builders after launch | 1 (the common-rules addendum, sent to keep inputs equal) | 0 |
| Decisions asked of Kiley after the briefs | 0 | 1 (S1, a facility list fix, then applied to both builds) |

## What each build produced

| | Solo baseline | Agent team |
|---|---|---|
| Tests at the end | 134, all passing (33 drive Chrome) | 246, all passing |
| Choices recorded where the contracts left room | 17 (D1 to D17) | Recorded per builder, in each report |
| Change requests | not applicable | 2 (one data quirk, one clarification) |
| Contract breaks at merge | not applicable | 0 blocking, 1 non-blocking (an em dash in a test) |
| Orchestrator edits to builder code | not applicable | 1 |
| Contract defects owned by the orchestrator | not applicable | 2 |
| Merge conflicts | not applicable | 0 |

## The practice run, for comparison

The unscored practice run used the same team structure on contracts v1.1:

| | Practice run | Scored team run |
|---|---|---|
| Contract breaks | 0 blocking, 4 non-blocking | 0 blocking, 1 non-blocking |
| Orchestrator edits to builder code | 17 | 1 |
| Contract defects owned by the orchestrator | 7 | 2 |
| Change requests | 4 | 2 |

Most of the practice run's problems were contract gaps the orchestrator then wrote into v1.3 and the scored briefs: a public rules pack that failed the engine's schema, a gitignore pattern that missed the app's logs, tests that depended on data that would change, and no type tokens or 4-pixel spacing step. The scored run's cleaner merge is mostly that learning, which the solo baseline also received.

## Observations

1. **On a well-specified build, the structure did not change the outcome.** With an approved PRD and contracts, one agent and a coordinated team produced apps that scored the same, safely. The planning carried the result; either structure could follow it.
2. **The team's value showed up as process, not scores.** It produced written change requests, a merge log, named contract breaks and an audit trail that tells a reviewer exactly what each builder owned. The solo agent's record is one report and a decisions file.
3. **The orchestrator found real problems no builder could see.** It flagged a paste error that would have copied from the hidden-key folder and refused to run it; it found that the public packs had never loaded; and it logged its own contract defects instead of blaming builders.
4. **Each structure caught different bugs.** The team's shell builder opened its screens in a browser and found a bug its fake DOM missed. The solo agent put 33 real-browser tests into its test suite. The baseline showed one honesty slip on screen (blaming the rules for an engine failure); the team build did not, though one case is not enough to credit the structure.
5. **The cost is real.** At least 2.4 times the build tokens, about 6 more minutes end to end, and a product owner who reviewed three gates. For a vaguer spec, or a larger app where one agent's context runs out, that trade may pay; this eval did not test those cases.
