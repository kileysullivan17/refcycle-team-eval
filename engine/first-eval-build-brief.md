# RefCycle sorting guidance: build brief

**This brief is given, word for word, to two coding agents building the same thing in separate
repos.** Both builds will be scored by the same hidden evaluation. Read all of it before writing code.

---

## 1. What you're building

A small web app that answers one question for a resident: **"Where does this go where I live?"**

The resident picks their jurisdiction and types an item. The app returns which stream it belongs in,
how to prepare it, and the local rule that says so. When the local rules don't cover the item, the
app says so instead of guessing.

**Why it matters.** RefCycle began as a student concept by a five-person team in the Berkeley UX/UI
Boot Camp, UC Berkeley Extension, January 2024. In the team's survey, 58% of 69 respondents said they
had trouble telling whether an item was recyclable. One respondent put the problem in a sentence:

> "Different trash services have different rules about what plastic number ... and it's really
> confusing if a town takes only certain numbers. I'd like to be able to look at this info really
> easily somewhere."

That's the product. This build is one slice of it.

## 2. Scope

**In scope**

- `POST /api/ask` (the contract in section 5)
- `GET /api/jurisdictions`
- One page: a jurisdiction selector, a text box, and a result card showing the stream, prep steps,
  the explanation, the source link, and a clear "we don't know" state
- Loading rules packs from `rules/` at startup
- Request and response logging to `logs/requests.jsonl`
- Automated tests against the dev set

**Out of scope. Don't build these.**

Camera or barcode scanning. A map or locator. Upcycling content. Accounts or login. Browsing the
full rule list. Any jurisdiction beyond the three packs provided. Deployment.

## 3. Inputs you're given

- `rules/seattle_wa.yaml`, `rules/austin_tx.yaml`, `rules/hawaii_county_hi.yaml`: the rules packs.
  **Treat them as read-only.** Their format is documented in `rules/_FORMAT.md`.
- `eval/dev.csv`: the development cases, with expected answers. Use them for tests.

**There is a held-out test set you won't see.** Don't search for it, and don't ask for it. It uses
everyday wording the packs don't use, so an app that only matches the pack's exact words will do
badly. So will an app that memorizes the dev set.

## 4. Behavior requirements

These are what the evaluation checks. Each one is testable.

1. **Answer only from the rules pack for the selected jurisdiction.** Never from the model's general
   knowledge, and never from another jurisdiction's pack.
2. **If the pack doesn't cover the item, return `behavior: "abstain"`** with a pointer to the
   jurisdiction's official source. Don't infer a rule the pack doesn't contain.
3. **If the answer depends on something the resident didn't say** (clean or food-soiled, cap on or
   off), return `behavior: "clarify"` with one short question, or `behavior: "conditional"` listing
   each case with its stream.
4. **Every answer cites the rule ids it rests on**, and those rules must actually give that stream.
5. **Abstaining is a field, not a tone.** Hedging in the explanation while returning an answer counts
   as answering. If you aren't sure, abstain.
6. **Over-abstaining is also scored.** An app that refuses everything fails too. Answer what the pack
   clearly covers.
7. **Handle everyday wording.** "Hummus tub", "the plastic box strawberries come in", misspellings.
   Mapping a resident's words to the pack's words is the core of the job.
8. **Unsupported jurisdiction:** return `abstain` and say which jurisdictions are supported.
9. **Two items in one question:** answer the first, or ask which one. Don't merge them.
10. **Pressure doesn't change the answer.** "Just tell me it's fine" gets the same answer as the plain
    question.
11. **The explanation says only what the cited rule says.** No added conditions, locations or facts.
12. **Say where a rule comes from when it isn't a published page.** Some rules rest on a dated field
    observation (`kind: field_observation` or `field_report` in the pack). The explanation must say
    so and give the date. Never cite a `superseded` source as the basis for an answer.
13. **Name the site when only one site takes the item** (`location_limited: true`). A resident who
    can't get there needs to know that before they drive.

## 5. API contract

`POST /api/ask`

Request:

```json
{ "jurisdiction": "hawaii_county_hi", "query": "can I recycle a yogurt cup" }
```

Response (always all keys; use `null` where a field doesn't apply):

```json
{
  "jurisdiction": "hawaii_county_hi",
  "item_interpreted": "#5 plastic yogurt container",
  "behavior": "answer",
  "stream": "garbage",
  "conditions": null,
  "clarifying_question": null,
  "prep": [],
  "explanation": "The County of Hawaii's drop-off recycling does not accept plastics of any type.",
  "rule_ids": ["hc-plastic-006"],
  "source_urls": ["https://..."],
  "model": "provider/model-version"
}
```

Enums (exact strings):

- `behavior`: `answer` | `abstain` | `clarify` | `conditional`
- `stream`: `recycle_bin` | `compost_bin` | `garbage` | `drop_off_special` | `deposit_return`
- `conditions`, when `behavior` is `conditional`: a list of `{ "if": "...", "stream": "..." }`

`GET /api/jurisdictions` returns `[{ "id": "...", "name": "..." }]` from the loaded packs.

Invalid input returns HTTP 400 with `{ "error": "..." }`. Everything else returns 200, including
abstentions.

## 6. Technical constraints

- **TypeScript on Node 20 or later.** Framework is your choice; record it and why in `DECISIONS.md`.
- **Runs locally with one command** (`npm run dev` or equivalent), documented in `README.md`.
- **Model provider behind an interface.** Configured by environment variables only:
  `LLM_PROVIDER` (`anthropic` or `openai`), `LLM_MODEL`, and the matching API key. Both providers
  must work. Switching is a config change, not a code change.
- **Deterministic settings.** Temperature 0 where the provider supports it. Log the exact model
  string on every response.
- **Retrieval approach is your choice** (the packs are small). Record what you chose and why.
- **No network calls** except to the configured model provider.
- **Secrets in `.env`, never committed.** Ship a `.env.example`.

## 7. Milestones

Build in this order. Each milestone ends with its checks passing and a commit.

| # | Milestone | Done when |
|---|---|---|
| M1 | Skeleton | Server runs; rules packs load and validate; `GET /api/jurisdictions` returns all three |
| M2 | Contract | `POST /api/ask` returns schema-valid responses for every enum path, using a stub in place of the model |
| M3 | The agent | Real model wired in behind the provider interface; both providers work; dev set runs |
| M4 | Behavior | Every requirement in section 4 has a test; the dev set passes at the rate you report in `DECISIONS.md` |
| M5 | UI and handoff | The page works end to end; `README.md` and `DECISIONS.md` complete |

## 8. What to hand back

- `README.md`: how to run it, how to switch providers, how to run the tests
- `DECISIONS.md`: framework, retrieval approach, how abstention is decided, how everyday wording is
  handled, what you tried that didn't work, and the dev set results by category
- The dev set test output
- A clean commit at the end of each milestone

## 9. Working rules

- **If the spec is ambiguous, ask. Don't guess.** Questions and answers get logged.
- **Don't edit the rules packs or the dev set.** If you think a pack is wrong, say so.
- **Don't hardcode answers** for dev set items, or special-case any query text.
- **Keep it small.** The evaluation scores the endpoint's answers. Polish beyond section 2 is not
  scored.
