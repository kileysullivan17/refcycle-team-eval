import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { answer } from '../helpers/fake-engine.ts';
import { loadClient } from '../helpers/client.ts';

const api = await loadClient('shared/api.js');
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('client ask (X-7)', () => {
  it('posts jurisdiction and query and returns a valid answer', async () => {
    let sent: any;
    globalThis.fetch = (async (_u: string, init: any) => {
      sent = JSON.parse(init.body);
      return json(200, answer('seattle_wa', {}));
    }) as any;
    const a = await api.ask('seattle_wa', 'cardboard');
    assert.deepEqual(sent, { jurisdiction: 'seattle_wa', query: 'cardboard' });
    assert.equal(a.behavior, 'answer');
  });
  it('throws on HTTP 400, on a response that does not fit the contract, and on a network failure', async () => {
    globalThis.fetch = (async () => json(400, { error: 'bad' })) as any;
    await assert.rejects(api.ask('a', 'b'), /bad/);
    globalThis.fetch = (async () => json(200, { behavior: 'answer', stream: null })) as any;
    await assert.rejects(api.ask('a', 'b'), /Unexpected/);
    globalThis.fetch = (async () => { throw new TypeError('network'); }) as any;
    await assert.rejects(api.ask('a', 'b'));
  });
  it('gives up after the timeout and reports it as a timeout, not a cancel', async () => {
    globalThis.fetch = ((_u: string, init: any) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))) as any;
    await assert.rejects(api.ask('a', 'b', undefined, 20), (e: any) => e.name === 'TimeoutError' && !api.isAbort(e));
  });
  it('reports a cancel from the caller as an abort', async () => {
    globalThis.fetch = ((_u: string, init: any) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))) as any;
    const ctl = new AbortController();
    const p = api.ask('a', 'b', ctl.signal);
    ctl.abort();
    await assert.rejects(p, (e: any) => api.isAbort(e));
  });
  it('uses a 150 second client timeout', () => {
    assert.equal(api.ASK_TIMEOUT_MS, 150000);
  });
});
