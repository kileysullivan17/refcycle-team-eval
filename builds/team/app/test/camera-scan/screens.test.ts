import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, setup, tick, okMd } from './screens-helpers.ts';
import { FakeNode, role, visible } from './fake-dom.ts';

test('/scan shows viewfinder, Identify, Photos, Snap Tips, close, flash and flip when supported (CS-1)', async () => {
  const s = setup({ md: okMd({ torch: true, cameras: 2 }) });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  assert.ok(visible(s.container.querySelector('video')));
  for (const r of ['identify', 'photos', 'tips', 'close', 'flash', 'flip']) assert.ok(visible(role(s.container, r)), r);
  assert.equal(role(s.container, 'identify')!.textContent, 'Identify');
  assert.equal(role(s.container, 'photos')!.textContent, 'Photos');
  assert.equal(role(s.container, 'tips')!.textContent, 'Snap Tips');
});

test('flash and flip are hidden when the device does not support them', async () => {
  const s = setup({ md: okMd({ torch: false, cameras: 1 }) });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  assert.ok(!visible(role(s.container, 'flash')));
  assert.ok(!visible(role(s.container, 'flip')));
  assert.ok(visible(role(s.container, 'identify')));
});

test('Snap Tips toggles a panel; close leaves the screen', async () => {
  const s = setup({ md: okMd() });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  assert.ok(!visible(role(s.container, 'tips-panel')));
  await role(s.container, 'tips')!.click();
  assert.ok(visible(role(s.container, 'tips-panel')));
  await role(s.container, 'close')!.click();
  assert.equal(s.nav.length, 1);
});

test('permission denied or no camera offers photo upload limited to JPEG, PNG and WebP (CS-9)', async () => {
  const denied = { getUserMedia: async () => { const e: any = new Error('denied'); e.name = 'NotAllowedError'; throw e; } };
  for (const md of [denied, undefined, { getUserMedia: async () => { const e: any = new Error('none'); e.name = 'NotFoundError'; throw e; } }]) {
    const s = setup({ md });
    mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
    await tick();
    const input = role(s.container, 'fallback-input')!;
    assert.ok(visible(input));
    assert.equal(input.getAttribute('type'), 'file');
    assert.equal(input.getAttribute('accept'), 'image/jpeg,image/png,image/webp');
    assert.ok(!visible(role(s.container, 'identify')));
    assert.ok(!visible(s.container.querySelector('video')));
    assert.ok(visible(role(s.container, 'photos')));
  }
});

test('a non-image file is refused on the screen and nothing is sent', async () => {
  let sent = 0;
  const s = setup({ md: undefined, fetch: async () => { sent++; return new Response('{}'); } });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  const input = role(s.container, 'fallback-input')!;
  input.files = [{ type: 'image/gif', size: 10 }];
  await input.fire('change');
  await tick();
  assert.equal(sent, 0);
  assert.match(s.container.textContent, /JPEG, PNG or WebP/);
  assert.deepEqual(s.nav, []);
});

test('an uploaded photo is sent to /api/identify only, then the confirm screen opens', async () => {
  const sent: any[] = [];
  const s = setup({ md: undefined, fetch: async (url: string, init: any) => { sent.push({ url, init }); return new Response(JSON.stringify({ status: 'identified', label: 'glass jar', candidates: [], model: 'm' })); } });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  const input = role(s.container, 'fallback-input')!;
  input.files = [{ type: 'image/png', size: 10 }];
  await input.fire('change');
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/identify');
  assert.equal(JSON.parse(sent[0].init.body).image, 'data:image/jpeg;base64,/9j/BBB=');
  assert.deepEqual(s.nav, ['/scan/confirm']);
});

test('cleanup stops the camera and a late result does not navigate', async () => {
  const md = okMd();
  let release: any;
  const s = setup({ md, fetch: () => new Promise((r) => { release = r; }) });
  const cleanup = mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  void role(s.container, 'identify')!.click();
  await tick();
  // The camera is released as soon as the photo is taken.
  assert.ok(md.streams[0].track.stopped);
  cleanup();
  release(new Response(JSON.stringify({ status: 'unclear' })));
  await tick();
  assert.deepEqual(s.nav, []);
  const md2 = okMd();
  const s2 = setup({ md: md2 });
  const c2 = mount({ path: '/scan', params: {}, query: {} }, s2.container, s2.ctx, s2.env);
  await tick();
  assert.ok(!md2.streams[0].track.stopped);
  c2();
  assert.ok(md2.streams[0].track.stopped);
});

test('flip asks for the other camera; flash applies a torch constraint', async () => {
  const md = okMd({ torch: true, cameras: 2 });
  const s = setup({ md });
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, s.env);
  await tick();
  assert.equal(md.calls[0].video.facingMode.ideal, 'environment');
  await role(s.container, 'flip')!.click();
  await tick();
  assert.equal(md.calls[1].video.facingMode.ideal, 'user');
  assert.ok(md.streams[0].track.stopped);
  await role(s.container, 'flash')!.click();
  assert.deepEqual(md.streams[1].track.constraints[0], { advanced: [{ torch: true }] });
});

