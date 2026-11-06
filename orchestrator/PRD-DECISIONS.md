# PRD open questions: product owner decisions

Decided by Kiley Sullivan, 2026-11-05. All 25 recommended answers accepted as written; Q25 answered by Kiley.

- Q1. A place picker on first use and in the header, remembered on the device. No default, no device location.
- Q2. Keep the card colors: blue flag for recycle_bin, compost_bin and deposit_return; yellow card for garbage; red card for drop_off_special. Clarify, conditional and abstain show a neutral "referee check" state with no card. Card copy names the stream; drop "Score!" and "Hazardous".
- Q3. Drop the decomposition and percent-recycled figures. No source supplies them.
- Q4. One catalog entry per material group the rules packs cover in at least one place. The orchestrator drafts the list; Kiley approves it (at gate 2). A place with no coverage shows "we don't know" for that entry.
- Q5. Search text that matches no entry goes to the engine as a free question.
- Q6. A material entry sends the material name to the engine. Conditional answers are expected and shown as conditional.
- Q7. Identification uses an image model through the engine's existing model provider. No barcode lookup.
- Q8. Always show "Is this a ___?" with an edit option. If the photo is unclear or shows more than one item, ask instead of guessing.
- Q9. If camera access is denied, offer photo upload. Photos go to the model provider for identification only and are not stored.
- Q10. The item page title is the engine's item_interpreted. No brand or model names.
- Q11. The locator reads where and location_limited from the pack by the rule_ids the engine returns, read-only. The engine stays unchanged.
- Q12. With no item chosen, the locator lists every site for the selected place.
- Q13. Addresses and map pins come only from pack text and the official pages the packs cite. No geocoder. A site without a sourced address is listed but gets no pin.
- Q14. No device location in this run. Sort by name, show no distances.
- Q15. The business named in hc-oil-015 is shown by description, like every other private business.
- Q16. Destinations without a single address (curbside, scheduled pickup, retail stores, library branches) show as "how to" entries with the instruction and source, no address, no pin.
- Q17. Site sets the pack does not list (scrap metal bins, 14 HI-5 centers) show as one category entry with the pack's wording and a source link.
- Q18. Dated events show labeled "tentative" with the source and date checked. After the last date: "check the source for the next event".
- Q19. Filter by material accepted.
- Q20. Place-wide Local Guidelines screens are out of scope.
- Q21. Hide Upcycle. Dispose opens the locator for that item.
- Q22. A web app at phone width, on the same TypeScript stack as the engine.
- Q23. Drop History and Recently Viewed for this run.
- Q24. Swap the place name only ("County of Hawaiʻi" or "County of Hawaii" to "Hawaiʻi County"), at display time, and log it. Leave every other word as the engine returned it.
- Q25. The rules are verified (Kiley). The pack header comment is stale. No feature treats the rules differently.

Note for the write-up: these are answers to open questions, not changes to the draft's requirements. Kiley changed no requirement the orchestrator wrote.
