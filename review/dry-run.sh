#!/usr/bin/env bash
# Harness dry run with fakes, PRACTICE CASES ONLY. Proves the harness and the grader before the scored run.
#
#   ./dry-run.sh <build folder> <key|broken> <results folder>
#
# Starts the build's own engine code with a fixture model (fakes/fake-engine.mts) on 127.0.0.1:3000 and the
# build's app on 127.0.0.1:3001 with a fake image provider preloaded (fakes/fake-image-preload.mjs). No model
# provider is called. The build folder is only read and run; nothing in it is edited.
set -euo pipefail

REVIEW="$(cd "$(dirname "$0")" && pwd)"
BUILD="$(cd "${1:?build folder}" && pwd)"
MODE="${2:-key}"
OUT="${3:?results folder}"
KEYS="${KEYS_DIR:-$REVIEW/../../refcycle-private/frozen-2026-11-05}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
CONTROL="$OUT/fake-photo-control.txt"
: > "$CONTROL"

for p in 3000 3001; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "Port $p is in use. Stop whatever is on it first." >&2; exit 1; fi
done

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; wait 2>/dev/null || true; }
trap cleanup EXIT

( cd "$BUILD/engine" && ENGINE_CODE="$BUILD/engine/code" FAKE_ENGINE_LOG="$OUT/fake-engine-requests.jsonl" PORT=3000 \
    exec node --import "$BUILD/engine/code/node_modules/tsx/dist/esm/index.mjs" "$REVIEW/harness/fakes/fake-engine.mts" "$MODE" ) > "$OUT/engine.log" 2>&1 &
PIDS+=($!)
( cd "$BUILD/app" && ENGINE_URL=http://127.0.0.1:3000 PORT=3001 FAKE_IMAGE_MODE="$MODE" FAKE_PHOTO_CONTROL="$CONTROL" \
    LLM_IMAGE_PROVIDER=anthropic LLM_IMAGE_MODEL=claude-sonnet-5-5 ANTHROPIC_API_KEY=fake-key-dry-run \
    exec node --import tsx --import "$REVIEW/harness/fakes/fake-image-preload.mjs" src/server.ts ) > "$OUT/app.log" 2>&1 &
PIDS+=($!)

for url in http://127.0.0.1:3000/api/jurisdictions http://127.0.0.1:3001/api/jurisdictions; do
  for i in $(seq 1 60); do curl -sf "$url" >/dev/null && break; sleep 0.5; done
  curl -sf "$url" >/dev/null || { echo "Server did not start: $url" >&2; cat "$OUT/engine.log" "$OUT/app.log" >&2; exit 1; }
done

node "$REVIEW/harness/run.mjs" --build "dry-$(basename "$BUILD")-$MODE" --build-dir "$BUILD" \
  --build-head "$(git -C "$BUILD" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
  --base-url http://127.0.0.1:3001 --keys "$KEYS" --splits practice --out "$OUT" --fake-photo-control "$CONTROL" "${@:4}"
