# RefCycle rebuild: PRD for three features (v2)

Status: Approved by Kiley Sullivan, 2026-11-05 (gate 1)

v2 folds in the product owner's answers to the 25 open questions of v1 (`PRD-DECISIONS.md`). The v1 draft
is kept as `PRD-v1-draft.md`.

RefCycle began as a student concept by a five-person team in the Berkeley UX/UI Boot Camp, UC Berkeley
Extension, January 2024. This rebuild is solo work by Kiley.

Source keys used below:

- **FC1 to FC7**: the product owner's fixed constraints in `ORCHESTRATOR-BRIEF.md`.
- **Q1 to Q25**: the product owner's answers in `PRD-DECISIONS.md`.
- **D#**: slide number in the team case study deck (45 slides, counted from the title slide as 1).
- **F: name (id)**: a frame on the Figma page "Hi-Fi Wireframes (Second Iteration)".
- **EB§n**: section n of `engine/first-eval-build-brief.md` (EB§4.n is behavior requirement n).
- **FMT**: `engine/rules/_FORMAT.md`. **Pack**: a rules pack in `engine/rules/`, cited by rule id.

---

## 1. Problem and user

People who want to recycle well cannot easily find out what to do with an item, especially items that are
hard to recycle, and the rules differ by place (D15). In the team's survey, 58% said they have trouble
telling whether an item is recyclable and 15.9% were unsure (D5); 68.1% said they would be very likely to
recycle more with clearer guidance (D6). The research persona, Wesley Green, is a 32-year-old teacher in
Austin, TX who wants clear sorting directions and easy access to recycling centers, and is irritated when
local centers will not take all recyclable items (D12). The empathy map captures the core question in his
words: "How do I recycle bread bag clips?" (D11).

## 2. Goals and non-goals

**Goals**

- G1. Tell a resident what to do with a material or item in their selected place, with the local rule and
  its source (D15, D19, D22 "Localized guidelines"; FC1, FC4).
