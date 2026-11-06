#!/usr/bin/env node
// RefCycle scored-run harness. Drives one running build through its UI for every selected key case and writes
// the raw observations. It never grades; grade/grade.mjs does that from the files written here.
//
//   node harness/run.mjs --build baseline --base-url http://127.0.0.1:3001 --keys <frozen keys dir> \
//        --out <results dir> [--splits practice] [--features recyclopedia,locator,scan] [--repeats 1]
//
// Test and held_out cases run only with --scored and REFCYCLE_SCORED_RUN=1 (set by run-scored.sh).
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { loadAllKeys, verifyKeys } from './lib/keys.mjs';
import { attachNetwork, DriveError, openLocatorFromItem, pickPlace, readItemPage, readScreen, scanPhoto, searchToItem } from './lib/drive.mjs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[k] = v;
  }
  return out;
}

const opt = args(process.argv.slice(2));
const build = opt.build;
const baseUrl = opt['base-url'] || 'http://127.0.0.1:3001';
const keysDir = opt.keys;
const outDir = opt.out;
const splits = String(opt.splits || 'practice').split(',').map((s) => s.trim());
const features = String(opt.features || 'recyclopedia,locator,scan').split(',').map((s) => s.trim());
const repeats = Math.max(1, Number(opt.repeats || 1));
const only = opt.cases ? new Set(String(opt.cases).split(',')) : null;
const caseTimeout = Number(opt['case-timeout'] || 330_000);

if (!build || !keysDir || !outDir) {
  console.error('Usage: run.mjs --build <name> --keys <dir> --out <dir> [--base-url URL] [--splits practice] [--features ...] [--repeats N]');
  process.exit(2);
}
const scoredSplits = splits.filter((s) => s !== 'practice');
if (scoredSplits.length && !(opt.scored === true && process.env.REFCYCLE_SCORED_RUN === '1')) {
  console.error(`Refusing to run ${scoredSplits.join(', ')} cases: they run only in the real scored run (run-scored.sh).`);
  process.exit(2);
}

const check = verifyKeys(keysDir);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'keys-check.json'), JSON.stringify(check, null, 2));
if (!check.ok) {
  console.error('Key checksums do not match SHA256SUMS.txt. Stopping.');
  for (const l of check.lines) console.error(`  ${l.ok ? 'OK  ' : 'FAIL'} ${l.name}`);
  process.exit(3);
}

const keys = loadAllKeys(keysDir);
const work = [];
for (let r = 1; r <= repeats; r++) {
  for (const f of features) {
    for (const c of keys[f] || []) {
      if (!splits.includes(c.split)) continue;
      if (only && !only.has(c.case_id)) continue;
      work.push({ ...c, repeat: r });
    }
  }
}

async function launch() {
  const exe = opt.chrome || process.env.CHROME_PATH;
  try {
    if (exe) return await chromium.launch({ executablePath: exe, headless: true });
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    console.error('Could not start Google Chrome for the harness.');
    console.error('Install Google Chrome, or set CHROME_PATH to a Chrome or Chromium executable.');
    console.error(String(e.message || e).split('\n')[0]);
    process.exit(4);
  }
}

const browser = await launch();
const meta = {
  build,
  base_url: baseUrl,
  build_dir: opt['build-dir'] || null,
  build_head: opt['build-head'] || null,
  keys_dir: path.resolve(keysDir),
  splits,
  features,
  repeats,
  started: new Date().toISOString(),
  node: process.version,
  browser: browser.version(),
  host: os.hostname(),
  platform: `${os.platform()} ${os.release()}`,
  fake_photo_control: opt['fake-photo-control'] || null,
  cases: work.length,
};
writeFileSync(path.join(outDir, 'run-meta.json'), JSON.stringify(meta, null, 2));

