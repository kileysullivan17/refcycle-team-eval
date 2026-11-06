# CR-locator-002: two additive fields on `GET /api/sites`

- Builder: locator
- Date: 2026-11-05
- Contract section: 6 (`RuleWhere` and the response `{ rules, sites }`), Gate 3 #8 (detail screen lists each
  linked rule's `applies_to`), LOC-11 (link the official source)
- Kind: additive; no existing field changes

## What the contract says

`RuleWhere` is `{ rule_id, where, location_limited, source_kind, source_date, source_url }` and the response
is `{ rules, sites }`.

## The problem

1. The detail screen must list each linked rule's `applies_to` items from the pack (LOC-9, Gate 3 #8), and a
   conditional request is grouped by rule (G19) and needs a readable group heading. The browser cannot read
   the packs, and `RuleWhere` has no `applies_to`.
2. LOC-11 must link "the place's official source". `GET /api/jurisdictions` returns only `{ id, name }`, and
   the screen contract (`ctx`) has no official source, so the locator has no way to get the pack's
   `official_contact_url`.

## Proposed change

- Add `applies_to: string[]` to `RuleWhere` (copied from the pack rule).
- Add `official_source: { title: string, url: string }` to the response (`url` is the pack's
  `official_contact_url`; `title` is the fixed text "Official recycling information").

## What I did meanwhile

Built and tested with both fields present. They are additive, so a consumer that ignores them (the item page)
is unaffected. If the change is refused, the detail screen would show no item list and LOC-11 would show no
link, and both would be reported as failing checks.

## Affects

Recyclopedia builder (item page reads `rules`; it can ignore the new fields). No data change.

## Orchestrator reply (2026-11-05)

Type: **change** (additive interface change to CONTRACTS 6), so it needs Kiley's approval under CONTRACTS 12.
Sent to Kiley as decision K5 with the recommendation to approve.

Assessment: both fields are needed to meet requirements the contract already approved (LOC-9 with Gate 3 #8,
LOC-11, G19 group headings), and the contract gave the browser no other way to get them (merge-log CD-2). They
are additive: the item page reads only `rules[].where` and is unaffected. Checked on main: every `Facility`
record has exactly the contract keys; `RuleWhere` adds only `applies_to`; the response adds only
`official_source`.

The branch was merged with the fields in place, since the CR was filed before hand-back (MERGE-PLAN 4: not a
contract break). If Kiley rejects K5, the fields come out in a follow-up and checks 15 and 17 of the brief
fail. If approved, CONTRACTS.md goes to v1.2 with both fields.

## Outcome (2026-11-05)

Approved by Kiley as merged (K5, `orchestrator/MERGE-DECISIONS.md`). Recorded in CONTRACTS.md v1.2, section 6:
`applies_to` on `RuleWhere`, and `official_source: { title: "Official recycling information", url: <pack
official_contact_url> }` on the response. No code change needed. Closed.
