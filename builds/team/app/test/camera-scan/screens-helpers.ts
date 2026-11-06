import assert from 'node:assert/strict';
import { FakeNode, makeDocument, makeStream, role } from './fake-dom.ts';
// @ts-ignore plain browser module, no types
import { mount } from '../../public/features/camera-scan/screens.js';

export { mount };

export function ctx() {
  const nav: string[] = [];
  return { nav, ctx: { place: 'seattle_wa', places: [], displayText: (t: string) => t, navigate: (p: string) => { nav.push(p); }, setTitle() {}, onPlaceChange: () => () => {} } };
}
export function setup(opts: { md?: any; fetch?: any; frame?: string } = {}) {
  const document = makeDocument();
  const container = new FakeNode('div');
  const c = ctx();
  const env = {
    document,
    mediaDevices: opts.md,
    fetch: opts.fetch,
    captureFrame: () => opts.frame ?? 'data:image/jpeg;base64,/9j/AAA=',
    fileToDataUrl: async () => 'data:image/jpeg;base64,/9j/BBB=',
    timeoutMs: 1000,
  };
  return { document, container, ...c, env };
}
export const tick = () => new Promise((r) => setTimeout(r, 5));
export function okMd(opts: { torch?: boolean; cameras?: number } = {}) {
  const calls: any[] = [];
  const streams: any[] = [];
  return {
    calls, streams,
    getUserMedia: async (c: any) => { calls.push(c); const s = makeStream({ torch: opts.torch }); streams.push(s); return s; },
    enumerateDevices: async () => Array.from({ length: opts.cameras ?? 1 }, () => ({ kind: 'videoinput' })),
  };
}
export const jsonResponse = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });


export async function scanWith(result: unknown | 'fail' | 'status502') {
  const md = okMd();
  const fetchFn = result === 'fail' ? async () => { throw new Error('net'); } : result === 'status502' ? jsonResponse({ error: 'x' }, 502) : jsonResponse(result);
  const s = setup({ md, fetch: fetchFn });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  await role(s.container, 'identify')!.click();
  await tick();
  assert.deepEqual(s.nav, ['/scan/confirm']);
  const c2 = new FakeNode('div');
  const s2 = { ...s, container: c2 };
  mount({ path: '/scan/confirm', params: {}, query: {} }, c2, s.ctx, s.env);
  return s2;
}


