# Gate 2 open questions: product owner decisions

Decided by Kiley Sullivan, 2026-11-05. All 21 recommended answers accepted as written.

- G0. The facility list is the locator's site data, planned from the start, and holds no expected answers. The stray command text in PRD-DECISIONS.md was a paste error by the session assistant and has been removed. Split the CSV's notes column into notes (user-facing) and internal_notes (never shown).
- G1. A separate app in app/ on port 3001, forwarding to the unchanged engine on port 3000.
- G2. A separate image-model setting that defaults to Sonnet 5.5. Limit uploads to 5 MB, JPEG, PNG or WebP.
- G3. Approve the 50-entry catalog in 10 categories, including the resin-number entries; drop Textiles.
- G4. When the catalog and the engine disagree, show the engine's answer.
- G5. Stream labels: Recycling, Compost, Garbage, Special drop-off, Deposit return. The item page also shows the pack's where text.
- G6. Approve the 12 proposed facility records. The session assistant adds them to the CSV with sources; Kiley spot-checks. The hc-oil-015 business appears as "a local biodiesel company (call first)".
- G7. Add a rule_ids column to the facility CSV; it is the single place the links live.
- G8. The locator does not show also-acceptable routes in this run; it shows only where the engine's answer points.
- G9. The session assistant fills the Seattle transfer station and Austin drop-off center addresses from the official pages the packs cite; Kiley spot-checks. The two Hawaiʻi County events stay "location to be announced". Phone reports show as "phone report, 2026-11-03".
- G10. Coordinates are entered by hand for each sourced address and spot-checked by Kiley. The map uses OpenStreetMap tiles. Records without an address appear in the list only.
- G11. For "February 2027, date TBD", the last date is 2027-02-28.
- G12. Swap every spelling of the county name in text the app or engine writes; leave quoted source lines as written.
- G13. The description wins: the display-time swap replaces the hc-oil-015 business name with "a local biodiesel company", logged.
- G14. When item_interpreted is null, the title is the query as sent.
- G15. Red #FF2D35; corner radius 15px; bundle Outfit and MuseoModerno (open-license Google Fonts).
- G16. Read the Figma Components page before the builder briefs are final.
- G17. Tab bar: Recyclopedia, Camera, Locations.
- G18. Plain category cards, no Figma photos.
- G19. Approve when Dispose shows, and that a conditional answer's locator view lists sites for every case, grouped by case.
- G20. A clarify reply sends the original question plus the user's reply as one new question.
