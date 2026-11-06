import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ImageProvider } from '../../src/features/camera-scan/types.ts';
import { MAX_IMAGE_BYTES } from '../../src/features/camera-scan/image.ts';
import { dataUrl, makeGif, makeJpeg, makePng, makeWebp, post, startServer, tmpDir } from './helpers.ts';

function fake(value: unknown, model = 'fake/model-1'): ImageProvider & { calls: number; repairs: boolean[] } {
  const p = {
    model, calls: 0, repairs: [] as boolean[],
    async identify(_i: unknown, repair?: boolean) { p.calls++; p.repairs.push(!!repair); return { value, model }; },
  };
  return p as any;
}
const png = dataUrl('image/png', makePng());

test('rejects non-JSON content type, bad JSON, extra keys and missing image with 400', async () => {
  const p = fake({ status: 'unclear' });
  const s = await startServer({ getProvider: () => p, logDir: tmpDir() });
  try {
    for (const [body, type] of [[{ image: png }, 'text/plain'], ['{not json', 'application/json'], [{ image: png, extra: 1 }, 'application/json'], [{}, 'application/json'], [{ image: 5 }, 'application/json']] as const) {
      const r = await post(s.base, body, type);
      assert.equal(r.status, 400);
      assert.equal(typeof r.json.error, 'string');
    }
    assert.equal(p.calls, 0);
  } finally { await s.close(); }
});

test('rejects non-image, GIF, mismatched bytes and over-5MB images with 400 and never calls the provider', async () => {
  const p = fake({ status: 'unclear' });
  const s = await startServer({ getProvider: () => p, logDir: tmpDir() });
  try {
    const big = Buffer.concat([makePng(), Buffer.alloc(MAX_IMAGE_BYTES)]);
    const cases: unknown[] = [
      'not a data url',
      'data:text/plain;base64,aGVsbG8=',
      dataUrl('image/gif', makeGif()),
      dataUrl('image/jpeg', makePng()),
      dataUrl('image/png', makeJpeg()),
      dataUrl('image/webp', makePng()),
      dataUrl('image/png', Buffer.from('this is plain text, not an image at all')),
      dataUrl('image/png', big),
      'data:image/png;base64,',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    ];
    for (const image of cases) {
      const r = await post(s.base, { image });
      assert.equal(r.status, 400, String(image).slice(0, 40));
      assert.deepEqual(Object.keys(r.json), ['error']);
    }
    assert.equal(p.calls, 0);
  } finally { await s.close(); }
});

test('a body far over the limit is refused with 400', async () => {
  const s = await startServer({ getProvider: () => fake({}), logDir: tmpDir() });
  try {
    const r = await post(s.base, JSON.stringify({ image: 'data:image/png;base64,' + 'A'.repeat(9 * 1024 * 1024) }));
    assert.equal(r.status, 400);
    assert.ok(r.json.error);
  } finally { await s.close(); }
});

test('accepts JPEG, PNG and WebP exactly at the leading-byte check', async () => {
  const p = fake({ status: 'identified', label: 'glass jar' });
  const s = await startServer({ getProvider: () => p, logDir: tmpDir() });
  try {
    for (const [t, b] of [['image/jpeg', makeJpeg()], ['image/png', makePng()], ['image/webp', makeWebp()]] as const) {
      const r = await post(s.base, { image: dataUrl(t, b) });
      assert.equal(r.status, 200);
    }
  } finally { await s.close(); }
});

test('response holds exactly status, label, candidates, model', async () => {
  const p = fake({ status: 'identified', label: 'plastic milk jug', candidates: [], stream: 'recycle_bin', verdict: 'recyclable', advice: 'Rinse and put in the blue bin', extra: { a: 1 } });
  const s = await startServer({ getProvider: () => p, logDir: tmpDir() });
  try {
    const r = await post(s.base, { image: png });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['candidates', 'label', 'model', 'status']);
    assert.deepEqual(r.json, { status: 'identified', label: 'plastic milk jug', candidates: [], model: 'fake/model-1' });
  } finally { await s.close(); }
});

