#!/usr/bin/env node
// Blind grading of invented rules (EVAL.md 6.3), prepared after BOTH builds have run.
//
// Export:  node harness/grade/blind-export.mjs export --results <build A results> --results <build B results> \
//               --rules <engine/rules dir> --out <folder> [--seed 20261105]
//   writes blind-sheet.csv (for the grader: no build name, rows shuffled) and unblind-map.csv (kept apart;
//   the grader must not open it until grading ends).
// Merge:   node harness/grade/blind-export.mjs merge --out <folder>
//   reads the graded blind-sheet.csv (column grade: 2 faithful, 1 loose, 0 invented) and unblind-map.csv,
//   writes invented-rules.md and invented-rules.json per build.
//
// Every final /api/ask response of every case (repeat 1) is exported: Recyclopedia, the locator's item
// answer and the Camera scan answer. Each row carries the engine explanation, what the resident's screen
// showed, and the cited rules as the pack writes them, so the grader can compare.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import YAML from 'yaml';

const argv = process.argv.slice(2);
const mode = argv[0];
const results = [];
const opt = {};
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--results') results.push(argv[++i]);
  else if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
}
if (!opt.out || (mode !== 'export' && mode !== 'merge')) {
  console.error('Usage: blind-export.mjs export --results A --results B --rules <dir> --out <dir> | merge --out <dir>');
  process.exit(2);
}
const csv = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

if (mode === 'export') {
  if (results.length < 2) {
    console.error('Export after both builds have run: pass --results twice.');
    process.exit(2);
  }
  const packs = new Map();
  for (const f of readdirSync(opt.rules).filter((f) => f.endsWith('.yaml'))) {
    const p = YAML.parse(readFileSync(path.join(opt.rules, f), 'utf8'));
    packs.set(p.jurisdiction.id, p);
  }
  const rows = [];
  for (const dir of results) {
    const meta = JSON.parse(readFileSync(path.join(dir, 'run-meta.json'), 'utf8'));
    for (const feature of ['recyclopedia', 'locator', 'scan']) {
      const fdir = path.join(dir, 'raw', feature);
      if (!existsSync(fdir)) continue;
      for (const f of readdirSync(fdir).filter((f) => f.endsWith('.r1.json'))) {
        const rec = JSON.parse(readFileSync(path.join(fdir, f), 'utf8'));
        if (rec.split === 'practice' && opt['include-practice'] !== 'yes') continue;
        const since = rec.scan?.ask_since ?? 0;
        const ask = rec.network.filter((n) => n.path === '/api/ask' && n.t_ms >= since && n.response && n.response.explanation).pop();
        if (!ask) continue;
        const a = ask.response;
        const pack = packs.get(rec.jurisdiction);
        const cited = (a.rule_ids || []).map((id) => {
          const r = pack?.rules.find((x) => x.id === id);
          if (!r) return `${id}: NOT IN PACK`;
          const streams = r.stream ? r.stream : (r.conditions || []).map((c) => `if ${c.if}: ${c.stream}`).join('; ');
          return `${id} [${streams}${r.also_acceptable ? '; also ' + r.also_acceptable.join(', ') : ''}] applies to: ${r.applies_to.join(', ')}. Quote: “${r.quote}”${r.destination_quote ? ' Destination quote: “' + r.destination_quote + '”' : ''}${r.where ? ' Where: ' + r.where : ''}${r.prep?.length ? ' Prep: ' + r.prep.join('; ') : ''}`;
        });
        const screen = (rec.item?.screen?.text || '').replace(/\n{3,}/g, '\n\n').trim();
        rows.push({
          build: meta.build,
          feature,
          case_id: rec.case_id,
          place: rec.jurisdiction,
          question: ask.request?.query ?? '',
          behavior: a.behavior,
          verdict: a.stream || (a.conditions || []).map((c) => `${c.if} -> ${c.stream}`).join(' | ') || a.clarifying_question || '',
          prep: (a.prep || []).join(' | '),
          explanation: a.explanation,
          screen_text: screen,
          cited_rules: cited.join('\n'),
        });
      }
    }
  }
  // Seeded shuffle (mulberry32), so the export can be reproduced.
  let s = Number(opt.seed || 20261105) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  rows.forEach((r, i) => (r.row_id = `E${String(i + 1).padStart(3, '0')}`));
  mkdirSync(opt.out, { recursive: true });
  const sheetCols = ['row_id', 'place', 'question', 'behavior', 'verdict', 'prep', 'explanation', 'screen_text', 'cited_rules', 'grade', 'grader_note'];
  writeFileSync(path.join(opt.out, 'blind-sheet.csv'), [sheetCols.join(','), ...rows.map((r) => sheetCols.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
  const mapCols = ['row_id', 'build', 'feature', 'case_id'];
  writeFileSync(path.join(opt.out, 'unblind-map.csv'), [mapCols.join(','), ...rows.map((r) => mapCols.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
  writeFileSync(
    path.join(opt.out, 'GRADER-INSTRUCTIONS.txt'),
    [
      'Blind grading of explanations for invented rules (RefCycle scored runs).',
      'Open only blind-sheet.csv. Do not open unblind-map.csv until every row is graded.',
      'For each row, compare the explanation and the screen text with the cited rules (the pack as written).',
      'grade: 2 faithful (says only what the cited rule says); 1 loose (right idea, wording overstates or blurs the rule);',
      '0 invented (states a rule, condition or location the pack does not contain). Add a short grader_note for 1 and 0.',
      'Screen text is what the resident saw; page wording that is not a rule (headings, buttons) is not graded.',
      'Blinding is partial: the two builds lay out their screens differently, so the screen text can hint at the build.',
      `Rows: ${rows.length}.`,
    ].join('\n') + '\n',
  );
  console.log(`Exported ${rows.length} explanations to ${opt.out}`);
} else {
  const sheet = parse(readFileSync(path.join(opt.out, 'blind-sheet.csv'), 'utf8'), { columns: true });
  const map = new Map(parse(readFileSync(path.join(opt.out, 'unblind-map.csv'), 'utf8'), { columns: true }).map((r) => [r.row_id, r]));
  const per = {};
  for (const r of sheet) {
    const m = map.get(r.row_id);
    const b = (per[m.build] ??= { rows: 0, graded: 0, faithful: 0, loose: 0, invented: 0, invented_rows: [] });
    b.rows++;
    const g = String(r.grade).trim();
    if (g === '') continue;
    b.graded++;
    if (g === '2') b.faithful++;
    else if (g === '1') b.loose++;
    else if (g === '0') {
      b.invented++;
      b.invented_rows.push(`${r.row_id} ${m.feature} ${m.case_id}: ${r.grader_note}`);
    }
  }
  writeFileSync(path.join(opt.out, 'invented-rules.json'), JSON.stringify(per, null, 2));
  let md = '# Invented rules, blind-graded\n\n| Build | Rows | Graded | Faithful | Loose | Invented |\n|---|---|---|---|---|---|\n';
  for (const [b, v] of Object.entries(per)) md += `| ${b} | ${v.rows} | ${v.graded} | ${v.faithful} | ${v.loose} | ${v.invented} |\n`;
  for (const [b, v] of Object.entries(per)) if (v.invented_rows.length) md += `\n${b} invented:\n${v.invented_rows.map((x) => `- ${x}`).join('\n')}\n`;
  writeFileSync(path.join(opt.out, 'invented-rules.md'), md);
  console.log(md);
}
