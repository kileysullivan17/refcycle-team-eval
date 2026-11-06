# Recyclopedia and the shared shell

**Server.** `GET /api/catalog` serves `data/catalog.json` (10 categories, 50 entries; validated on load, `query` must equal `name`). `src/server.ts` also forwards `GET /api/jurisdictions` and `POST /api/ask` to the engine unchanged, logs display swaps, serves `public/`, and returns the shell page for every client route.

**Screens.** Place picker (`/place`), Recyclopedia landing (category cards and search), material page, search results, and the item page.

- Landing: 10 plain cards. Typing filters entries by case-insensitive substring of the name (RC-3). Submit opens `/search?q=` when something matches, and otherwise goes straight to `/item?q=...&origin=search` so the engine gets the text as a free question (RC-9). The search screen always ends with an "Ask RefCycle about" row.
- Material page: that category's entries, with its own search box.
- Item page (`public/shared/item-page.js`, pure rules in `item-model.js`): asks `POST /api/ask` with the stored place and renders exactly one state: `card-blue`, `card-yellow`, `card-red`, `referee-check-clarify`, `referee-check-conditional`, `referee-check-abstain`, `loading` or `error`. The card color comes only from `behavior` and `stream`. Title is `item_interpreted`, else the query as sent. Prep, the explanation (plain text, only `displayText` applied), the `where` text of the cited rules (from `/api/sites`; hidden if that route fails) and source links follow. Dispose shows on red, on deposit return and on conditionals with a special or deposit case. Upcycle is not built.
- Clarify: the reply is sent as `<query so far> <reply>` (G20).
- Place change: every screen that shows an answer re-asks (X-9).

**Display swap.** `public/shared/display-text.js` is the only place engine, pack or facility text is changed: the county name becomes "Hawaiʻi County" and the hc-oil-015 business becomes "a local biodiesel company", both outside quoted source lines; each replacement is logged through `POST /api/log/display-swap`.

**Tokens.** `public/shared/tokens.css` holds every color, font, radius, size and spacing value; `test/shared/styles.test.ts` and `contrast.test.ts` enforce that.
