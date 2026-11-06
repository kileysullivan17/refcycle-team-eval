import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  createRemoteImageProvider,
  decodeImage,
  IDENTIFY_INSTRUCTIONS,
  normalizeIdentification,
  readImageConfig,
  type DecodedImage,
  type ImageProvider,
} from '../../src/features/camera-scan/identify.ts';
import { createHandle } from '../../src/features/camera-scan/routes.ts';
import { startApp, type TestApp } from '../helpers/app.ts';
import { dataUrl, JPEG_BYTES, PNG_BYTES, WEBP_BYTES } from '../helpers/images.ts';

describe('decodeImage', () => {
  it('accepts JPEG, PNG and WebP', () => {
    assert.equal(decodeImage(dataUrl('jpeg', JPEG_BYTES)).mediaType, 'image/jpeg');
    assert.equal(decodeImage(dataUrl('png', PNG_BYTES)).mediaType, 'image/png');
    assert.equal(decodeImage(dataUrl('webp', WEBP_BYTES)).mediaType, 'image/webp');
  });
  it('rejects other types, bad bytes, empty and non-string values', () => {
    assert.throws(() => decodeImage(dataUrl('gif', Buffer.from('GIF89a'))));
    assert.throws(() => decodeImage(dataUrl('png', JPEG_BYTES)), /do not match/);
    assert.throws(() => decodeImage('data:image/png;base64,'));
    assert.throws(() => decodeImage(42));
    assert.throws(() => decodeImage('https://example.org/a.png'));
  });
  it('rejects an image over 5 MB and accepts one at the limit', () => {
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024 - JPEG_BYTES.length + 1)]);
    assert.throws(() => decodeImage(dataUrl('jpeg', big)), /5 MB/);
    const ok = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024 - JPEG_BYTES.length)]);
    assert.doesNotThrow(() => decodeImage(dataUrl('jpeg', ok)));
  });
});

describe('normalizeIdentification', () => {
  it('keeps only status, label and candidates (CS-4)', () => {
    const r = normalizeIdentification({ status: 'identified', label: ' plastic   milk jug ', candidates: ['x'], stream: 'recycle_bin', verdict: 'recyclable', advice: 'rinse' });
    assert.deepEqual(r, { status: 'identified', label: 'plastic milk jug', candidates: [] });
    assert.ok(!('stream' in r));
  });
  it('turns an identified result with no usable label into unclear', () => {
    assert.equal(normalizeIdentification({ status: 'identified', label: '  ' }).status, 'unclear');
    assert.equal(normalizeIdentification({ status: 'identified', label: 'x'.repeat(121) }).status, 'unclear');
  });
  it('limits multiple to 4 distinct generic names', () => {
    const r = normalizeIdentification({ status: 'multiple', label: 'ignored', candidates: ['a', 'b', 'a', 'c', 'd', 'e', 5, ''] });
    assert.deepEqual(r, { status: 'multiple', label: null, candidates: ['a', 'b', 'c', 'd'] });
  });
  it('throws on an unreadable value', () => {
    assert.throws(() => normalizeIdentification(null));
    assert.throws(() => normalizeIdentification({ status: 'maybe' }));
  });
});

describe('readImageConfig', () => {
  it('defaults to anthropic and claude-sonnet-5-5 and needs the matching key', () => {
    assert.equal(readImageConfig({}), null);
    assert.deepEqual(readImageConfig({ ANTHROPIC_API_KEY: 'k' }), { provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'k' });
    assert.equal(readImageConfig({ LLM_IMAGE_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'k' }), null);
    assert.equal(readImageConfig({ LLM_IMAGE_PROVIDER: 'other', ANTHROPIC_API_KEY: 'k' }), null);
    assert.equal(readImageConfig({ LLM_IMAGE_PROVIDER: 'openai', LLM_IMAGE_MODEL: 'm', OPENAI_API_KEY: 'o' })?.model, 'm');
  });
});

