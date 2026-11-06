# Decisions and questions (baseline build)

Each entry: the question or gap, then the choice made. None changed a contract interface that another part of the app depends on; the additions are optional and additive.

**D1. Conditional answers and "grouped by case" (G19).** The hand-off to the locator carries only `item` and `rule_ids`, and `/api/sites` has no per-case data, so the locator cannot know the cases. Choice: for a conditional answer the item page adds one optional `case=<stream>|<if text>` parameter per case to the Dispose link. The locator groups by case; a case whose stream is `drop_off_special` or `deposit_return` lists the sites for the cited rules, any other case states its stream and lists no site. Without `case` parameters the list is flat. Facility links are to rules, not cases, so every cited rule's sites appear under each drop-off case.

**D2. Locator and X-9.** CONTRACTS 2.1 says the item page calls the engine. When the place changes while the locator shows an item, the old `rule_ids` belong to another pack. Choice: the locator asks `POST /api/ask` once for the item in the new place and uses that response's `rule_ids` and cases. A new `clarify` answer shows "needs one more detail" with a link to the item page; an `abstain` answer shows the LOC-11 message.

**D3. `/api/sites` details the contract leaves open.** Unknown or missing `place` returns 400 `{ "error": "Unknown place" }`. `rule_ids` absent means every linked record; present but empty means none (so LOC-11 shows). Unknown rule ids are ignored. `only_site` is set only when `rule_ids` was supplied. Without `rule_ids`, `rules` holds the rules linked to the returned records, so the list can show field-observation notes.

**D4. Pack loading time.** CONTRACTS 6 says the packs load at startup. They load on the first `/api/sites` request and the result is kept; a failure is not kept, so a fixed file works on the next request. The effect on the resident is the same (500 with the fixed body).

**D5. `/api/identify` edge cases.** No key configured: 502 (the contract lists only 400 and 502). Unparseable model output: 502. `identified` with an empty label or one over 120 characters: returned as `unclear`. `multiple` may carry 0 to 4 candidates (the resident can type the item). "Through the engine's existing provider adapters" (CS-2, Q7): the engine's adapter only takes a rules pack and text, so the app has its own small adapter for the same two providers, same endpoints, same key variables, same temperature handling.

**D6. Locator default view.** The contract names `view=list|map` with no default. Choice: map, as in the Figma tab bar order; with no pins it shows the required message and a List button.

**D7. Search flow.** Submit with matches opens `/search?q=`; submit with no match goes straight to the item page (RC-9). The search screen always ends with an "Ask RefCycle about" row so a literal question is always possible. On a material page the box filters that category's entries.

**D8. Clarify and place change.** Changing the place on an item page re-asks the original query, dropping earlier clarify replies (they were answers about another place's rules).

**D9. Events after their last date.** The CSV note carries the old date ("Tentative 2027-03-06."), so after the last date the card shows only "Check the source for the next event", the checked date and the source link.

**D10. SVG namespace.** `public/shared/icons.js` contains the SVG namespace string `http://www.w3.org/2000/svg`. It is an identifier, not a request. The source-scan test allows it explicitly.

**D11. Fonts.** Outfit 300, 400, 600 and MuseoModerno 400, 700 (a real 700 file, no synthesized bold), latin and latin-ext subsets, from the Fontsource 5.3.0 packages (OFL 1.1, licenses in `public/shared/fonts/`). Outfit 700 is not bundled because no style uses it.

**D12. Engine forwarding limits.** The app reads up to 64 KB before forwarding `/api/ask` (the engine enforces its own 16 KiB limit and answers 400). Engine unreachable: 502; no reply within 155 s: 504. The client treats any of these as the "no answer" state.

**D13. Brightness of the blue card.** White text on San Marino measures above 4.5:1, so the blue card uses white; yellow uses ink; red uses ink, bold, 22px (contrast rule). The contract fixes only the red rule.

**D14. Blue text.** No stylesheet uses `--color-blue` as a text color (stricter than the contract, which forbids it only on Wheatfield); it is used for button and tab backgrounds.

**D15. Tests that need a browser.** `test/e2e/browser.test.ts` needs Chrome and `playwright-core` (found in `engine/code/node_modules`); without them it is skipped, so `npm test` stays green on any machine.

**D16. Header back control.** Shown on every screen except the place picker. On the Recyclopedia landing, with no history to go back to, it stays on Recyclopedia.

**D17. Stale doc.** `orchestrator/CONTRACTS.md` 2.1 lists `app/README.md` under the Recyclopedia builder; written here. Nothing else in the contracts needed a change request.
