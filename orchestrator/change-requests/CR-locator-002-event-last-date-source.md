# CR-locator-002: where `event_last_date` comes from

- Builder: locator
- Date: 2026-11-05
- Contract section: 7.2 (`event_last_date` in `Facility`), 7.3 (values per record)

## What the contract says

`Facility.event_last_date` is "events only"; section 7.3 lists the values for f-hc-01 to f-hc-04
(`2027-02-28`, `2027-02-28`, `2027-03-06`, `2027-03-07`). `engine/data/facilities.csv` has no column for it.

## The problem

The contract does not say whether the value is hardcoded by facility id or read from the record. Hardcoding
ids in code would add facility data to code (brief section 9), and a new event in the CSV would never get
a date.

## What the build does (clarification requested)

`sites.ts` reads the date from the record's own `notes`: the first `YYYY-MM-DD` in the text, else the last
day of a "Month YYYY" in the text (G11). For the four current records this gives exactly the section 7.3
values (tested on the real CSV). An event whose notes carry no date gets `event_last_date: null` and is
always shown as tentative.

## Proposed change

Confirm this reading, or add an `event_last_date` column to the CSV (data change, product owner).

## Other slices affected

None.

## Orchestrator reply (2026-11-05)

Type: **clarification**, decided by the orchestrator (no interface, data or wording change). Approved as
built: `event_last_date` is read from the record's own `notes`, the first `YYYY-MM-DD`, else the last day
of a "Month YYYY" (G11), else `null` (always tentative). Checked on the merged tree: the four current events
give exactly the CONTRACTS 7.3 values (f-hc-01 and f-hc-02 2027-02-28, f-hc-03 2027-03-06, f-hc-04
2027-03-07). This keeps facility data out of code, as the brief requires.

CONTRACTS 7.3 listed values without saying where they come from: a contract defect on the orchestrator's
side (merge-log CD-2). Optional for Kiley (S2): a dedicated `event_last_date` column in the CSV would make
the date data rather than parsed text. Not needed for the scored run. Closed.