async function runCase(c) {
  const t0 = Date.now();
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Pacific/Honolulu' });
  const page = await context.newPage();
  const net = attachNetwork(page, t0);
  const steps = [];
  const pushStep = steps.push.bind(steps);
  steps.push = (s) => pushStep({ ...s, t_ms: Date.now() - t0 });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500));
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message || e).slice(0, 500)}`));
  const rec = { case_id: c.case_id, feature: c.feature, split: c.split, jurisdiction: c.jurisdiction, repeat: c.repeat, build, started: new Date(t0).toISOString() };
  if (c.feature === 'scan') rec.photo = c.image_file;
  else rec.query_typed = c.query;
  const work = (async () => {
    await pickPlace(page, baseUrl, c.jurisdiction, steps);
    if (c.feature === 'recyclopedia') {
      rec.path = await searchToItem(page, baseUrl, c.query, steps);
      rec.item = await readItemPage(page, net, steps);
    } else if (c.feature === 'locator') {
      rec.path = await searchToItem(page, baseUrl, c.query, steps);
      rec.item = await readItemPage(page, net, steps);
      const loc = await openLocatorFromItem(page, net, steps);
      rec.locator = loc ? { opened: true, ...loc } : { opened: false };
    } else {
      const s = await scanPhoto(page, baseUrl, net, c.image_path, steps, { fakeControlFile: opt['fake-photo-control'], photoId: c.photo_id });
      rec.scan = s;
      if (s.confirmed) rec.item = await readItemPage(page, net, steps, { since: s.ask_since });
    }
  })();
  let timer;
  try {
    await Promise.race([work, new Promise((_, rej) => (timer = setTimeout(() => rej(new DriveError('timeout', `case took longer than ${caseTimeout / 1000} s`)), caseTimeout)))]);
  } catch (e) {
    rec.error = { step: e.step || 'unexpected', message: String(e.message || e).slice(0, 1000) };
    try {
      rec.error_screen = await readScreen(page);
    } catch {
      /* the page may be gone */
    }
  } finally {
    clearTimeout(timer);
  }
  await net.flush();
  const shotDir = path.join(outDir, 'screens', c.feature);
  mkdirSync(shotDir, { recursive: true });
  const shot = path.join(shotDir, `${c.case_id}.r${c.repeat}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  rec.screenshot = path.relative(outDir, shot);
  rec.steps = steps;
  rec.network = net.records;
  rec.console_errors = consoleErrors;
  rec.duration_ms = Date.now() - t0;
  await context.close().catch(() => {});
  return rec;
}

let n = 0;
for (const c of work) {
  n++;
  const rec = await runCase(c);
  const dir = path.join(outDir, 'raw', c.feature);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${c.case_id}.r${c.repeat}.json`), JSON.stringify(rec, null, 2));
  const ask = rec.network.filter((r) => r.path === '/api/ask').pop();
  const line = {
    n,
    case_id: c.case_id,
    feature: c.feature,
    repeat: c.repeat,
    error: rec.error ? rec.error.message : null,
    behavior: ask?.response?.behavior ?? null,
    stream: ask?.response?.stream ?? null,
    identify: rec.scan?.identify_status ?? null,
    ms: rec.duration_ms,
  };
  appendFileSync(path.join(outDir, 'cases.jsonl'), JSON.stringify(line) + '\n');
  console.log(`[${n}/${work.length}] ${c.feature} ${c.case_id} r${c.repeat}: ${line.error ? 'DRIVE FAILURE ' + line.error : `${line.identify ? 'identify=' + line.identify + ' ' : ''}${line.behavior ?? 'no answer'}${line.stream ? ' ' + line.stream : ''}`} (${(rec.duration_ms / 1000).toFixed(1)} s)`);
}

meta.finished = new Date().toISOString();
writeFileSync(path.join(outDir, 'run-meta.json'), JSON.stringify(meta, null, 2));
await browser.close();
if (!existsSync(path.join(outDir, 'cases.jsonl'))) writeFileSync(path.join(outDir, 'cases.jsonl'), '');
console.log(`Done: ${work.length} case runs written to ${outDir}`);