describe('remote image provider (fake fetch, no network)', () => {
  const image: DecodedImage = { mediaType: 'image/png', base64: PNG_BYTES.toString('base64') };
  it('sends the anthropic shape with temperature 0 and reports the exact model', async () => {
    const seen: any[] = [];
    const fake = (async (url: string, init: any) => {
      seen.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify({ model: 'claude-sonnet-5-5-x', content: [{ type: 'text', text: '```json\n{"status":"identified","label":"cup"}\n```' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = createRemoteImageProvider({ provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'k' }, fake);
    const r = await p.identify(image);
    assert.equal(r.model, 'anthropic/claude-sonnet-5-5-x');
    assert.deepEqual(r.value, { status: 'identified', label: 'cup' });
    assert.equal(seen[0].body.temperature, 0);
    assert.equal(seen[0].body.system, IDENTIFY_INSTRUCTIONS);
    assert.equal(seen[0].headers['x-api-key'], 'k');
  });
  it('retries once without temperature when the model rejects it', async () => {
    let n = 0;
    const bodies: any[] = [];
    const fake = (async (_u: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      n++;
      if (n === 1) return new Response(JSON.stringify({ error: { param: 'temperature' } }), { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"unclear"}' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = createRemoteImageProvider({ provider: 'openai', model: 'm', apiKey: 'k' }, fake);
    const r = await p.identify(image);
    assert.equal(n, 2);
    assert.ok(!('temperature' in bodies[1]));
    assert.equal(r.model, 'openai/m');
  });
  it('fails on a provider error status', async () => {
    const fake = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await assert.rejects(createRemoteImageProvider({ provider: 'anthropic', model: 'm', apiKey: 'k' }, fake).identify(image));
  });
});

describe('POST /api/identify', () => {
  let app: TestApp;
  let bare: TestApp;
  let value: unknown = { status: 'identified', label: 'plastic milk jug' };
  let fail = false;
  const received: DecodedImage[] = [];
  const provider: ImageProvider = {
    model: 'fake/image',
    async identify(img) {
      received.push(img);
      if (fail) throw new Error('boom');
      return { value, model: 'fake/image-1' };
    },
  };
  const post = (a: TestApp, body: unknown, type = 'application/json') =>
    fetch(`${a.url}/api/identify`, { method: 'POST', headers: { 'Content-Type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  before(async () => {
    const logs = await startApp({ modules: [] });
    const file = path.join(logs.logsDir, 'identify.jsonl');
    await logs.close();
    app = await startApp({ modules: [{ handle: createHandle({ getProvider: () => provider, logFile: file }) }] });
    (app as any).identifyLog = file;
    bare = await startApp({ modules: [{ handle: createHandle({ getProvider: () => null, logFile: path.join(app.logsDir, 'bare.jsonl') }) }] });
  });
  after(async () => {
    await app.close();
    await bare.close();
  });

  it('identifies and returns the contract shape', async () => {
    const r = await post(app, { image: dataUrl('jpeg', JPEG_BYTES) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'identified', label: 'plastic milk jug', candidates: [], model: 'fake/image-1' });
    assert.equal(received.at(-1)?.mediaType, 'image/jpeg');
  });

  it('drops a verdict the model volunteers', async () => {
    value = { status: 'identified', label: 'battery', stream: 'drop_off_special', recyclable: true };
    const body = (await (await post(app, { image: dataUrl('png', PNG_BYTES) })).json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['candidates', 'label', 'model', 'status']);
  });

  it('returns candidates for multiple and unclear without a label', async () => {
    value = { status: 'multiple', candidates: ['bottle', 'cap'] };
    assert.deepEqual(await (await post(app, { image: dataUrl('png', PNG_BYTES) })).json(), { status: 'multiple', label: null, candidates: ['bottle', 'cap'], model: 'fake/image-1' });
    value = { status: 'unclear' };
    assert.equal(((await (await post(app, { image: dataUrl('png', PNG_BYTES) })).json()) as { label: unknown }).label, null);
  });

  it('answers 400 for bad input without calling the provider', async () => {
    const before = received.length;
    for (const body of [{ image: 'nope' }, { image: dataUrl('gif', Buffer.from('GIF89a')) }, {}, { image: dataUrl('png', PNG_BYTES), extra: 1 }, 'not json']) {
      assert.equal((await post(app, body)).status, 400);
    }
    assert.equal((await post(app, { image: dataUrl('png', PNG_BYTES) }, 'text/plain')).status, 400);
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
    assert.equal((await post(app, { image: dataUrl('jpeg', big) })).status, 400);
    assert.equal(received.length, before);
  });

  it('answers 502 on a provider failure or when no provider is configured', async () => {
    fail = true;
    assert.equal((await post(app, { image: dataUrl('png', PNG_BYTES) })).status, 502);
    fail = false;
    assert.equal((await post(bare, { image: dataUrl('png', PNG_BYTES) })).status, 502);
  });

  it('logs time, status, label, model and duration only, never the photo', async () => {
    value = { status: 'identified', label: 'glass jar' };
    await post(app, { image: dataUrl('png', PNG_BYTES) });
    const text = await readFile((app as any).identifyLog, 'utf8');
    const last = JSON.parse(text.trim().split('\n').at(-1)!);
    assert.deepEqual(Object.keys(last).sort(), ['duration_ms', 'label', 'model', 'status', 'time']);
    assert.equal(last.label, 'glass jar');
    assert.ok(!text.includes(PNG_BYTES.toString('base64')));
  });
});
