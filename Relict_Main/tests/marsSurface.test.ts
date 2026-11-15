import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marsHeight } from '../src/solar/marsSurface.ts';

test('the pad under the lander is flat', () => {
  assert.equal(marsHeight(0, 0), 0);
  assert.equal(marsHeight(2.9, 0), 0);
  assert.equal(marsHeight(0, -2.9), 0);
});

test('marsHeight is deterministic and bounded within 300 m', () => {
  assert.equal(marsHeight(120, -80), marsHeight(120, -80));
  for (let i = -15; i <= 15; i++) for (let j = -15; j <= 15; j++) {
    const h = marsHeight(i * 20, j * 20);
    assert.ok(Math.abs(h) < 8, `h(${i * 20},${j * 20}) = ${h}`);
  }
});
