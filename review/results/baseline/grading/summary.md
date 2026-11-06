# Grading: baseline

Build /Users/kileysullivan/refcycle-builds/refcycle-scored/baseline at 962779f; run 2026-11-06T00:28:44.208Z to 2026-11-06T00:44:54.643Z; keys checksums OK.
Models seen in /api/ask responses: anthropic/claude-sonnet-5-5.
Headline numbers use repeat 1. Counts beside every percentage; a gap of one or two cases between builds is not a finding.

## test

### Recyclopedia (30 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Confident-wrong | 6.7% (2 of 30) | 2% or less | misses |
| Accuracy, answerable | 100.0% (26 of 26) | 90% or more | meets |
| Abstention recall | 100.0% (2 of 2) | 80% or more | meets |
| Over-abstention | 0.0% (0 of 26) | 10% or less | meets |
| Citation validity | 100.0% (27 of 27) | 95% or more | meets |
| Conditional handling | 0.0% (0 of 2) | none | |
| Accuracy, all cases | 93.3% (28 of 30) | none | |
| Page did not show the engine's verdict | 0.0% (0 of 30) | none | |
| Page did not show the quoted rule text | 0.0% (0 of 30) | none | |

### Locator (18 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Accuracy | 100.0% (18 of 18) | none | |
| Facilities shown with no source | 0 of 32 shown | 0 | meets |
| Wrong named sites shown | 0.0% (0 of 18) | none | |
| Exact facility set (strict) | 83.3% (10 of 12) | none | |
| Item answer committed and wrong | 0.0% (0 of 18) | none | |

### Camera scan (24 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Wrong item identified, no follow-up | 0.0% (0 of 24) | 2% or less | meets |
| Identification correct | 95.8% (23 of 24) (0 need review) | none | |
| Routed answer: confident-wrong | 4.2% (1 of 24) | 2% or less | misses |
| Routed answer: accuracy, answerable | 90.5% (19 of 21) | 90% or more | meets |
| Routed answer: abstention recall | 100.0% (1 of 1) | 80% or more | meets |
| Routed answer: over-abstention | 4.5% (1 of 22) | 10% or less | meets |
| Routed answer: citation validity | 100.0% (20 of 20) | 95% or more | meets |
| Identification and routed answer both correct | 87.5% (21 of 24) | none | |

Confident-wrong, Recyclopedia and Camera scan together: 5.6% (3 of 54).

#### Cases not correct

| Case | Feature | Reason |
|---|---|---|
| rp13-haw | recyclopedia | got answer deposit_return, key clarify/conditional deposit_return/drop_off_special |
| rp25-haw | recyclopedia | got answer deposit_return, key clarify/conditional deposit_return/drop_off_special |
| ph10 | scan | got answer deposit_return, key clarify/conditional  |
| ph13 | scan | got abstain, key answer recycle_bin |
| ph22 | scan | the scan asked where the key expects an identified item; identification wrong: no identification (multiple); asked instead |

## held_out

### Recyclopedia (10 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Confident-wrong | 0.0% (0 of 10) | 2% or less | meets |
| Accuracy, answerable | 80.0% (8 of 10) | 90% or more | misses |
| Abstention recall | n/a (0 of 0) | 80% or more | n/a |
| Over-abstention | 0.0% (0 of 10) | 10% or less | meets |
| Citation validity | 100.0% (10 of 10) | 95% or more | meets |
| Conditional handling | n/a (0 of 0) | none | |
| Accuracy, all cases | 80.0% (8 of 10) | none | |
| Page did not show the engine's verdict | 0.0% (0 of 10) | none | |
| Page did not show the quoted rule text | 0.0% (0 of 10) | none | |

### Locator (6 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Accuracy | 100.0% (6 of 6) | none | |
| Facilities shown with no source | 0 of 12 shown | 0 | meets |
| Wrong named sites shown | 0.0% (0 of 6) | none | |
| Exact facility set (strict) | 83.3% (5 of 6) | none | |
| Item answer committed and wrong | 0.0% (0 of 6) | none | |

### Camera scan (6 cases, 0 drive failures)

| Metric | Result | Target | |
|---|---|---|---|
| Wrong item identified, no follow-up | 0.0% (0 of 6) | 2% or less | meets |
| Identification correct | 100.0% (6 of 6) (0 need review) | none | |
| Routed answer: confident-wrong | 0.0% (0 of 6) | 2% or less | meets |
| Routed answer: accuracy, answerable | 100.0% (4 of 4) | 90% or more | meets |
| Routed answer: abstention recall | n/a (0 of 0) | 80% or more | n/a |
| Routed answer: over-abstention | 0.0% (0 of 6) | 10% or less | meets |
| Routed answer: citation validity | 100.0% (5 of 5) | 95% or more | meets |
| Identification and routed answer both correct | 100.0% (6 of 6) | none | |

Confident-wrong, Recyclopedia and Camera scan together: 0.0% (0 of 16).

#### Cases not correct

| Case | Feature | Reason |
|---|---|---|
| rp41-aus | recyclopedia | got conditional [recycle_bin/recycle_bin], key answer recycle_bin |
| rp46-aus | recyclopedia | got conditional [recycle_bin/recycle_bin], key answer recycle_bin |

Invented rules are graded blind after both builds run (harness/grade/blind-export.mjs); contract breaks come from the orchestrator's merge log.
