import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fbm, rng } from '../src/solar/noise.ts';

test('rng is deterministic and in [0,1)', () => {
  const a = rng(1), b = rng(1);
  for (let i = 0; i < 5; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});

test('fbm is deterministic and within [0,1]', () => {
  for (let i = 0; i < 50; i++) { const v = fbm(i * 0.37, i * 0.91); assert.equal(v, fbm(i * 0.37, i * 0.91)); assert.ok(v >= 0 && v <= 1); }
});
