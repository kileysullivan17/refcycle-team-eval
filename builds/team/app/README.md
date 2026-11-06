# RefCycle app

The phone-width web app (port 3001). It serves the Recyclopedia, the shared shell (place picker, header,
tab bar, item page) and its own API, and forwards `GET /api/jurisdictions` and `POST /api/ask` unchanged to
the pinned engine in `engine/code` (port 3000). Contracts: `orchestrator/CONTRACTS.md` v1.3.

## Run it

1. Install, once per checkout:

   ```
   cd engine/code && npm ci
   cd ../../app && npm ci
   ```

2. Start the engine (needs its own `.env` with a model provider key, see `engine/code/README.md`):

   ```
   cd engine/code && npm run dev
   ```

3. Copy `app/.env.example` to `app/.env` if you need to change `ENGINE_URL` (default
   `http://127.0.0.1:3000`). Then start the app:

   ```
   cd app && npm run dev
   ```

4. Open http://127.0.0.1:3001 (set `PORT` to use another port). Pick a place on first use; the choice is
   kept in `localStorage` under `refcycle.place`.

Logs go to `app/logs/` (git ignores `*.jsonl` there): `display-swaps.jsonl` records every display-time
text swap.

## Check and test

```
cd app
npm run check   # tsc --noEmit
npm test        # every slice's tests (node:test, fake engine, no model keys)
```

One slice only, for example the shell and the Recyclopedia:

```
node --import tsx --test "test/shared/**/*.test.ts" "test/recyclopedia/**/*.test.ts"
```

Tests never call a model provider. They use a fake engine (`test/shared/fixtures.ts`, responses validated
with the engine's own `AnswerSchema`) and a small fake DOM (`test/shared/fake-dom.ts`) that runs the real
client modules in Node.

## Layout

| Path | What |
|---|---|
| `src/server.ts` | app server: own routes, static files, dynamic feature loading |
| `src/shared/` | forwarding, static files, JSONL logging, HTTP helpers |
| `src/features/<feature>/routes.ts` | one module per feature, `handle(req, res, url)` |
| `data/catalog.json` | the approved Recyclopedia catalog (CONTRACTS 5) |
| `public/index.html` | the single page |
| `public/shared/` | router, header, place picker, tab bar, item page, `displayText`, `tokens.css`, fonts |
| `public/features/<feature>/screens.js` | one module per feature, `mount(route, container, ctx)` |
| `docs/` | per-slice build notes and reports |
