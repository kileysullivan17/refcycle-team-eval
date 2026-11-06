Pinned from Build B (Codex), local repo refcycle-b at commit 486bf17 (M5), copied 2026-11-05.
Excluded: .env, node_modules, logs, artifacts, and its rules packs (which name private businesses).
rules/ points at engine/rules, the public packs from kileysullivan17/refcycle-eval.

## Changes in this published copy (2026-11-05)

None of these touch rules, prompts or runtime logic. The scored runs used the code at 486bf17 as copied above.

- test/behavior.test.ts (R12 and R13 test) and src/behavior-eval.ts (field-pet and field-hdpe cases): private business names and a street name replaced with the public descriptions the public packs use ("A private recycler in Hilo", "A private recycler in the Shipman Industrial Park").
- eval/dev.csv: one row's field observation note, the same replacement.
- DECISIONS.md headings and the page title in public/index.html: em dashes replaced with colons.

Known: against the public packs, the R12 and R13 test fails one assertion, because the 2026-11-03 phone rechecks made the two Hawaiʻi County sources field reports ("Field report"), while the test still expects "Field observation". This is unchanged from Build B and is left as is.
