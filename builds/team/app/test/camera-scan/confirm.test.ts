import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, setup, scanWith } from './screens-helpers.ts';
import { FakeNode, allNodes, role, roles } from './fake-dom.ts';

test('identified: shows "We think this is: <label>. Is that right?" with Yes and Edit and nothing else happens (CS-8)', async () => {
  const s = await scanWith({ status: 'identified', label: 'plastic milk jug', candidates: [], model: 'm' });
  assert.equal(role(s.container, 'question')!.textContent, 'We think this is: plastic milk jug. Is that right?');
  assert.equal(role(s.container, 'yes')!.textContent, 'Yes');
  assert.equal(role(s.container, 'edit')!.textContent, 'Edit');
  assert.deepEqual(s.nav, ['/scan/confirm']);
});

test('Yes navigates exactly to /item?q=<label>&origin=scan', async () => {
  const s = await scanWith({ status: 'identified', label: 'plastic milk jug & lid', candidates: [], model: 'm' });
  await role(s.container, 'yes')!.click();
  assert.equal(s.nav[1], '/item?q=' + encodeURIComponent('plastic milk jug & lid') + '&origin=scan');
});

test('Edit lets the resident change the label; submit navigates with the edited label; empty is refused', async () => {
  const s = await scanWith({ status: 'identified', label: 'glass jar', candidates: [], model: 'm' });
  await role(s.container, 'edit')!.click();
  const input = role(s.container, 'label-input')!;
  assert.equal(input.value, 'glass jar');
  input.value = '   ';
  await role(s.container, 'label-form')!.fire('submit');
  assert.equal(s.nav.length, 1);
  input.value = ' pasta sauce jar ';
  await role(s.container, 'label-form')!.fire('submit');
  assert.equal(s.nav[1], '/item?q=pasta%20sauce%20jar&origin=scan');
});

test('multiple: asks which item, up to 4 candidates and a text box; a candidate tap still asks "Is that right?" (CS-7, CS-8)', async () => {
  const s = await scanWith({ status: 'multiple', label: null, candidates: ['glass bottle', 'soda can', 'paper bag', 'plastic cup', 'fifth item'], model: 'm' });
  assert.match(role(s.container, 'question')!.textContent, /Which one/);
  const cands = roles(s.container, 'candidate');
  assert.deepEqual(cands.map((c) => c.textContent), ['glass bottle', 'soda can', 'paper bag', 'plastic cup']);
  assert.ok(role(s.container, 'label-input'));
  await cands[1].click();
  assert.equal(s.nav.length, 1, 'no navigation to the item page yet');
  assert.equal(role(s.container, 'question')!.textContent, 'We think this is: soda can. Is that right?');
  await role(s.container, 'yes')!.click();
  assert.equal(s.nav[1], '/item?q=soda%20can&origin=scan');
});

test('multiple: typed text goes on; candidates are never merged', async () => {
  const s = await scanWith({ status: 'multiple', label: null, candidates: ['glass bottle', 'soda can'], model: 'm' });
  role(s.container, 'label-input')!.value = 'yogurt cup';
  await role(s.container, 'label-form')!.fire('submit');
  assert.equal(s.nav[1], '/item?q=yogurt%20cup&origin=scan');
  assert.ok(!s.nav[1].includes('glass'));
});

test('unclear, HTTP 502, network failure and bad replies offer Retake and Type the item; no navigation to the item page (CS-5)', async () => {
  for (const r of [{ status: 'unclear', label: null, candidates: [], model: 'm' }, 'status502', 'fail', { nope: true }, { status: 'identified', label: '', candidates: [] }] as const) {
    const s = await scanWith(r as any);
    assert.equal(role(s.container, 'retake')!.textContent, 'Retake');
    assert.equal(role(s.container, 'type-item')!.textContent, 'Type the item');
    assert.ok(!role(s.container, 'yes'));
    assert.equal(s.nav.length, 1);
    await role(s.container, 'retake')!.click();
    assert.equal(s.nav[1], '/scan');
    await role(s.container, 'type-item')!.click();
    role(s.container, 'label-input')!.value = 'old toaster';
    await role(s.container, 'label-form')!.fire('submit');
    assert.equal(s.nav[2], '/item?q=old%20toaster&origin=scan');
  }
});

test('opening /scan/confirm with no scan offers Retake and Type the item', () => {
  const s = setup();
  mount({ path: '/scan', params: {}, query: {} }, s.container, s.ctx, { ...s.env, mediaDevices: undefined });
  const c2 = new FakeNode('div');
  mount({ path: '/scan/confirm', params: {}, query: {} }, c2, s.ctx, s.env);
  assert.ok(role(c2, 'retake') && role(c2, 'type-item'));
});

test('a label with markup is shown as text, not parsed', async () => {
  const s = await scanWith({ status: 'identified', label: '<img src=x onerror=alert(1)>', candidates: [], model: 'm' });
  const nodes = allNodes(s.container);
  assert.ok(!nodes.some((n) => n.nodeName === 'img'));
  assert.match(role(s.container, 'question')!.textContent, /<img/);
});

test('an unknown route shows the not-available message', () => {
  const s = setup();
  mount({ path: '/other', params: {}, query: {} }, s.container, s.ctx, s.env);
  assert.match(s.container.textContent, /not available/);
});
