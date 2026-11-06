#!/usr/bin/env node
// Grades one build's raw harness output against the frozen keys. Deterministic; reads only files.
//
//   node harness/grade/grade.mjs --results <results dir of one build> --keys <frozen keys dir> \
//        --rules <engine/rules dir> --facilities <engine/data/facilities.csv> [--id-review <csv>]
//
// Writes <results>/grading/grades.csv, summary.json, summary.md and identification-review.csv.
// Definitions follow refcycle-eval/EVAL.md section 6 and the locked ship bar (section 7), plus the three
// scored-run measures in REVIEWER-BRIEF.md. Headline numbers use repeat 1.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import YAML from 'yaml';
import { loadAllKeys, verifyKeys } from '../lib/keys.mjs';
import { judgeIdentification } from './id-rules.mjs';

const STREAM_LABELS = { recycle_bin: 'Recycling', compost_bin: 'Compost', garbage: 'Garbage', drop_off_special: 'Special drop-off', deposit_return: 'Deposit return' };
const REGULAR = new Set(['recycle_bin', 'compost_bin', 'garbage']);
const NAMED_PLACE_KINDS = new Set(['site', 'event']);

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return out;
}
const opt = args(process.argv.slice(2));
for (const k of ['results', 'keys', 'rules', 'facilities']) if (!opt[k]) {
  console.error('Usage: grade.mjs --results <dir> --keys <dir> --rules <dir> --facilities <csv> [--id-review <csv>]');
  process.exit(2);
}

const check = verifyKeys(opt.keys);
if (!check.ok) {
  console.error('Key checksums do not match. Stopping.');
  process.exit(3);
}
const keys = loadAllKeys(opt.keys);
const keyById = new Map(Object.values(keys).flat().map((c) => [`${c.feature}/${c.case_id}`, c]));

// Packs, read-only, for citation validity.
const packs = new Map();
for (const f of readdirSync(opt.rules).filter((f) => f.endsWith('.yaml'))) {
  const p = YAML.parse(readFileSync(path.join(opt.rules, f), 'utf8'));
  packs.set(p.jurisdiction.id, new Map(p.rules.map((r) => [r.id, r])));
}
const facilities = parse(readFileSync(opt.facilities, 'utf8'), { columns: true, skip_empty_lines: true });
const linkedTo = (ruleIds) => new Set(facilities.filter((f) => f.rule_ids.split(';').map((s) => s.trim()).some((id) => ruleIds.includes(id))).map((f) => f.facility_id));

const idOverrides = new Map();
if (opt['id-review'] && existsSync(opt['id-review'])) {
  for (const r of parse(readFileSync(opt['id-review'], 'utf8'), { columns: true, skip_empty_lines: true })) {
    const v = String(r.human_verdict || '').trim().toLowerCase();
    if (v === 'correct' || v === 'wrong') idOverrides.set(`${r.case_id}.r${r.repeat}`, v);
  }
}

// ---------- raw records ----------
const raws = [];
for (const feature of ['recyclopedia', 'locator', 'scan']) {
  const dir = path.join(opt.results, 'raw', feature);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) raws.push(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
}
const meta = existsSync(path.join(opt.results, 'run-meta.json')) ? JSON.parse(readFileSync(path.join(opt.results, 'run-meta.json'), 'utf8')) : {};

