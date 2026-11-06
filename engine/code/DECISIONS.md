# Decisions

## M1: skeleton

Use TypeScript with Node's built-in HTTP server, Zod validation, and YAML parsing. A framework would add machinery without helping two endpoints and one static page. Node 20+ runs TypeScript via tsx. Dependencies installed offline from the existing npm cache; tarball URLs pin the cached versions without contacting a registry during this build.

Load every YAML pack once at startup, validate fields, source references, unique IDs, field dates and location-limited destinations. No runtime fetching of source pages. Original packs and dev cases remain unchanged.

Checks: TypeScript passes; 2 skeleton tests pass, including the real loopback HTTP endpoint.

## M2: contract

The model interface returns a rule selection, not a finished answer. The assembler derives streams, conditional branches, preparation, citations, destination quotes, field dates and named locations from the selected pack. It rejects missing or foreign rules and unresolved branches. Unsupported jurisdictions and model/validation failures explicitly abstain. Every API answer has all contract keys. Tests cover all behaviors, all five streams, invalid HTTP inputs and JSONL logging. Typecheck and 8 tests pass.

## M3: live providers and development evaluation

Retrieval sends the complete selected pack (about two dozen rules) to the configured provider. No embeddings, keyword filter or external search: a filter could omit exceptions or uncommon everyday phrasing. Superseded sources are removed from model context. The runtime never reads eval/dev.csv. Language interpretation belongs to the model; stream choice and response evidence are assembled from the pack. There are no item aliases or query-specific cases in application code.

Both HTTP adapters have passing mocked transport tests, including exact model-version propagation and retrying without temperature only after a provider explicitly rejects temperature. All requests first use temperature 0. Model selection is explicit; no substitute model or provider fallback. Provider errors, invalid structured outputs and invalid evidence abstain. Model failures do not establish that an item is unsupported, so the failure explanation distinguishes them.

Live checks completed after the user supplied keys and explicitly authorized sending packs and queries to both providers. OpenAI gpt-6.1-sol passed three live smoke checks, one per jurisdiction. Anthropic claude-sonnet-5-5 completed the 18-case dev set: 14/18 (77.8%). At this checkpoint A/B/C/D each score 3/3, E/F each 1/3. Results are saved in artifacts/dev-anthropic-claude-sonnet-5-5.json and the console output beside it. The evaluator uses the actual HTTP endpoint, so these calls are also in ignored logs/requests.jsonl. Scoring checks expected behavior, answer stream, at least one listed expected rule, and specified conditional branches. It is a local metric, not the hidden evaluator.

The first run failed because Anthropic rejects temperature as deprecated; the adapter now recognizes this explicit rejection and omits temperature for subsequent calls on that instance. Both providers first request temperature 0; unsupported models control their own sampling, so repeatability cannot be guaranteed. The first usable run scored 12/18; a general prompt clarification about conventional household forms raised this to 14/18. No query aliases or item-specific prompt examples were added. Remaining failures reflect uncertain interpretation of everyday packaging; M4 will exercise broader behavior.

What did not work: an offline npm install using normal version specs missed cached registry metadata; cached tarball URLs succeeded. The tsx CLI tried to create a sandbox-blocked IPC socket; using Node's --import tsx avoids that unnecessary IPC. Loopback HTTP tests require sandbox approval and pass with it. The M3 checks total 15 passing tests plus TypeScript validation. These are contract and adapter checks, not semantic quality evidence.

M3 checks: both providers have live successful responses, the dev set completes with the reported rate, TypeScript passes, and all 15 local tests pass.

## M4: behavior checks

All 13 requirements have explicit coverage. `test/behavior.test.ts` tests jurisdiction isolation, explicit abstention, complete conditional branches, all authored streams/rule IDs, unsupported jurisdictions, refusal to merge independent rules, evidence copied from the pack, field reports/observations and dates, named limited locations, and inferred destinations. `npm run test:live` adds 17 real-provider cases, including everyday wording, misspellings, two-item input, pressure, unknown items and ambiguous attributes. Runtime code never imports these test cases.

The live behavior suite passed 17/17 with Anthropic; 26 local tests and TypeScript validation pass. An earlier live behavior run passed 16/17: an invalid selection fell back to abstention. A single bounded correction request now gives the model one chance to satisfy the selection schema; a second failure still abstains. No retries are made merely to turn a valid abstention into an answer. Diagnostics record structured selections and validation/provider failure categories in the request log, with no API keys or request headers.

The source evidence assembler supplies quotes verbatim, so explanations can be lengthy for broad rules. This trades conversational brevity for auditable support. It cannot prove that a language model selected the right category; the live tests exercise that remaining semantic boundary. Conditional branches copy pack language rather than inventing new criteria. Primary disposal routes are preferred; optional also_acceptable routes are not promoted to primary recommendations. Inferred destinations are explicitly labeled and not generalized beyond their stated scope.

The model still sometimes asks about material variants of familiar packaging where the dev set expects a default interpretation. We retain those failures in the report instead of adding query-specific exceptions. Temperature is unavailable on the configured Anthropic model, so individual outputs can vary between runs despite identical inputs.

Final M4 dev result: **14/18 (77.8%)**. All four failures are clarifications where the dev CSV requires an answer or abstention; no failed case returned an incorrect stream. The failing cases are c12-atx, c12-hc, c12-sea and c26-hc.

| Category | Passed | Total | Rate |
|---|---:|---:|---:|
| A | 3 | 3 | 100.0% |
| B | 3 | 3 | 100.0% |
| C | 3 | 3 | 100.0% |
| D | 3 | 3 | 100.0% |
| E | 0 | 3 | 0.0% |
| F | 2 | 3 | 66.7% |

`npm run eval` intentionally exits nonzero when any dev case fails; the saved output documents the measured rate rather than masking failures. Historical runs remain in artifacts for comparison.

## M5: UI and handoff

A static HTML/CSS/JavaScript page served by the same Node server keeps the runtime small. There are no CDN fonts, analytics, client libraries, image services or external fetches. The page loads jurisdiction options from the API, preserves the description for clarification, and shows all four behavior states. It renders model text using textContent rather than HTML, cancels stale browser requests when the item/jurisdiction changes, exposes loading and errors through live regions, and uses explicit labels and keyboard focus states. Conditional branches, preparation, source links, rule references and unpublished field provenance stay visible.

Playwright Core is a development-only dependency. Browser tests use installed Chrome and block external browser requests; the one live UI test reaches Anthropic through the local API, as the app normally does. No browser binaries were downloaded.

Final handoff checks: TypeScript passes; 26/26 local tests pass; all 11 browser checks pass, including a real Anthropic request. The documented npm run dev starts on 127.0.0.1:3000 and returns the page and all three jurisdictions. Desktop and 390px mobile screenshots are saved under artifacts/. Original rules and dev CSV have no diff against the initial commit; .env and logs remain untracked. No deployment was performed.
