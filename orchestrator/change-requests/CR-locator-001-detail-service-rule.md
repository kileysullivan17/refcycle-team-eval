# CR-locator-001: detail screen lists "curbside pickup" under the transfer stations record

- Builder: locator
- Date: 2026-11-05
- Contract section: 6 (rule-to-site links), 7.1 (`rule_ids` is the only link), brief section 8 check 18 (LOC-9)

## What the contract says

The detail screen lists, for each rule linked to the site by the CSV `rule_ids` column, that rule's
`applies_to` items from the pack (LOC-9: "only items whose pack rules send them to that site").

## The problem

`p-hc-01` ("County Recycling and Transfer Stations with drop-off recycling") links to `hc-system-000`,
`hc-paper-001` and `hc-glass-004`. `hc-system-000` is a service rule (`stream: null`, `where: null`,
`applies_to`: "curbside pickup", "curbside recycling", "recycling pickup", "rubbish pickup"). Built to the
contract, the detail screen for `p-hc-01` therefore lists "curbside pickup" and "rubbish pickup" as items
the transfer stations take. Evidence: dev harness screenshot of `/locations/p-hc-01`, first bullet list
under "Items the rules send here". The pack says the opposite (Hawaiʻi County has no curbside pickup).
The link is useful for the list view (an item asking about curbside shows the transfer stations), so the
fix is not obvious.

## Proposed change

One of:

1. Clarification: on the detail screen, skip a linked rule that has `stream: null`, no `conditions` and
   `where: null` (a service statement, not an acceptance rule). This needs `stream` and `conditions` on
   `RuleWhere`, which is an interface change, so it would be a **change**.
2. Data: the product owner removes `hc-system-000` from the `rule_ids` of `p-hc-01` (a CSV change). The
   list view then no longer offers the transfer stations for a "curbside" question.
3. Leave as is: the screen follows the contract literally.

Until decided, the build follows option 3.

## Other slices affected

Recyclopedia: only if option 1 adds fields to `RuleWhere` (it reads `rules[].where` only).

## Orchestrator reply (2026-11-05)

Type: **change**. Options 1 and 2 both need Kiley: option 1 adds fields to `RuleWhere` (an interface
change under CONTRACTS 12) and option 2 edits `engine/data/facilities.csv`. Sent to Kiley as decision S1.
Not applied; the build stays on option 3 (the contract read literally) until he decides.

Confirmed the problem: the detail screen for p-hc-01 lists "curbside pickup", "curbside recycling",
"recycling pickup" and "rubbish pickup" as items the transfer stations take, while the rule's own quote
says the county has no curbside pickup. One correction to the evidence: hc-system-000 has
`where: "County Recycling and Transfer Stations"`, not `where: null`, so the test proposed in option 1
(`stream: null`, no `conditions`, `where: null`) would not match this rule; it would have to test
`stream: null` and no `conditions` only.

This is a contract defect on the orchestrator's side (merge-log CD-1): the orchestrator proposed the
hc-system-000 link for p-hc-01 when it drafted the facility links, without checking what LOC-9 would then
show.

Recommendation to Kiley: option 2, remove `hc-system-000` from `rule_ids` of p-hc-01. hc-system-000 is a
statement about a service, not a rule that sends an item to a site. The item page still shows its `where`
text ("County Recycling and Transfer Stations") for a curbside question, so the resident is still told
where to go. No interface or code change; the locator's real-CSV invariants still hold.