const norm = (s) => String(s ?? '').replace(/[ʻ‘’'`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const displayed = (s) => norm(String(s ?? '').replace(/County of Hawai[ʻ‘’'`]?i/g, 'Hawaiʻi County').replace(/Big Island Biodiesel/g, 'a local biodiesel company'));

function lastAsk(rec, sinceMs = 0) {
  const asks = rec.network.filter((n) => n.path === '/api/ask' && n.t_ms >= sinceMs);
  return asks.length ? asks[asks.length - 1] : null;
}

/** EVAL.md 6.1, with clarify and conditional both counted as "does not commit" (brief). */
function behaviorCorrect(key, resp) {
  const E = key.expected_behavior;
  const acc = key.acceptable_streams || [];
  const b = resp.behavior;
  if (b === 'answer' && E.includes('answer')) return acc.includes(resp.stream);
  if (b === 'abstain' && E.includes('abstain')) return true;
  const open = E.includes('clarify') || E.includes('conditional');
  if (open && b === 'clarify') return true;
  if (open && b === 'conditional') {
    const got = new Set((resp.conditions || []).map((c) => c.stream));
    return acc.every((s) => got.has(s));
  }
  return false;
}

/** Answers whose rule_ids all exist in the place's pack and whose cited rules give the stream(s) returned. */
function citation(place, resp) {
  if (resp.behavior !== 'answer' && resp.behavior !== 'conditional') return null;
  const pack = packs.get(place);
  const rules = resp.rule_ids.map((id) => pack?.get(id));
  if (!rules.length || rules.some((r) => !r)) return { valid: false, reason: 'rule id not in pack' };
  const gives = new Set(rules.flatMap((r) => [r.stream, ...(r.conditions || []).map((c) => c.stream), ...(r.also_acceptable || [])]).filter(Boolean));
  const needed = resp.behavior === 'answer' ? [resp.stream] : (resp.conditions || []).map((c) => c.stream);
  const missing = needed.filter((s) => !gives.has(s));
  return missing.length ? { valid: false, reason: `no cited rule gives ${missing.join(', ')}` } : { valid: true };
}

/** Does the page show what the engine returned? Advisory; read from visible text only. */
function displayCheck(resp, screen) {
  if (!screen) return { ok: false, reason: 'no screen read' };
  const text = screen.text || '';
  const has = (l) => text.includes(l);
  if (resp.behavior === 'answer') return has(STREAM_LABELS[resp.stream]) ? { ok: true } : { ok: false, reason: `stream label "${STREAM_LABELS[resp.stream]}" not shown` };
  if (resp.behavior === 'abstain') return /don[’']?t know|do not know/i.test(text) ? { ok: true } : { ok: false, reason: '"we don\'t know" not shown' };
  if (resp.behavior === 'clarify') return displayed(text).includes(displayed(resp.clarifying_question)) ? { ok: true } : { ok: false, reason: 'clarifying question not shown' };
  const missing = (resp.conditions || []).filter((c) => !has(STREAM_LABELS[c.stream]));
  return missing.length ? { ok: false, reason: 'a conditional case stream not shown' } : { ok: true };
}

/** Whether each quoted source line of the engine explanation appears on the page (X-5). */
function explanationShown(resp, screen) {
  if (!screen || !resp.explanation) return null;
  const page = displayed(screen.text);
  const quotes = [...resp.explanation.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
  const parts = quotes.length ? quotes : [resp.explanation];
  return parts.every((q) => page.includes(norm(q)));
}

function responseOf(askRec) {
  if (!askRec) return { behavior: 'none', reason: 'no answer requested' };
  if (askRec.failed) return { behavior: 'error', reason: `request failed: ${askRec.failed}` };
  if (askRec.status !== 200 || !askRec.response || typeof askRec.response.behavior !== 'string') return { behavior: 'error', reason: `HTTP ${askRec.status}` };
  return askRec.response;
}

// ---------- per-case grades ----------
const grades = [];
for (const rec of raws) {
  const key = keyById.get(`${rec.feature}/${rec.case_id}`);
  if (!key) continue;
  const g = { case_id: rec.case_id, feature: rec.feature, split: rec.split, jurisdiction: rec.jurisdiction, repeat: rec.repeat, expected: key.expected_behavior.join(';') };
  g.drive_failure = rec.error ? `${rec.error.step}: ${rec.error.message}` : '';
  g.path = rec.path || '';
  if (rec.feature === 'scan') {
    const s = rec.scan || {};
    g.identify_status = s.identify_status ?? '';
    g.scan_label = s.identify_label ?? '';
    const auto = judgeIdentification(rec.case_id, s.identify_status, s.identify_label);
    const human = idOverrides.get(`${rec.case_id}.r${rec.repeat}`);
    g.id_auto = auto.verdict;
    g.id_reason = auto.reason;
    g.id_verdict = human || (auto.verdict === 'review' ? 'review' : auto.verdict);
    g.id_correct = g.id_verdict === 'correct';
    g.wrong_item_no_followup = s.identify_status === 'identified' && g.id_verdict === 'wrong';
    const followupExpected = /two items|unidentifiable/i.test(key.identification_expected);
    const askRec = s.confirmed ? lastAsk(rec, s.ask_since || 0) : null;
    if (!s.confirmed && (s.identify_status === 'multiple' || s.identify_status === 'unclear')) {
      g.behavior = 'scan_followup';
      g.correct = followupExpected;
      g.reason = followupExpected ? 'the scan asked, as the key expects' : 'the scan asked where the key expects an identified item';
    } else {
      const resp = responseOf(askRec);
      Object.assign(g, gradeAnswer(key, resp, rec));
    }
    g.overall_correct = g.id_correct && g.correct;
  } else {
    const resp = responseOf(lastAsk(rec));
    Object.assign(g, gradeAnswer(key, resp, rec));
    if (rec.feature === 'locator') Object.assign(g, gradeLocator(key, resp, rec, g));
  }
  if (g.drive_failure && !g.reason) g.reason = 'drive failure';
  grades.push(g);
}

function gradeAnswer(key, resp, rec) {
  const out = { behavior: resp.behavior, stream: resp.stream ?? '', conditions: (resp.conditions || []).map((c) => c.stream).join('|'), rule_ids: (resp.rule_ids || []).join(';'), model: resp.model ?? '' };
  if (resp.behavior === 'none' || resp.behavior === 'error') {
    out.correct = false;
    out.reason = resp.reason;
    return out;
  }
  out.query_sent = lastAsk(rec)?.request?.query ?? '';
  if (rec.feature === 'locator') {
    // The locator key has no stream column; the item answer is judged inside gradeLocator.
    out.correct = null;
  } else {
    out.correct = behaviorCorrect(key, resp);
    out.reason = out.correct ? '' : `got ${resp.behavior}${resp.stream ? ' ' + resp.stream : ''}${resp.conditions ? ' [' + out.conditions + ']' : ''}, key ${key.expected_behavior.join('/')} ${key.acceptable_streams.join('/')}`;
  }
  out.confident_wrong = resp.behavior === 'answer' && out.correct === false;
  const c = citation(rec.jurisdiction, resp);
  out.citation_valid = c ? c.valid : '';
  out.citation_note = c && !c.valid ? c.reason : '';
  out.expected_rule_cited = key.rule_ids_expected.length ? (resp.rule_ids || []).some((id) => key.rule_ids_expected.includes(id)) : '';
  const d = displayCheck(resp, rec.item?.screen);
  out.display_ok = d.ok;
  out.display_note = d.reason || '';
  out.explanation_shown = explanationShown(resp, rec.item?.screen);
  return out;
}

function gradeLocator(key, resp, rec, g) {
  const out = {};
  const loc = rec.locator || { opened: false };
  out.locator_opened = !!loc.opened;
  let sitesRec = null;
  if (loc.opened) {
    const s = rec.network.filter((n) => n.path === '/api/sites' && n.search.includes('rule_ids') && n.response && Array.isArray(n.response.sites));
    sitesRec = s.length ? s[s.length - 1] : null;
  }
  const screen = loc.screen;
  const pageText = displayed(screen?.text);
  const hrefs = new Set((screen?.anchors || []).map((a) => a.href));
  const shown = (sitesRec?.response.sites || []).filter((s) => pageText.includes(displayed(s.name)));
  out.sites_returned = (sitesRec?.response.sites || []).map((s) => s.facility_id).join(';');
  out.sites_shown = shown.map((s) => s.facility_id).join(';');
  const noSource = shown.filter((s) => !((s.source_url && hrefs.has(s.source_url)) || (s.source_label && pageText.includes(displayed(s.source_label)))));
  out.shown_without_source = noSource.map((s) => s.facility_id).join(';');
  out.shown_without_source_n = noSource.length;
  const exp = key.expected_behavior[0];
  const ids = shown.map((s) => s.facility_id);
  const named = shown.filter((s) => NAMED_PLACE_KINDS.has(s.kind));
  const b = resp.behavior;
  let ok = false;
  let reason = '';
  if (b === 'none' || b === 'error') reason = resp.reason;
  else if (exp === 'facilities' || exp === 'conditional') {
    const want = key.facility_ids_expected;
    const allowed = new Set([...want, ...linkedTo(key.rule_ids_expected)]);
    const missing = want.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !allowed.has(id));
    const behaviorOk = exp === 'conditional' ? b === 'conditional' || b === 'clarify' : b === 'answer' || b === 'conditional';
    ok = behaviorOk && !missing.length && !extra.length;
    out.strict_exact = behaviorOk && !missing.length && ids.length === want.length;
    reason = ok ? '' : !behaviorOk ? `item answer ${b}` : !loc.opened ? 'locator not reachable from the item page' : `${missing.length ? 'missing ' + missing.join(',') : ''}${extra.length ? ' extra ' + extra.join(',') : ''}`.trim();
  } else if (exp === 'none_listed') {
    ok = (b === 'answer' || b === 'conditional') && named.length === 0;
    reason = ok ? '' : b !== 'answer' && b !== 'conditional' ? `item answer ${b}` : `named places shown: ${named.map((s) => s.facility_id).join(',')}`;
  } else if (exp === 'curbside') {
    const regular = b === 'answer' && REGULAR.has(resp.stream);
    const onlyHowTo = (b === 'answer' || b === 'conditional') && shown.length > 0 && shown.every((s) => s.kind === 'how_to');
    ok = (regular || onlyHowTo) && named.length === 0;
    reason = ok ? '' : `item answer ${b}${resp.stream ? ' ' + resp.stream : ''}; shown ${ids.join(',') || 'none'}`;
  } else if (exp === 'abstain') {
    ok = b === 'abstain' && shown.length === 0;
    reason = ok ? '' : `item answer ${b}; shown ${ids.join(',') || 'none'}`;
  }
  out.correct = ok;
  out.reason = reason;
  out.confident_wrong = b === 'answer' && !ok;
  out.wrong_sites_shown = !ok && named.length > 0;
  return out;
}

// ---------- metrics ----------
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}% (${n} of ${d})` : `n/a (0 of 0)`);
const rate = (n, d) => (d ? n / d : null);

function answerMetrics(rows, keysFor) {
  const k = (g) => keysFor(g);
  const E = (g) => k(g).expected_behavior;
  const answerable = rows.filter((g) => E(g).includes('answer'));
  const abstainCases = rows.filter((g) => E(g).length === 1 && E(g)[0] === 'abstain');
  const notAbstain = rows.filter((g) => !E(g).includes('abstain'));
  const openCases = rows.filter((g) => !E(g).includes('answer') && (E(g).includes('clarify') || E(g).includes('conditional')));
  const cited = rows.filter((g) => g.citation_valid === true || g.citation_valid === false);
  const answers = rows.filter((g) => g.behavior === 'answer');
  return {
    cases: rows.length,
    drive_failures: rows.filter((g) => g.drive_failure).length,
    confident_wrong: [rows.filter((g) => g.confident_wrong).length, rows.length],
    accuracy_answerable: [answerable.filter((g) => g.correct).length, answerable.length],
    accuracy_all: [rows.filter((g) => g.correct).length, rows.length],
    abstention_recall: [abstainCases.filter((g) => g.behavior === 'abstain').length, abstainCases.length],
    over_abstention: [notAbstain.filter((g) => g.behavior === 'abstain').length, notAbstain.length],
    conditional_handling: [openCases.filter((g) => g.correct).length, openCases.length],
    citation_validity: [cited.filter((g) => g.citation_valid === true).length, cited.length],
    display_mismatch: [rows.filter((g) => g.display_ok === false).length, rows.filter((g) => g.display_ok === true || g.display_ok === false).length],
    explanation_not_shown: [rows.filter((g) => g.explanation_shown === false).length, rows.filter((g) => g.explanation_shown === true || g.explanation_shown === false).length],
    answers: answers.length,
  };
}

const keyFor = (g) => keyById.get(`${g.feature}/${g.case_id}`);
const summary = { build: meta.build, run: meta, keys_check_ok: check.ok, models_seen: [...new Set(grades.map((g) => g.model).filter(Boolean))], by_split: {} };
const headline = grades.filter((g) => g.repeat === 1);
for (const split of ['test', 'held_out', 'practice']) {
  const rows = headline.filter((g) => g.split === split);
  if (!rows.length) continue;
  const rp = rows.filter((g) => g.feature === 'recyclopedia');
  const lc = rows.filter((g) => g.feature === 'locator');
  const sc = rows.filter((g) => g.feature === 'scan');
  const scRouted = sc.filter((g) => g.behavior !== 'scan_followup');
  summary.by_split[split] = {
    recyclopedia: answerMetrics(rp, keyFor),
    locator: {
      cases: lc.length,
      drive_failures: lc.filter((g) => g.drive_failure).length,
      accuracy: [lc.filter((g) => g.correct).length, lc.length],
      strict_exact_facilities: [lc.filter((g) => g.strict_exact).length, lc.filter((g) => g.strict_exact !== undefined).length],
      facilities_shown_without_source: lc.reduce((n, g) => n + (g.shown_without_source_n || 0), 0),
      facilities_shown: lc.reduce((n, g) => n + (g.sites_shown ? g.sites_shown.split(';').length : 0), 0),
      wrong_named_sites_shown: [lc.filter((g) => g.wrong_sites_shown).length, lc.length],
      confident_wrong_item_answer: [lc.filter((g) => g.confident_wrong).length, lc.length],
    },
    scan: {
      cases: sc.length,
      drive_failures: sc.filter((g) => g.drive_failure).length,
      identification_correct: [sc.filter((g) => g.id_correct).length, sc.length],
      identification_needs_review: sc.filter((g) => g.id_verdict === 'review').length,
      wrong_item_no_followup: [sc.filter((g) => g.wrong_item_no_followup).length, sc.length],
      routed_answer: answerMetrics(sc, keyFor),
      routed_without_followup: scRouted.length,
      overall_correct: [sc.filter((g) => g.overall_correct).length, sc.length],
    },
  };
  const both = [...rp, ...sc];
  summary.by_split[split].recyclopedia_and_scan = { confident_wrong: [both.filter((g) => g.confident_wrong).length, both.length] };
}

// Stability when the run had repeats: same behavior and stream on every repeat.
const reps = Math.max(...grades.map((g) => g.repeat), 1);
if (reps > 1) {
  const byCase = new Map();
  for (const g of grades) {
    const k = `${g.feature}/${g.case_id}`;
    if (!byCase.has(k)) byCase.set(k, []);
    byCase.get(k).push(`${g.behavior}|${g.stream}|${g.identify_status ?? ''}`);
  }
  summary.stability = {};
  for (const split of ['test', 'held_out', 'practice']) {
    const ks = [...byCase.keys()].filter((k) => keyById.get(k)?.split === split);
    if (ks.length) summary.stability[split] = [ks.filter((k) => new Set(byCase.get(k)).size === 1).length, ks.length];
  }
}

// ---------- output ----------
const outDir = path.join(opt.results, 'grading');
mkdirSync(outDir, { recursive: true });
const cols = ['case_id', 'feature', 'split', 'jurisdiction', 'repeat', 'expected', 'path', 'query_sent', 'identify_status', 'scan_label', 'id_auto', 'id_verdict', 'id_reason', 'wrong_item_no_followup', 'behavior', 'stream', 'conditions', 'rule_ids', 'correct', 'overall_correct', 'confident_wrong', 'reason', 'citation_valid', 'citation_note', 'expected_rule_cited', 'display_ok', 'display_note', 'explanation_shown', 'locator_opened', 'sites_returned', 'sites_shown', 'strict_exact', 'shown_without_source', 'drive_failure', 'model'];
const csv = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
writeFileSync(path.join(outDir, 'grades.csv'), [cols.join(','), ...grades.map((g) => cols.map((c) => csv(g[c])).join(','))].join('\n') + '\n');
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

const idCols = ['case_id', 'repeat', 'split', 'jurisdiction', 'identification_expected', 'identify_status', 'scan_label', 'auto_verdict', 'auto_reason', 'human_verdict'];
const idRows = grades.filter((g) => g.feature === 'scan').map((g) => ({ ...g, identification_expected: keyFor(g).identification_expected, auto_verdict: g.id_auto, auto_reason: g.id_reason, human_verdict: idOverrides.get(`${g.case_id}.r${g.repeat}`) || '' }));
writeFileSync(path.join(outDir, 'identification-review.csv'), [idCols.join(','), ...idRows.map((g) => idCols.map((c) => csv(g[c])).join(','))].join('\n') + '\n');

const f = (a) => (Array.isArray(a) ? pct(a[0], a[1]) : String(a));
const bar = (a, target, lower) => {
  if (!Array.isArray(a) || !a[1]) return 'n/a';
  const r = a[0] / a[1];
  return (lower ? r <= target : r >= target) ? 'meets' : 'misses';
};
let md = `# Grading: ${summary.build}\n\nBuild ${meta.build_dir || ''} at ${meta.build_head || 'unknown head'}; run ${meta.started || ''} to ${meta.finished || ''}; keys checksums ${check.ok ? 'OK' : 'FAILED'}.\nModels seen in /api/ask responses: ${summary.models_seen.join(', ') || 'none'}.\nHeadline numbers use repeat 1. Counts beside every percentage; a gap of one or two cases between builds is not a finding.\n`;
for (const [split, s] of Object.entries(summary.by_split)) {
  const r = s.recyclopedia;
  const sc = s.scan;
  const l = s.locator;
  md += `\n## ${split}\n\n### Recyclopedia (${r.cases} cases, ${r.drive_failures} drive failures)\n\n| Metric | Result | Target | |\n|---|---|---|---|\n`;
  md += `| Confident-wrong | ${f(r.confident_wrong)} | 2% or less | ${bar(r.confident_wrong, 0.02, true)} |\n| Accuracy, answerable | ${f(r.accuracy_answerable)} | 90% or more | ${bar(r.accuracy_answerable, 0.9)} |\n| Abstention recall | ${f(r.abstention_recall)} | 80% or more | ${bar(r.abstention_recall, 0.8)} |\n| Over-abstention | ${f(r.over_abstention)} | 10% or less | ${bar(r.over_abstention, 0.1, true)} |\n| Citation validity | ${f(r.citation_validity)} | 95% or more | ${bar(r.citation_validity, 0.95)} |\n| Conditional handling | ${f(r.conditional_handling)} | none | |\n| Accuracy, all cases | ${f(r.accuracy_all)} | none | |\n| Page did not show the engine's verdict | ${f(r.display_mismatch)} | none | |\n| Page did not show the quoted rule text | ${f(r.explanation_not_shown)} | none | |\n`;
  md += `\n### Locator (${l.cases} cases, ${l.drive_failures} drive failures)\n\n| Metric | Result | Target | |\n|---|---|---|---|\n| Accuracy | ${f(l.accuracy)} | none | |\n| Facilities shown with no source | ${l.facilities_shown_without_source} of ${l.facilities_shown} shown | 0 | ${l.facilities_shown_without_source === 0 ? 'meets' : 'misses'} |\n| Wrong named sites shown | ${f(l.wrong_named_sites_shown)} | none | |\n| Exact facility set (strict) | ${f(l.strict_exact_facilities)} | none | |\n| Item answer committed and wrong | ${f(l.confident_wrong_item_answer)} | none | |\n`;
  const ra = sc.routed_answer;
  md += `\n### Camera scan (${sc.cases} cases, ${sc.drive_failures} drive failures)\n\n| Metric | Result | Target | |\n|---|---|---|---|\n| Wrong item identified, no follow-up | ${f(sc.wrong_item_no_followup)} | 2% or less | ${bar(sc.wrong_item_no_followup, 0.02, true)} |\n| Identification correct | ${f(sc.identification_correct)} (${sc.identification_needs_review} need review) | none | |\n| Routed answer: confident-wrong | ${f(ra.confident_wrong)} | 2% or less | ${bar(ra.confident_wrong, 0.02, true)} |\n| Routed answer: accuracy, answerable | ${f(ra.accuracy_answerable)} | 90% or more | ${bar(ra.accuracy_answerable, 0.9)} |\n| Routed answer: abstention recall | ${f(ra.abstention_recall)} | 80% or more | ${bar(ra.abstention_recall, 0.8)} |\n| Routed answer: over-abstention | ${f(ra.over_abstention)} | 10% or less | ${bar(ra.over_abstention, 0.1, true)} |\n| Routed answer: citation validity | ${f(ra.citation_validity)} | 95% or more | ${bar(ra.citation_validity, 0.95)} |\n| Identification and routed answer both correct | ${f(sc.overall_correct)} | none | |\n`;
  md += `\nConfident-wrong, Recyclopedia and Camera scan together: ${f(s.recyclopedia_and_scan.confident_wrong)}.\n`;
  const misses = headline.filter((g) => g.split === split && (g.correct === false || g.overall_correct === false || g.drive_failure));
  if (misses.length) {
    md += `\n#### Cases not correct\n\n| Case | Feature | Reason |\n|---|---|---|\n`;
    for (const g of misses) md += `| ${g.case_id} | ${g.feature} | ${[g.drive_failure ? 'DRIVE FAILURE ' + g.drive_failure : '', g.reason, g.feature === 'scan' && !g.id_correct ? 'identification ' + g.id_verdict + ': ' + g.id_reason + (g.scan_label ? ` ("${g.scan_label}")` : '') : ''].filter(Boolean).join('; ').replace(/\|/g, '/')} |\n`;
  }
}
if (summary.stability) md += `\n## Stability across repeats\n\n${Object.entries(summary.stability).map(([s, a]) => `- ${s}: ${f(a)}`).join('\n')}\n`;
md += `\nInvented rules are graded blind after both builds run (harness/grade/blind-export.mjs); contract breaks come from the orchestrator's merge log.\n`;
writeFileSync(path.join(outDir, 'summary.md'), md);
console.log(md);