test('verdict or disposal text inside a label is removed', async () => {
  const s = await startServer({ getProvider: () => fake({ status: 'identified', label: 'plastic milk jug, recyclable in the blue bin' }), logDir: tmpDir() });
  try {
    const r = await post(s.base, { image: png });
    assert.equal(r.json.label, 'plastic milk jug');
  } finally { await s.close(); }
});

test('multiple returns up to 4 candidates and a null label', async () => {
  const value = { status: 'multiple', label: 'bottle and can', candidates: ['glass bottle', 'soda can', 'paper bag', 'plastic cup', 'tin foil', 'glass bottle'] };
  const s = await startServer({ getProvider: () => fake(value), logDir: tmpDir() });
  try {
    const r = await post(s.base, { image: png });
    assert.equal(r.json.status, 'multiple');
    assert.equal(r.json.label, null);
    assert.deepEqual(r.json.candidates, ['glass bottle', 'soda can', 'paper bag', 'plastic cup']);
  } finally { await s.close(); }
});

test('unclear, malformed and unknown-status replies all become unclear with no label', async () => {
  for (const value of [{ status: 'unclear' }, null, 'text', [1], { status: 'banana', label: 'jar' }, { label: 'jar' }, { status: 'identified' }, { status: 'identified', label: 42 }]) {
    const s = await startServer({ getProvider: () => fake(value), logDir: tmpDir() });
    try {
      const r = await post(s.base, { image: png });
      assert.equal(r.status, 200);
      assert.equal(r.json.status, 'unclear');
      assert.equal(r.json.label, null);
      assert.deepEqual(r.json.candidates, []);
    } finally { await s.close(); }
  }
});

test('a brand-only label triggers one re-ask, then unclear', async () => {
  const p = fake({ status: 'identified', label: 'Coca-Cola' });
  const s = await startServer({ getProvider: () => p, logDir: tmpDir() });
  try {
    const r = await post(s.base, { image: png });
    assert.equal(r.json.status, 'unclear');
    assert.equal(p.calls, 2);
    assert.deepEqual(p.repairs, [false, true]);
  } finally { await s.close(); }
});

test('provider failure and missing configuration give 502 with an error body', async () => {
  const bad: ImageProvider = { model: 'x/y', async identify() { throw new Error('secret provider detail sk-123'); } };
  const s1 = await startServer({ getProvider: () => bad, logDir: tmpDir() });
  const s2 = await startServer({ getProvider: () => { throw new Error('no key'); }, logDir: tmpDir() });
  try {
    for (const s of [s1, s2]) {
      const r = await post(s.base, { image: png });
      assert.equal(r.status, 502);
      assert.deepEqual(Object.keys(r.json), ['error']);
      assert.ok(!JSON.stringify(r.json).includes('sk-123'));
    }
  } finally { await s1.close(); await s2.close(); }
});

test('other methods and paths are not handled', async () => {
  const s = await startServer({ getProvider: () => fake({}), logDir: tmpDir() });
  try {
    assert.equal((await fetch(s.base + '/api/identify')).status, 404);
    assert.equal((await fetch(s.base + '/api/other', { method: 'POST' })).status, 404);
  } finally { await s.close(); }
});

test('log lines hold only time, status, label, model, duration; no image data', async () => {
  const dir = tmpDir();
  const s = await startServer({ getProvider: () => fake({ status: 'identified', label: 'glass jar' }), logDir: dir });
  try {
    await post(s.base, { image: png });
    await post(s.base, { image: 'nope' });
    const lines = readFileSync(path.join(dir, 'identify.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ['duration_ms', 'label', 'model', 'status', 'time']);
    assert.equal(lines[0].label, 'glass jar');
    assert.equal(lines[0].model, 'fake/model-1');
    const all = readFileSync(path.join(dir, 'identify.jsonl'), 'utf8');
    assert.ok(!all.includes('base64') && !all.includes(makePng().toString('base64').slice(0, 20)));
    assert.deepEqual(readdirSync(dir), ['identify.jsonl']);
    assert.ok(!existsSync(path.join(dir, 'images')));
  } finally { await s.close(); }
});
