# Gate 3 questions: product owner decisions

Decided by Kiley Sullivan, 2026-11-05. All nine recommended answers accepted.

1. Repo: the session assistant creates the git repo and the base commit, including app/package.json, app/tsconfig.json and app/.env.example (configuration only). Private on GitHub until Kiley says go.
2. Builders may install packages from the npm registry (npm ci in engine/code and app).
3. Builders get no provider keys and test against a fake engine. The live end-to-end check runs at merge with Kiley's key.
4. Builders start on the provisional design tokens: token names are fixed, values may change. Kiley supplies the colors later; values are corrected before the scored run. This changes the G16 decision (Components page read before briefs are final), with Kiley's explicit approval.
5. The locator may use Leaflet 1.9.4 (BSD-2), served from the app and listed in the base package.json.
6. Image model settings: LLM_IMAGE_PROVIDER (default anthropic) and LLM_IMAGE_MODEL (default claude-sonnet-5-5).
7. Fold the workspace layout, the handle and mount signatures, the shared ctx object and dynamic feature loading into CONTRACTS.md v1.1, including the move of the locator module to app/src/features/locator/sites.ts.
8. The LOC-9 facility detail screen lists each linked rule's applies_to items from the pack, after the name swap.
9. A map with no pins is acceptable for the builders' acceptance checks. Coordinates go in before the scored run.

Also recorded: Kiley verified the f-sea-01 and f-sea-02 addresses and hours against the station pages on 2026-11-05; facilities.csv is updated.