- G2. Let a resident identify an item from a photo and get the same place-specific answer (D19 "Item
  identification", D38 task 2; FC1).
- G3. Show where to take an item that does not go in a regular stream, as a map and a list (D19 "Recycling
  center locator", D12 needs, D22 "Suggests nearby facilities"; FC1).
- G4. Never give a confident wrong answer: ask or say "we don't know" when the app cannot tell (FC5).

**Non-goals** (FC2, plus elements of the Figma frames that fall outside FC1)

- Upcycling ideas and instructions (frames Upcycle Ideas, UPCYCLE CRAFTS, Upcycling Plastic #2,
  Instructions, Instructions-2, Instructions-3, Step 1 to Step 5). The Upcycle button on item pages is
  hidden (Q21).
- Social sharing (Share Overlay, New Message, Share buttons).
- Onboarding, splash and coaching screens (Splash 0 to 4, Onboarding, Skip pop up dark).
- Accounts and sign-in (Splash 4 "Create account / Sign in").
- Any place other than Seattle, WA; Austin, TX; Hawaiʻi County, HI.
- Deployment.
- Writing, editing or inferring recycling rules in any feature (FC4). The rules packs are read-only (FC3).
- Home, Handbook, News and Tip of the Day content (HOME, Handbook frames): not one of the three features.
- Place-wide local guidelines screens: Austin, Texas Guidelines, Collection Days & Guidelines, Local
  Guidelines, Acceptable block, Frame 39311 (Q20).
- History and Recently Viewed rows (Q23).
- Barcode lookup (Q7).
- Device location, distances and distance sorting (Q14).

## 3. Shared requirements (all three features)

- **X-1.** The resident selects one place from exactly three: Seattle, WA; Austin, TX; Hawaiʻi County, HI.
  The list comes from `GET /api/jurisdictions`. No other place is offered. A place picker appears on
  first use and in the header; the choice is remembered on the device. There is no default place and no
  device location is used to choose it. (FC2, FC3, EB§5, Q1)
- **X-2.** Wherever the app shows the Hawaiʻi place name, it displays "Hawaiʻi County", although the pack
  and the jurisdictions endpoint name it "County of Hawaiʻi, HI". The swap replaces only "County of
  Hawaiʻi" or "County of Hawaii" with "Hawaiʻi County", happens at display time, and is logged. Every
  other word stays as the engine returned it. (FC3, Q24)
- **X-3.** Every recycling answer (stream, prep, explanation, rule ids, sources) comes from
  `POST /api/ask` with the selected place's `jurisdiction` id. No feature stores, writes, infers or
  hardcodes a stream, prep step or rule. (FC4)
- **X-4.** Each feature renders all four engine behaviors: `answer` (stream, prep, explanation, source
  link); `clarify` (the engine's one question, an input for the reply, then a new request); `conditional`
  (each `if` case with its stream); `abstain` (a clear "we don't know" state with the official source
  link). (EB§2, EB§4.2, EB§4.3, EB§5)
- **X-5.** The explanation is shown as the engine returns it, without additions or edits other than the
  place-name swap in X-2, so that a named site (location-limited rules) and the source date of a field
  observation or field report reach the resident. (EB§4.11, EB§4.12, EB§4.13, Q24)
- **X-6.** When the behavior is `abstain` or `clarify`, no feature shows a verdict, card color or stream
  for the item. A feature never turns an abstention into a guess. (FC5, EB§4.5)
- **X-7.** If the engine returns HTTP 400 or cannot be reached, the feature says it has no answer and does
  not fall back to any other content. (FC5)
- **X-8.** No screen names a private business that a pack withholds by name; it shows the pack's public
  description (for example "a private recycler in the Shipman Industrial Park"). (FC6, FMT
  `business_page`)
- **X-9.** The selected place is shared by all three features; changing it re-requests any answer on
  screen. (FC1 "the selected place", FC3)
- **X-10.** Verdict cards keep the Figma colors and map to streams as follows: blue flag for
  `recycle_bin`, `compost_bin` and `deposit_return`; yellow card for `garbage`; red card for
  `drop_off_special`. `clarify`, `conditional` and `abstain` show a neutral "referee check" state with no
  card. Card copy names the stream; the words "Score!" and "Hazardous" are not used. (Q2; F: Frame 39307)
- **X-11.** The item page title is the engine's `item_interpreted`. No brand or model names are shown.
  (Q10)
- **X-12.** The app is a web app laid out for phone width, built on the same TypeScript stack as the
  engine. (Q22)
- **X-13.** No feature treats a rule differently because of its `verified_by_ks` or
  `destination_inferred` value. (Q25)

## 4. Feature: Recyclopedia

**What it does.** A browsable and searchable database of materials and items. Opening a material or item
shows the engine's answer for the selected place. (FC1; D19 "A comprehensive database with information
about the different types of recyclable material")

**User flow.** Recyclopedia landing, then a material category (for example Plastic), then an entry (for
example a plastic bottles entry), then the item page with the local answer. Or: search box, type, pick a
result (or submit text that matches nothing), item page. (F: Recyclopedia, Plastic, Recyclopedia Search
Active, Item page - Plastic #2; D30 and D38 task 3 "Find the information page for the Plastic #2
material")

**Screens.** Recyclopedia (820:3856); Plastic (820:4364); Metal (820:4336); Recyclopedia Search Active
(820:3241); Search Item Overlay (869:10486); Item page - Plastic #2 (820:3402); Item page - Plastic #4
(820:4441, LDPE); Item page - Plastic #4 (820:4456, the frame actually shows Electronic Waste); Hazardous
Waste (820:3511); Item page Example (820:3432, 820:3460, 820:3487); verdict card legend Frame 39307
(820:3734).

**Requirements**

- **RC-1.** The landing screen shows material categories as cards, in the Figma card layout. The
  categories and entries are those of the approved catalog: one entry per material group that the rules
  packs cover in at least one place. The catalog is drafted in `CONTRACTS.md` and approved by Kiley at
  gate 2. (F: Recyclopedia; Q4)
- **RC-2.** Selecting a category opens a material page listing that category's catalog entries. (F:
  Plastic, Metal; Q4)
- **RC-3.** A search box on the landing and material pages filters entries as the resident types; typing
  "Plastic" lists the plastic entries. (F: Recyclopedia, Recyclopedia Search Active)
- **RC-4.** Selecting an entry opens its item page. A material entry sends the material name to the
  engine as the `query`, and the item page shows the engine's response for the selected place, per X-4
  and X-5. In a place with no coverage for the entry, the page shows "we don't know". (FC1, FC4; F: Item
  page - Plastic #2; D38 task 3; Q4, Q6)
- **RC-5.** The item page's verdict card is driven only by the engine's `behavior` and `stream` for the
  selected place, never by a fixed label per material. (FC4; F: Frame 39307, Item page - Plastic #2)
- **RC-6.** The item page shows no recycling guidance other than the engine's output. Static text in the
  Figma frames that states a disposal rule (for example "they must be recycled at specialized facilities"
  on Item page - Plastic #2) is not carried over as written. (FC4)
- **RC-7.** When an entry's answer is `conditional` (for example a resin number whose stream depends on
  form or deposit status), the item page lists every case with its stream, and does not pick one.
  Conditional answers to material entries are expected. (EB§4.3, FC5, Q6)
- **RC-8.** The item page shows no "How long to decompose" or "Percentage recycled annually" figures.
  (Q3)
- **RC-9.** Search text that matches no catalog entry is sent to the engine as a free question, and the
  result opens on the item page. (Q5)

**Edge cases**

- *Unclear input*: search text that matches no entry goes to the engine (RC-9); the engine may answer,
  clarify or abstain.
- *Uncovered items*: an entry the selected place's pack does not cover returns `abstain`; the item page
  shows "we don't know" and the official source link (EB§4.2, Q4). The same entry may be answered in one
  place and abstained in another.
- *Location-limited sites*: when the engine's answer names a single site, the item page shows the
  explanation unedited (X-5) and the Dispose button opens the locator (CON-2).
- *Deposit status*: in Hawaiʻi County a beverage container may be HI-5 or not (Pack hc-plastic-006,
  hc-metal-007, hc-deposit-005); the item page shows the engine's `clarify` or `conditional` response and
  never assumes.
- *Abstaining*: no card on abstain; the neutral "referee check" state shows (X-6, X-10).

## 5. Feature: Camera scan

**What it does.** The resident photographs an item (or picks a photo), the app identifies the item, then
gets the engine's answer for the selected place. (FC1; D19 "Using a smartphone camera, items and barcodes
can be scanned to determine if items are recyclable"; D38 task 2 "Use the camera or camera roll to get
info about a microwave oven, and how to dispose of it"; barcodes excluded by Q7)

**User flow.** Camera button in the tab bar, then Camera Scan (viewfinder), then Identify (or Photos to
pick an existing image), then "Is this a ___?" with an edit option, then the item page with the local
answer. (F: Camera Scan, Item page - Electronic Appliance; tab bar camera button on Recyclopedia,
Location Map, Location List; Q8)

**Screens.** Camera Scan (820:3040); Group 39311 (820:3044, camera flip icon); Item page - Electronic
Appliance (820:3417). The "Is this a ___?" confirmation has no Figma frame (Q8).

**Requirements**

- **CS-1.** The Camera Scan screen shows a live viewfinder with an "Identify" capture button, a "Photos"
  option to choose an existing image, "Snap Tips", a close control, a flash control and a camera flip
  control. (F: Camera Scan, Group 39311; D38 task 2 "camera or camera roll")
- **CS-2.** After capture, the app identifies the item with an image model through the engine's existing
  model provider, turns the photo into an item description, and sends the confirmed description as the
  `query` to `POST /api/ask` with the selected place. There is no barcode lookup. (FC1, FC4, Q7)
- **CS-3.** The result opens the same item page used by Recyclopedia, with the engine's response per X-4
  and X-5. (F: Item page - Electronic Appliance; D38 task 2)
- **CS-4.** Identification never produces a stream, verdict or disposal instruction itself; those come
  only from the engine. (FC4)
- **CS-5.** When the photo is unclear or the item cannot be identified, the app asks the resident to
  retake the photo or name the item, and does not call the engine with a guess. (FC5, Q8)
- **CS-6.** When the answer depends on something a photo cannot show (deposit status, resin number, clean
  or food-soiled), the app does not assume it; it passes on the engine's clarifying question or
  conditional cases. (FC5, EB§4.3)
- **CS-7.** When the photo shows more than one item, the app asks which one the resident means and does
  not merge them. (EB§4.9, FC5, Q8)
- **CS-8.** After identification, the app always shows "Is this a ___?" with the identified item and an
  option to edit it, before the engine is asked. (Q8)
- **CS-9.** If camera access is denied, the app offers photo upload instead. (Q9)
- **CS-10.** Photos go to the model provider for identification only and are not stored. (Q9)

**Edge cases**

- *Unclear input*: blur, darkness, a partial item: CS-5.
- *Uncovered items*: an identified item the pack does not cover gets the engine's `abstain`. For example,
  the deck's test item (a microwave) has an electronics rule in the Seattle and Austin packs
  (sea-special-018, atx-special-018) but no matching rule in the Hawaiʻi County pack.
- *Location-limited sites*: as Recyclopedia; Dispose opens the locator (CON-2).
- *Deposit status*: a photo cannot show HI-5 status; CS-6.
- *Abstaining*: X-6, X-10.
- *Permission denied*: CS-9.

## 6. Feature: Recycling center locator

**What it does.** Shows where to take an item in the selected place, as a map and as a list, using only
sites the selected place's pack names. (FC1, FC6; D19 "Proximity-based facility locator for users to
process or drop off hard-to-recycle materials"; D12 need "Ease of access to recycling centers"; no device
location per Q14)

**User flow.** From an item page, tap Dispose to open the locator for that item; or open Locations from
the tab bar to see every site for the place. Switch between Map and List. Filter by material accepted.
Select a site to see its detail. (F: Location Map, Location List, Capital Area Corporation 820:4204; D30
lo-fi task 2 "Use the camera or upload feature to locate a facility for processing rubber tires"; Q12,
Q19, Q21)

**Screens.** Location Map (820:3068); Location List (820:3114); facility detail frame named "Capital Area
Corporation" (820:4204, and 820:4322).

**Requirements**

- **LOC-1.** The locator has a map view and a list view of the same sites, switched with the Map and List
  buttons. (FC1; F: Location Map, Location List)
- **LOC-2.** Every site shown comes from the selected place's pack (a rule's `where`, or a source the pack
  cites). No other directory, search provider or design mock data is used. (FC6)
- **LOC-3.** Private businesses appear only by the pack's public description, never by business name.
  This includes the business named in the `where` field of hc-oil-015. (FC6, X-8, Q15)
- **LOC-4.** When opened for an item, the locator shows only the sites named by the rules the engine cited
  for that item (`rule_ids` in the response). It reads `where` and `location_limited` from the pack by
  those `rule_ids`, read-only; the engine is unchanged. (FC4, FC6; EB§5; Q11)
- **LOC-5.** When a cited rule is `location_limited: true`, the locator shows that single site and states
  that it is the only place that takes the item. (EB§4.13, FMT)
- **LOC-6.** Each site shows the conditions the pack states for it, as written in the pack: appointment
  needed, fees, limits, "call first", accepted forms (for example Austin's Recycle and Reuse Center "by
  appointment"; Seattle tires "$16 per load, limit 4 tires per load"; Hawaiʻi County #2 plastics "bottles
  and jugs only: no caps or tubs"). (Pack atx-foam-009, sea-special-024, hc-plastic-012; FMT `where`,
  `prep`)
- **LOC-7.** Site information that rests on a `field_observation` or `field_report` source says so and
  gives its date. (EB§4.12, FMT)
- **LOC-8.** No site information comes from a `superseded` source. (EB§4.12, FMT)
- **LOC-9.** A site's detail screen lists only items whose pack rules send them to that site. (F: Capital
  Area Corporation 820:4204 "accepts the following"; FC4, FC6)
- **LOC-10.** The locator shows only the site fields the pack provides. Ratings, review counts, hours,
  phone numbers and distances that appear in the Figma frames are not shown unless the pack gives them.
  (FC6; brief rule "no invented facts")
- **LOC-11.** When the item's answer is `abstain`, or the cited rule names no site, the locator says the
  pack does not name a place for this item and links the official source. (FC5, EB§4.2)
- **LOC-12.** Opened with no item chosen, the locator lists every site for the selected place. (Q12)
- **LOC-13.** Addresses and map pins come only from pack text and the official pages the packs cite. No
  geocoder is used. A site without a sourced address is listed but gets no map pin. (Q13)
- **LOC-14.** The locator uses no device location. Sites are sorted by name and no distances are shown.
  (Q14)
- **LOC-15.** Destinations without a single address (curbside, scheduled pickup, retail stores, library
  branches) show as "how to" entries with the instruction and its source, with no address and no pin.
  (Q16)
- **LOC-16.** A set of sites the pack does not list one by one (for example scrap metal bins at select
  transfer stations, the 14 HI-5 redemption centers) shows as one category entry with the pack's wording
  and a source link. (Q17)
- **LOC-17.** A dated event shows labeled "tentative", with its source and the date checked. After the
  event's last date it shows "check the source for the next event". (Q18)
- **LOC-18.** The Filter control on the map and list filters sites by material accepted. (F: Location
  Map, Location List; Q19)

**Edge cases**

- *Unclear input*: opened for an item still waiting on a `clarify` reply: the locator waits for the answer
  rather than showing sites for a guessed case (FC5).
- *Uncovered items*: LOC-11.
- *Location-limited sites*: LOC-5, for example Hawaiʻi County clear #1 bottles (hc-plastic-011) and #2
  bottles and jugs (hc-plastic-012).
- *Deposit status*: HI-5 containers go to redemption centers, not the glass bin (hc-deposit-005); the
  locator shows redemption centers only once the answer is `deposit_return`.
- *No curbside*: Hawaiʻi County has no curbside pickup; residents use transfer stations (hc-system-000).
- *Scheduled, not fixed, sites*: Hawaiʻi County household hazardous waste goes to tentative collection
  events with dates (hc-hhw-010); LOC-17.
- *No sourced address*: LOC-13.
- *Abstaining*: LOC-11.

## 7. How the features connect

- **CON-1.** Recyclopedia and Camera scan open the same item page, which shows the engine's response.
  (F: Item page - Plastic #2, Item page - Electronic Appliance; D38 tasks 2 and 3)
- **CON-2.** From an item page whose answer sends the item to a site outside the regular streams, the
  Dispose button opens the locator for that item (LOC-4). (FC1 "find where to take an item"; D30 lo-fi
  task 2; D22 "Suggests nearby facilities that can process hard-to-recycle items"; Q21)
- **CON-3.** One selected place drives all three features (X-9).
- **Engine.** All three features call one engine, `POST /api/ask` (EB§5), for every recycling answer. The
  engine answers only from the selected place's pack (EB§4.1). The locator also reads site details named
  by the pack (FC6, Q11). Camera scan uses the engine's model provider for identification (Q7). No feature
  has its own rules.

```
 Recyclopedia --entry--> \
                          item page --POST /api/ask--> engine --> rules pack (selected place)
 Camera scan --photo-->  /     |
   (identify via the           +--Dispose, rule_ids--> Locator (map, list)
    engine's provider)              reads where, location_limited --> sites named in that pack
```

Acceptance scenarios from the team's usability tests (D38): find the information page for Plastic #2
(task 3, 100% in hi-fi); use the camera or camera roll to get information about a microwave and how to
dispose of it (task 2, 90% in hi-fi, attributed to a browser display bug on D39). In the rebuild, both run
against a selected place and must end in an engine answer, clarification or abstention.

## 8. Where this came from

| Requirement | Source |
|---|---|
| X-1 | FC2, FC3; EB§5 `GET /api/jurisdictions`; Q1 |
| X-2 | FC3; Q24 |
| X-3 | FC4 |
| X-4 | EB§2 (result card), EB§4.2, EB§4.3, EB§5 enums |
| X-5 | EB§4.11, EB§4.12, EB§4.13; Q24 |
| X-6 | FC5; EB§4.5 |
| X-7 | FC5; EB§5 (HTTP 400) |
| X-8 | FC6; FMT `business_page` |
| X-9 | FC1, FC3 |
| X-10 | Q2; F: Frame 39307 (820:3734) |
| X-11 | Q10 |
| X-12 | Q22 |
| X-13 | Q25 |
| RC-1 | F: Recyclopedia (820:3856); Q4 |
| RC-2 | F: Plastic (820:4364), Metal (820:4336); Q4 |
| RC-3 | F: Recyclopedia (820:3856), Recyclopedia Search Active (820:3241) |
| RC-4 | FC1, FC4; F: Item page - Plastic #2 (820:3402); D30 task 3, D38 task 3; Q4, Q6 |
| RC-5 | FC4; F: Frame 39307 (820:3734), Item page - Plastic #2 (820:3402) |
| RC-6 | FC4; F: Item page - Plastic #2 (820:3402) |
| RC-7 | EB§4.3; FC5; Q6 |
| RC-8 | Q3 |
| RC-9 | Q5 |
| CS-1 | F: Camera Scan (820:3040), Group 39311 (820:3044); D38 task 2 |
| CS-2 | FC1, FC4; D19 "Item identification"; Q7 |
| CS-3 | F: Item page - Electronic Appliance (820:3417); D38 task 2 |
| CS-4 | FC4 |
| CS-5 | FC5; Q8 |
| CS-6 | FC5; EB§4.3 |
| CS-7 | EB§4.9; FC5; Q8 |
| CS-8 | Q8 |
| CS-9 | Q9 |
| CS-10 | Q9 |
| LOC-1 | FC1; F: Location Map (820:3068), Location List (820:3114) |
| LOC-2 | FC6 |
| LOC-3 | FC6; Q15 |
| LOC-4 | FC4, FC6; EB§5 `rule_ids`; Q11 |
| LOC-5 | EB§4.13; FMT `location_limited` |
| LOC-6 | FMT `where`, `prep`; Packs atx-foam-009, sea-special-024, hc-plastic-012 |
| LOC-7 | EB§4.12; FMT source kinds |
| LOC-8 | EB§4.12; FMT `superseded` |
| LOC-9 | F: Capital Area Corporation (820:4204); FC4, FC6 |
| LOC-10 | FC6; brief rule "no invented facts"; F: Location List (820:3114) |
| LOC-11 | FC5; EB§4.2 |
| LOC-12 | Q12 |
| LOC-13 | Q13 |
| LOC-14 | Q14 |
| LOC-15 | Q16 |
| LOC-16 | Q17 |
| LOC-17 | Q18 |
| LOC-18 | F: Location Map, Location List (Filter button); Q19 |
| CON-1 | F: Item page - Plastic #2, Item page - Electronic Appliance; D38 tasks 2, 3 |
| CON-2 | FC1; D30 task 2; D22 pain relievers; Q21 |
| CON-3 | FC1, FC3 |
| Problem, user | D5, D6, D11, D12, D15 |
| Goals | D12, D15, D19, D22, D38; FC1, FC4, FC5 |
| Non-goals | FC2; F: frames listed in section 2; Q7, Q14, Q20, Q21, Q23 |
