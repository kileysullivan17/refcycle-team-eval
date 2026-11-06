import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemoteImageProvider, readImageConfig, getConfiguredProvider } from '../../src/features/camera-scan/provider.ts';
import { IDENTIFY_SYSTEM } from '../../src/features/camera-scan/prompt.ts';
import { dataUrl, makePng, post, startServer, tmpDir } from './helpers.ts';

const img = { mediaType: 'image/png' as const, base64: makePng().toString('base64'), bytes: 10 };
type Call = { url: string; init: RequestInit; body: any };
function transport(replies: Array<{ status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fn = (async (url: any, init: any) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test('config defaults to anthropic and claude-sonnet-5-5 when the image variables are unset', () => {
  const c = readImageConfig({ ANTHROPIC_API_KEY: 'k' });
  assert.equal(c.provider, 'anthropic');
  assert.equal(c.model, 'claude-sonnet-5-5');
  const empty = readImageConfig({ LLM_IMAGE_PROVIDER: '', LLM_IMAGE_MODEL: ' ', ANTHROPIC_API_KEY: 'k' });
  assert.equal(empty.model, 'claude-sonnet-5-5');
});

test('config uses the variables when set, with the matching key', () => {
  const c = readImageConfig({ LLM_IMAGE_PROVIDER: 'openai', LLM_IMAGE_MODEL: 'gpt-x', OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a' });
  assert.deepEqual(c, { provider: 'openai', model: 'gpt-x', apiKey: 'o' });
  assert.throws(() => readImageConfig({ LLM_IMAGE_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'a' }));
  assert.throws(() => readImageConfig({ LLM_IMAGE_PROVIDER: 'other', ANTHROPIC_API_KEY: 'a' }));
  assert.throws(() => readImageConfig({}));
  assert.throws(() => readImageConfig({ ANTHROPIC_API_KEY: '  ' }));
});

test('anthropic request: engine shape plus an image block, temperature 0', async () => {
  const t = transport([{ json: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"status":"identified","label":"glass jar"}' }] } }]);
  const p = new RemoteImageProvider({ provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'KEY' }, t.fn);
  const r = await p.identify(img);
  const c = t.calls[0];
  assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
  assert.equal((c.init.headers as any)['x-api-key'], 'KEY');
  assert.equal((c.init.headers as any)['anthropic-version'], '2023-06-01');
  assert.equal(c.body.temperature, 0);
  assert.equal(c.body.model, 'claude-sonnet-5-5');
  assert.equal(c.body.system, IDENTIFY_SYSTEM);
  assert.equal(c.body.messages[0].role, 'user');
  const blocks = c.body.messages[0].content;
  assert.deepEqual(blocks[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img.base64 } });
  assert.equal(blocks[1].type, 'text');
  assert.deepEqual(r, { model: 'anthropic/claude-sonnet-5-5', value: { status: 'identified', label: 'glass jar' } });
});

test('openai request: engine shape plus an image_url block, temperature 0', async () => {
  const t = transport([{ json: { model: 'gpt-x-2026', choices: [{ message: { content: '```json\n{"status":"unclear"}\n```' } }] } }]);
  const p = new RemoteImageProvider({ provider: 'openai', model: 'gpt-x', apiKey: 'OK' }, t.fn);
  const r = await p.identify(img);
  const c = t.calls[0];
  assert.equal(c.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal((c.init.headers as any).Authorization, 'Bearer OK');
  assert.equal(c.body.temperature, 0);
  assert.deepEqual(c.body.response_format, { type: 'json_object' });
  assert.equal(c.body.messages[0].role, 'system');
  const blocks = c.body.messages[1].content;
  assert.deepEqual(blocks[0], { type: 'image_url', image_url: { url: 'data:image/png;base64,' + img.base64 } });
  assert.deepEqual(r, { model: 'openai/gpt-x-2026', value: { status: 'unclear' } });
});

for (const provider of ['anthropic', 'openai'] as const) {
  test(`${provider}: retries once without temperature only when the provider rejects it`, async () => {
    const ok = provider === 'anthropic' ? { content: [{ type: 'text', text: '{"status":"unclear"}' }] } : { choices: [{ message: { content: '{"status":"unclear"}' } }] };
    const t = transport([{ status: 400, json: { error: { param: 'temperature', message: 'unsupported value' } } }, { json: ok }]);
    const p = new RemoteImageProvider({ provider, model: 'm', apiKey: 'k' }, t.fn);
    await p.identify(img);
    assert.equal(t.calls.length, 2);
    assert.equal(t.calls[0].body.temperature, 0);
    assert.ok(!('temperature' in t.calls[1].body));
    // The setting is remembered for later calls, as in the engine.
    await p.identify(img);
    assert.ok(!('temperature' in t.calls[2].body));
  });

  test(`${provider}: other 400s and HTTP errors throw without a retry`, async () => {
    const t = transport([{ status: 400, json: { error: { message: 'bad image' } } }]);
    await assert.rejects(new RemoteImageProvider({ provider, model: 'm', apiKey: 'k' }, t.fn).identify(img));
    assert.equal(t.calls.length, 1);
    const t2 = transport([{ status: 500, json: {} }]);
    await assert.rejects(new RemoteImageProvider({ provider, model: 'm', apiKey: 'k' }, t2.fn).identify(img));
    assert.equal(t2.calls.length, 1);
  });

  test(`${provider}: malformed or empty replies give a null value`, async () => {
    const bad = provider === 'anthropic' ? { content: [{ type: 'text', text: 'not json' }] } : { choices: [{ message: { content: 'not json' } }] };
    const r = await new RemoteImageProvider({ provider, model: 'm', apiKey: 'k' }, transport([{ json: bad }]).fn).identify(img);
    assert.equal(r.value, null);
    const r2 = await new RemoteImageProvider({ provider, model: 'm', apiKey: 'k' }, transport([{ json: {} }]).fn).identify(img);
    assert.equal(r2.value, null);
  });
}

test('repair request adds the stricter instruction', async () => {
  const t = transport([{ json: { content: [{ type: 'text', text: '{}' }] } }]);
  await new RemoteImageProvider({ provider: 'anthropic', model: 'm', apiKey: 'k' }, t.fn).identify(img, true);
  assert.ok(t.calls[0].body.system.length > IDENTIFY_SYSTEM.length);
});

test('the prompt asks only what the item is and bans brands, verdicts and unseen facts', () => {
  for (const needle of ['what is the item', 'brand', 'recyclable', 'resin', 'deposit', 'clean']) assert.ok(IDENTIFY_SYSTEM.toLowerCase().includes(needle), needle);
});

test('with no key, the real route returns 502 and the process is fine (config read per request)', async () => {
  const saved = { ...process.env };
  for (const k of ['LLM_IMAGE_PROVIDER', 'LLM_IMAGE_MODEL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) delete process.env[k];
  const s = await startServer({ logDir: tmpDir() });
  try {
    const r = await post(s.base, { image: dataUrl('image/png', makePng()) });
    assert.equal(r.status, 502);
    assert.deepEqual(Object.keys(r.json), ['error']);
    // A key appearing later is picked up without a restart.
    process.env.ANTHROPIC_API_KEY = 'later';
    const p = await getConfiguredProvider();
    assert.equal(p.model, 'anthropic/claude-sonnet-5-5');
  } finally {
    await s.close();
    for (const k of ['LLM_IMAGE_PROVIDER', 'LLM_IMAGE_MODEL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});

test('the adapter and route code never call the ask endpoint or write image files', () => {
  for (const f of ['provider.ts', 'routes.ts', 'image.ts', 'sanitize.ts', 'prompt.ts']) {
    const src = readFileSync(new URL('../../src/features/camera-scan/' + f, import.meta.url), 'utf8');
    assert.ok(!/api\/ask/.test(src), f);
    assert.ok(!/writeFile|createWriteStream|writeFileSync/.test(src), f);
  }
});
