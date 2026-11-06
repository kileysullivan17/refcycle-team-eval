# RefCycle agent team eval: specification

> RefCycle began as a student concept by a five-person team in the Berkeley UX/UI Boot Camp, UC Berkeley Extension, January 2024. This rebuild and evaluation are solo work.

## TL;DR

The first RefCycle eval built one slice of the app, "where does this item go in my city?", and scored it for safety. This eval builds the next three features on top of that slice, twice, from the same approved PRD and contracts:

- **Solo baseline:** one agent builds all three features in one session.
- **Agent team:** an orchestrator agent writes the PRD, the shared contracts and one brief per builder; three builder agents work in parallel; the orchestrator merges their work.

Both builds are scored the same way, against answer keys frozen before any scored build finished. The question is whether the team structure buys anything the solo agent does not, and whether either build stays as safe as the engine it calls.

## 1. The questions

1. Does a coordinated agent team score better than one agent building the same scope from the same inputs?
2. Do the new features keep the first eval's safety property: no confident wrong answers and no invented rules?
3. What does the team cost, in tokens, time and the product owner's attention, and what does it give in return?

## 2. What is being evaluated

Three features from the 2024 RefCycle designs, chosen because the original team ranked them highest in its dot vote:

| Feature | What it does |
|---|---|
| Recyclopedia | A materials catalog (50 entries in 10 categories), search, and an item page that shows the engine's answer |
| Camera scan | Identifies an item from a photo, confirms it with the user, then asks the engine where it goes |
| Recycling center locator | Lists and maps the places that take an item, using only sites the rules packs cite |

Out of scope: upcycling ideas, the place-wide guidelines screens, accounts, device location, deployment.

The one hard rule across all three: no feature writes its own recycling rules. Every answer comes from the guidance engine built in the first eval (Build B, pinned at its last commit), which reads the same three rules packs.

## 3. Places and rules packs

Seattle, Austin and Hawaiʻi County, as in the first eval. The builds use the public copies of the packs, which withhold private business names. Running them surfaced a finding before any build started: three withheld source URLs in the Austin pack failed the engine's own schema, so the published public packs had never actually run. They were set to null with Kiley's approval (decision K1); no rule changed. Private businesses are shown by their public description ("a private recycler in the Shipman Industrial Park"), never by name.

## 4. Inputs, gates and roles

The specs are the 2024 team's case study deck and Figma file. Kiley owned every decision at four gates:

| Gate | Produced by | Kiley's role |
|---|---|---|
| 1. PRD | Orchestrator, from the deck and Figma | Answered 25 open questions; changed no requirement |
| 2. Contracts | Orchestrator | Answered 21 open questions |
| 3. Builder briefs | Orchestrator | Answered 9 open questions |
| Merge decisions | Orchestrator recommended | Decided K1 to K5 (practice) and S1 (scored) |

Models: orchestrator and reviewer on Claude Opus 5.5; builders and the solo baseline on Claude Sonnet 5.5; the engine and the image model at runtime on Claude Sonnet 5.5, matching the first eval's held-out final. All agents ran as Claude Code sub-agents. The orchestrator wrote each builder's launch prompt word for word; the session assistant launched them, because agents it starts cannot start agents of their own.

## 5. The answer keys

Three keys, one per feature, written before any build:

| Key | Practice | Test | Held-out | What a case is |
|---|---|---|---|---|
| Recyclopedia | 10 | 30 | 10 | A search phrase in a place, scored on the engine answer the item page shows |
| Locator | 6 | 18 | 6 | An item in a place, scored on the sites listed, or on curbside, none listed, abstain or conditional |
| Camera scan | 6 | 24 | 6 | A photo in a place, scored on the identification and the routed answer |

Every expected answer cites its rule id. Rows were drafted by Claude from the rules packs; every row marked CHECK and every naming rule was decided by Kiley. Kiley did not review each of the 116 rows himself, as he did for the first eval's key.

The 36 photos were generated in Higgsfield, with no brand names or logos, and each was checked by hand for its item and any text. One was regenerated. Two expected answers changed after viewing the photos, because a photo cannot show whether a canister is empty or a bottle carries the HI-5 deposit. Scan scores describe these generated photos, not real phone photos.

The keys and photos were frozen and fingerprinted (SHA-256) on 2026-11-05, before any scored build finished.

## 6. Scoring

