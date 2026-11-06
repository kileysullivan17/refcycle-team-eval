// Loads the frozen answer keys and checks them against SHA256SUMS.txt before anything uses them.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

export const KEY_FILES = {
  recyclopedia: 'recyclopedia.key.csv',
  locator: 'locator.key.csv',
  scan: 'camera-scan.key.csv',
};

export const PLACE_IDS = ['seattle_wa', 'austin_tx', 'hawaii_county_hi'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Verifies every line of SHA256SUMS.txt. The photos line is the hash of ph01.png to ph36.png concatenated in
 * name order. Returns { ok, lines: [{ name, expected, actual, ok }] }.
 */
export function verifyKeys(keysDir) {
  const sumsPath = path.join(keysDir, 'SHA256SUMS.txt');
  if (!existsSync(sumsPath)) return { ok: false, lines: [{ name: 'SHA256SUMS.txt', ok: false, note: 'missing' }] };
  const lines = [];
  for (const raw of readFileSync(sumsPath, 'utf8').split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+(.+)$/.exec(raw.trim());
    if (!m) continue;
    const [, expected, name] = m;
    let actual = null;
    if (name.startsWith('photos')) {
      const dir = path.join(keysDir, 'photos');
      const files = readdirSync(dir).filter((f) => /^ph\d+\.png$/.test(f)).sort();
      const count = Number((/\((\d+) files/.exec(name) || [])[1] || files.length);
      if (files.length === count) actual = sha256(Buffer.concat(files.map((f) => readFileSync(path.join(dir, f)))));
      lines.push({ name, expected, actual, ok: actual === expected, files: files.length });
    } else {
      const file = path.join(keysDir, name);
      actual = existsSync(file) ? sha256(readFileSync(file)) : null;
      lines.push({ name, expected, actual, ok: actual === expected });
    }
  }
  const names = lines.map((l) => l.name);
  const complete = Object.values(KEY_FILES).every((f) => names.includes(f)) && names.some((n) => n.startsWith('photos'));
  return { ok: complete && lines.every((l) => l.ok), lines };
}

const split = (v) => String(v ?? '').split(';').map((s) => s.trim()).filter(Boolean);

/** Reads one key into normalized case objects. */
export function loadKey(keysDir, feature) {
  const rows = parse(readFileSync(path.join(keysDir, KEY_FILES[feature]), 'utf8'), { columns: true, skip_empty_lines: true });
  return rows.map((r) => {
    const base = {
      feature,
      split: r.split,
      jurisdiction: r.jurisdiction,
      expected_behavior: split(r.expected_behavior),
      rule_ids_expected: split(r.rule_ids_expected),
      notes: r.notes ?? '',
    };
    if (feature === 'recyclopedia') return { ...base, case_id: r.case_id, query: r.query, acceptable_streams: split(r.acceptable_streams), material_page: r.material_page };
    if (feature === 'locator') return { ...base, case_id: r.case_id, query: r.query, facility_ids_expected: split(r.facility_ids_expected) };
    return {
      ...base,
      case_id: r.photo_id,
      photo_id: r.photo_id,
      image_file: r.image_file,
      image_path: path.join(keysDir, 'photos', r.image_file),
      item_shown: r.item_shown,
      identification_expected: r.identification_expected,
      acceptable_streams: split(r.acceptable_streams),
    };
  });
}

export function loadAllKeys(keysDir) {
  return { recyclopedia: loadKey(keysDir, 'recyclopedia'), locator: loadKey(keysDir, 'locator'), scan: loadKey(keysDir, 'scan') };
}
