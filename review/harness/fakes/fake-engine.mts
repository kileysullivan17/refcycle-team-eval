// Fake engine for the harness dry run: the build's own pinned engine code (createApp, assemble, the real packs)
// with a fixture model provider in place of the remote model. Nothing in the build is changed; this file only
// imports the engine read-only. Run from the build's engine/ folder:
//
//   ENGINE_CODE=$PWD/code FAKE_ENGINE_LOG=<file> \
//     node --import ./code/node_modules/tsx/dist/esm/index.mjs <review>/harness/fakes/fake-engine.mts [key|broken]
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { selectionFor } from './fixtures.mjs';

const mode = process.argv[2] === 'broken' ? 'broken' : 'key';
const engineCode = path.resolve(process.env.ENGINE_CODE || 'code');
const rulesDir = path.resolve(process.env.RULES_DIR || 'rules');
const { loadPacks } = await import(pathToFileURL(path.join(engineCode, 'src', 'rules.ts')).href);
const { createApp } = await import(pathToFileURL(path.join(engineCode, 'src', 'server.ts')).href);
const packs = await loadPacks(rulesDir);

const provider = {
  model: `fake/practice-${mode}`,
  async select(pack: { jurisdiction: { id: string } }, query: string) {
    const value = selectionFor(mode, pack.jurisdiction.id, query);
    return { value: value === 'INVALID' ? { not: 'a selection' } : value, model: this.model };
  },
};

const logPath = process.env.FAKE_ENGINE_LOG || path.join(os.tmpdir(), 'refcycle-fake-engine', 'requests.jsonl');
const port = Number(process.env.PORT || 3000);
createApp(packs, provider, logPath).listen(port, '127.0.0.1', () => console.log(`Fake engine (${mode}) on 127.0.0.1:${port}, engine ${engineCode}, rules ${rulesDir}`));
