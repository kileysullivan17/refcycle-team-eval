# RefCycle

A local sorting guide for Seattle, Austin, and County of Hawaiʻi. Select a jurisdiction, describe one item, and see a pack-grounded destination, preparation steps and source evidence. Unknown items explicitly abstain; missing attributes produce a question or conditional guidance.

## Run locally

Requires Node.js 20 or later and an API key for the selected provider.

1. Install dependencies once: `npm ci` (use `npm ci --offline` when the packages are already cached).
2. On first setup, copy `.env.example` to `.env`. Add your key and model configuration. Keep an existing `.env`; do not overwrite it.
3. Start with **`npm run dev`**.
4. Open **http://127.0.0.1:3000**.

The server loads and validates the three read-only YAML packs at startup. Restart after changing provider configuration. Missing configuration or invalid packs stop startup with a clear error.

## Providers

Anthropic:

```dotenv
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-5-5
ANTHROPIC_API_KEY=your-key
```

OpenAI:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=gpt-6.1-sol
OPENAI_API_KEY=your-key
```

Both keys can coexist in `.env`; only the matching one is used. Shell environment variables take precedence over `.env`. No model aliases or substitutions are made. Each response and log entry identifies the provider and model returned by the API, falling back to the exact requested ID if the provider omits it.

The selected pack, including any field observations, and the query are sent to the selected model provider. The application makes no other external requests: source pages are links, not fetched documents. Temperature is set to 0 where supported; the verified Anthropic model explicitly rejects this parameter, so the adapter omits it after that rejection. Such models may vary across runs.

## Checks and evaluation

```sh
npm run check       # TypeScript
npm test            # offline contract, HTTP, validation and guardrail tests
npm run eval        # 18 dev CSV cases against configured live provider
npm run test:live   # 17 additional live checks covering requirements 1–13
npm run smoke       # one live known-item check per jurisdiction
```

Live commands use the same provider configuration as the app and incur provider usage. They call the actual HTTP endpoint. `npm run eval` exits nonzero if any case differs from the expected behavior, stream, evidence or required conditional branches. This is deliberate; partial scores are not disguised as success.

Final measured results with `anthropic/claude-sonnet-5-5`: **14/18 dev cases (77.8%)**, **17/17 additional behavior checks**. All four dev failures were clarification mismatches, not incorrect streams. OpenAI `gpt-6.1-sol` passed **3/3 live smoke checks**; a full OpenAI dev evaluation was not run. See [DECISIONS.md](DECISIONS.md) for category results and limitations.

Saved evidence:

- [Dev console output](artifacts/dev-anthropic-output.txt) and [per-case responses](artifacts/dev-anthropic-claude-sonnet-5-5.json)
- [Live behavior output](artifacts/behavior-anthropic-output.txt) and [per-case responses](artifacts/behavior-anthropic-claude-sonnet-5-5.json)
- [OpenAI smoke responses](artifacts/smoke-openai-gpt-6.1-sol.json)
- [Local test output](artifacts/local-tests-final.txt)
- [Browser checks](artifacts/ui-checks.json), [desktop screenshot](artifacts/ui-desktop.png), [mobile screenshot](artifacts/ui-mobile.png)

Browser checks use `playwright-core` and an already installed Chrome/Chromium; no browser downloads occur. Set `CHROME_PATH` to its executable if the existing local cached Chrome path is unavailable:

```sh
CHROME_PATH='/path/to/chrome' npm run test:ui
# Also exercise the real model through the page:
CHROME_PATH='/path/to/chrome' UI_LIVE=1 npm run test:ui
```

## API

`GET /api/jurisdictions` returns `{ id, name }` entries from the loaded packs.

```sh
curl http://127.0.0.1:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"jurisdiction":"hawaii_county_hi","query":"an empty yogurt tub"}'
```

`POST /api/ask` returns every contract field: jurisdiction, interpreted item, behavior, stream, conditions, clarifying question, preparation, explanation, rule IDs, source URLs and model. Non-applicable values are `null` or empty lists. Invalid input returns HTTP 400 with `{ "error": "..." }`; supported requests, including unsupported-jurisdiction and provider-failure abstentions, return 200. Requests accept up to 2,000 query characters and a 16 KiB JSON body.

Requests and responses are appended to `logs/requests.jsonl`, including timestamp, status, duration, exact model and selection diagnostics. API keys and provider authorization headers are never logged. The file is created automatically and ignored by Git. Local test fixtures use temporary logs; live checks use the application's log.

## Boundaries

No camera, maps, accounts, rule browsing, additional jurisdictions or deployment. The original `rules/` and `eval/dev.csv` are unchanged. The server never imports the dev CSV or authored test cases; interpretation uses only the selected pack and the provider's language understanding. Language matching remains a model judgment, while streams and evidence are validated and assembled from the pack. Provider/validation failures abstain with a retry message and official pointer; they are distinct from a valid finding that the pack is silent.
