import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLabel, reduceReply } from '../../src/features/camera-scan/sanitize.ts';

test('keeps plain generic names', () => {
  for (const l of ['plastic milk jug', 'glass jar', 'LED bulb', 'AA battery', 'pizza box', 'aluminum can']) assert.equal(sanitizeLabel(l), l.toLowerCase().replace('led', 'led'));
  assert.equal(sanitizeLabel('Glass Jar'), 'glass jar');
});

test('strips brand and model names', () => {
  assert.equal(sanitizeLabel('Coca-Cola can'), 'can');
  assert.equal(sanitizeLabel('Starbucks paper cup'), 'paper cup');
  assert.equal(sanitizeLabel('iPhone 15 Pro charger'), 'charger');
  assert.equal(sanitizeLabel('plastic Fiji water bottle'), 'plastic water bottle');
  assert.equal(sanitizeLabel('Duracell AA battery™'), 'aa battery');
  assert.equal(sanitizeLabel('WH-1000XM4 headphones'), 'headphones');
  assert.equal(sanitizeLabel('plastic bottle by Acme Corp'), 'plastic bottle');
});

test('strips resin numbers, deposit status and cleanliness', () => {
  assert.equal(sanitizeLabel('#2 plastic bottle'), 'plastic bottle');
  assert.equal(sanitizeLabel('HDPE jug'), 'jug');
  assert.equal(sanitizeLabel('plastic type 5 tub'), 'plastic tub');
  assert.equal(sanitizeLabel('HI-5 redeemable can'), 'can');
  assert.equal(sanitizeLabel('empty clean glass jar'), 'glass jar');
  assert.equal(sanitizeLabel('greasy pizza box'), 'pizza box');
  assert.equal(sanitizeLabel('food-soiled cardboard'), 'cardboard');
});

test('drops verdict and disposal clauses', () => {
  assert.equal(sanitizeLabel('glass jar - goes in the recycling bin'), 'glass jar');
  assert.equal(sanitizeLabel('can (recyclable)'), 'can');
  assert.equal(sanitizeLabel('recyclable can'), 'can');
  assert.equal(sanitizeLabel('Please put this in the trash'), '');
});

test('drops quantities and sizes, limits length, rejects empties', () => {
  assert.equal(sanitizeLabel('2 liter soda bottle'), 'soda bottle');
  assert.equal(sanitizeLabel('12 oz can'), 'can');
  assert.equal(sanitizeLabel('x'.repeat(10) + ' ' + 'word '.repeat(60)).length <= 120, true);
  assert.equal(sanitizeLabel('   '), '');
  assert.equal(sanitizeLabel(null), '');
  assert.equal(sanitizeLabel('12345'), '');
});

test('reduceReply drops extra keys and caps candidates', () => {
  const r = reduceReply({ status: 'multiple', candidates: ['a jar', 'b can', 'c box', 'd cup', 'e bag'], stream: 'garbage' });
  assert.deepEqual(Object.keys(r).sort(), ['candidates', 'emptiedByCleaning', 'label', 'status']);
  assert.equal(r.candidates.length, 4);
});