A reviewer agent built a harness that drives each build the way a person would: headless Chrome, pick the place, type the phrase or upload the photo, follow the app's own path, and read the screen and the network. The same harness runs both builds unchanged. It was proven on practice cases with fake model answers, including a deliberately broken run in which it caught all seven planted faults.

Measures follow the first eval (confident-wrong, accuracy on answerable cases, abstention recall, over-abstention, citation validity, invented rules), plus three new ones: facilities shown with no source, a scan naming the wrong item with no follow-up question, and contract breaks (from the orchestrator's merge log). Correctness is scored on the engine answer the page received; a page that shows something different is reported as a display failure.

Invented rules are graded blind: 184 explanations from both builds, build names removed, rows shuffled, graded 2 (faithful), 1 (loose) or 0 (invented) by a separate agent that saw only that sheet.

## 7. Ship bar (locked 2026-11-05, before any build existed)

| Measure | Target |
|---|---|
| Confident-wrong rate | 2% or less |
| Accuracy, answerable cases | 90% or more |
| Abstention recall | 80% or more |
| Over-abstention | 10% or less |
| Citation validity | 95% or more |
| Invented rules | 0 |
| Locator: facilities shown with no source | 0 |
| Scan: wrong item identified, with no follow-up question | 2% or less |
| Team build: contract breaks | 0 |

## 8. Run protocol

1. **Unscored practice run** of the team, to find harness and contract problems before anything counted.
2. **Scored base:** a branch with every line of practice code removed. Both scored runs start from it, with contracts v1.3.
3. **Scored builds:** the solo baseline and the three team builders ran at the same time, each in its own copy.
4. **Scored run:** one pass per build on Kiley's Mac, baseline first, through his own Terminal.
5. **Blind grading**, then unblinding.

## 9. Controls between the two builds

- Same PRD, contracts v1.3, engine, packs, facility list, model, keys and harness.
- The team's scored briefs carried a section of general rules learned in the practice run (how to write tests that do not depend on changing data, spacing and contrast rules). The same section was sent to the solo baseline, word for word, mid-build, and logged.
- One data fix (S1) was applied identically to both builds before scoring.
- No messages were sent to any builder after launch, apart from that one addendum.

## 10. What this does not measure

- Whether a team helps on a vaguer spec. Here the PRD and contracts were approved first and given to both builds, so the comparison tests the build structure, not the planning.
- Real phone photos, real cameras or a deployed app.
- Stability across repeats: each scored case ran once.

## 11. Threats to validity

- **One pass per build.** A one- or two-case gap is not a finding.
- **Contracts v1.3 already holds the practice run's fixes**, so the scored team did not meet the problems the practice run found.
- **The keys were drafted by Claude**, with Kiley's decisions on every CHECK row.
- **Generated photos** are cleaner than real ones.
- **The search path differs between builds:** where typed text partly matches the catalog, the baseline offers "ask about this text" and the team lists entries. In the scored cases only one phrase was affected, and both builds opened the same entry.
- **Blinding is partial:** the screen text shows each build's layout wording.
- **The same company's models** built, ran and graded both builds.

## 12. Write-up

RESULTS.md has the numbers. BUILD-COMPARISON.md compares the two structures on cost and process.

## Appendix: changes made during the eval

| Date | Change | Why |
|---|---|---|
| 2026-11-05 | Public Austin pack: three withheld URLs set to null (K1) | They failed the engine's schema; no rule changed |
| 2026-11-05 | Confirm wording "We think this is: ___. Is that right?" (K2) | "Is this a aluminum can?" |
| 2026-11-05 | Red-card text bold, 19px or larger | Ink on Pelati Red is 4.40:1, under 4.5:1 for normal text |
| 2026-11-05 | Facility p-hc-01 unlinked from hc-system-000 (S1), both builds | The transfer stations were listed as taking "curbside pickup" |
| 2026-11-05 | Two camera expected answers changed to a follow-up question | A photo cannot show an empty canister or the HI-5 deposit |
| 2026-11-05, after results | ph22 key change: asking which item is correct for the two-item food photo | The photo shows two items, like ph24; frozen key kept beside the amended one |
| 2026-11-05, after results | Hawaiʻi County pack: "before the final run" removed from source records | Internal wording that reached residents in explanations; scored runs used the old wording |
| 2026-11-05, after results | Note added to RESULTS.md on the three HI-5 cases; key and headline unchanged | Kiley's field experience: in about two dozen redemptions, no one inspected a can for the HI-5 marking. The practical-reading score is reported beside the headline, labeled as decided after results |
