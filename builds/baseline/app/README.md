# RefCycle app

A phone-width web app for recycling guidance in Seattle, WA; Austin, TX; and Hawaiʻi County, HI. It has three features that share one shell and one engine: Recyclopedia, Camera scan and the Recycling center locator. Requirements are in `orchestrator/PRD.md`; interfaces are in `orchestrator/CONTRACTS.md` v1.3.

## Run

Needs Node 20 or later.

1. `cd engine/code && npm ci`, copy its `.env` settings as its README says, then `npm run dev` (engine on 127.0.0.1:3000).
2. `cd app && npm ci`. Copy `.env.example` to `.env`. Camera scan needs `ANTHROPIC_API_KEY` (or `LLM_IMAGE_PROVIDER=openai` and `OPENAI_API_KEY`); without a key the scan screen still works and tells the resident to type the item.
3. `npm run dev`, then open http://127.0.0.1:3001.

## Check and test

```sh
npm run check   # TypeScript
npm test        # unit, API and browser tests
```

Tests use a fake engine and a fake image provider; nothing reaches a model provider. The browser tests in `test/e2e/` start Chrome through `playwright-core` (installed with the engine's dev dependencies). They skip with a message when Chrome is not found; set `CHROME_PATH` to point at it. Tests write logs to a temporary folder, not to `app/logs/`.

## Layout

| Path | What |
|---|---|
| `src/server.ts` | HTTP server: static files, client routes, engine forwarding, display-swap log, feature loading |
| `src/features/recyclopedia/` | `GET /api/catalog` |
| `src/features/camera-scan/` | `POST /api/identify` |
| `src/features/locator/` | `GET /api/sites` (packs plus `engine/data/facilities.csv`) |
| `data/catalog.json` | the approved 50-entry catalog |
| `public/shared/` | shell, router, place picker, item page, `displayText`, tokens, bundled fonts and Leaflet |
| `public/features/*/` | screens per feature |
| `docs/` | one page per feature, `DECISIONS-baseline.md`, `baseline-report.md` |

The app has no build step: the browser loads the files in `public/` as ES modules. The app writes `logs/identify.jsonl` and `logs/display-swaps.jsonl` (git-ignored). Photos are never written or logged.
