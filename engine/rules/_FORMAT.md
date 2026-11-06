# Rules pack format

Every file in this folder is one jurisdiction. The app loads them at startup. Read-only.

## Top level

- `jurisdiction`: `id`, `name`, `system_summary`, `official_contact_url`
- `sources`: each has `id`, `kind`, `title`, `url`, `publisher`, `page_date` (as shown on the page, or
  null), `retrieved` (the date it was read). `kind` is one of:
  - `official_page`: a published page from the jurisdiction or its contractor
  - `field_observation`: what happened in person at a site, recorded by the pack author with the date
    and what was seen. Used where the published rules and what a site actually does disagree.
  - `field_report`: what site staff or a business told the pack author, not yet confirmed in person
  - `business_page`: a private business's own published page (for example a scrap yard that buys
    cans). Not a jurisdiction rule; used only as an `also_acceptable` path, never as a rule's main
    `source`. Business names stay in the private packs; the public copy says "a local scrap metal yard"
  - `superseded`: a published page that is still online but out of date or contradicted. Kept so the
    conflict is visible, never used as the source of a rule
- `rules`: the list below

## Each rule

| Field | Meaning |
|---|---|
| `id` | Unique within the pack |
| `applies_to` | The items the rule covers, in the source's own terms |
| `stream` | `recycle_bin`, `compost_bin`, `garbage`, `drop_off_special`, `deposit_return`, or null when `conditions` decide it |
| `conditions` | Optional list of `{ if, stream }` |
| `also_acceptable` | Optional list of other streams the source also allows |
| `also_acceptable_source` | Optional. The source id behind `also_acceptable`, when it is not the rule's own `source` |
| `also_acceptable_quote` | The line from `also_acceptable_source` that the extra stream rests on |
| `prep` | Preparation steps the source states |
| `where` | Where to take it, if the source says |
| `source` | A source id |
| `quote` | The line from the source the rule rests on |
| `destination_source` | Optional. A second source id, used when the rule's own `source` says an item is not accepted and a different source says where it goes |
| `destination_quote` | The line from `destination_source` that the stream rests on |
| `destination_inferred` | `true` when the source says only where an item is NOT accepted and the stream is the pack author's inference. Treat as a weaker rule |
| `verified_by_ks` | `true` once the quote has been checked by hand against the live page |
| `location_limited` | `true` when only one named site accepts the item. The answer must name the site |

## What the streams mean

- `recycle_bin`: the jurisdiction's standard recycling, whether a curbside cart or a county drop-off bin
- `compost_bin`: the jurisdiction's organics stream, whether a curbside cart or a greenwaste drop-off site
- `garbage`: regular trash or rubbish
- `drop_off_special`: anything handled outside the regular streams: hazardous waste, batteries,
  store drop-off for film plastic, a scheduled special collection
- `deposit_return`: a container with a refundable deposit, returned to a redemption center

## When rules overlap

The more specific rule wins. A general rule may point to a specific one in its `conditions`.

## When sources disagree

A field observation outranks a published page, because it records what a resident will actually meet.
The pack keeps the published page as a `superseded` source so the disagreement stays visible, and an
answer resting on a field observation says so, with its date.

## What a pack does not contain

If an item is not in the pack, the pack is silent on it. That is deliberate. Silence means abstain.
