import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightOnlyOf, bodiesOf, craftOf, listOf, resolveStartId, worldFromSearch } from '../src/solar/world.ts';
import { CRAFT_BODIES } from '../src/solar/craft.ts';

test('mars world loads only mars, phobos, deimos', () => {
  assert.deepEqual(bodiesOf('mars').map((b) => b.id), ['mars', 'phobos', 'deimos']);
});

test('mars craft are the landers in list order', () => {
  assert.deepEqual(craftOf('mars').map((c) => c.id), ['viking-1', 'viking-2', 'sojourner', 'spirit', 'opportunity', 'insight', 'ingenuity']);
});

test('mars list order', () => {
  assert.deepEqual(listOf('mars').map((b) => b.id), ['mars', 'viking-1', 'viking-2', 'sojourner', 'spirit', 'opportunity', 'insight', 'ingenuity', 'phobos', 'deimos']);
});

test('viking 2 is at Utopia Planitia', () => {
  const v = CRAFT_BODIES.find((c) => c.id === 'viking-2')!;
  assert.deepEqual(v.craft, { kind: 'surface', latDeg: 48.27, lonDeg: 134.0 });
  assert.equal(v.parent, 'mars');
});

test('resolveStartId falls back to mars for unknown or non-mars ids', () => {
  for (const id of ['earth', 'sun', null, 'nope']) assert.equal(resolveStartId('mars', id), 'mars');
  assert.equal(resolveStartId('mars', 'viking-1'), 'viking-1');
  assert.equal(resolveStartId('solar', 'sun'), 'sun');
});

test('worldFromSearch', () => {
  assert.equal(worldFromSearch('?world=mars'), 'mars');
  assert.equal(worldFromSearch(''), 'solar');
  assert.equal(worldFromSearch('?world=venus'), 'solar');
});

test('the Sun is drawn in the mars world but is not one of its bodies or list entries', () => {
  assert.deepEqual(lightOnlyOf('mars').map((b) => b.id), ['sun']);
  assert.deepEqual(lightOnlyOf('solar'), []);
  assert.ok(!bodiesOf('mars').some((b) => b.id === 'sun') && !listOf('mars').some((b) => b.id === 'sun'));
});
