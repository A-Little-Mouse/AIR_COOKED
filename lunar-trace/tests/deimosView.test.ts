import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularRadiusDeg, DEIMOS_ORBIT_KM, marsElevationDeg } from '../src/solar/deimosView.ts';

test('Mars is about 8.3 degrees in radius from Deimos', () => {
  assert.ok(Math.abs(angularRadiusDeg(3396.2, DEIMOS_ORBIT_KM) - 8.32) < 0.05);
});

test('Mars is overhead at the sub-Mars point and on the horizon 90 degrees away', () => {
  assert.ok(Math.abs(marsElevationDeg(0) - 90) < 1e-9);
  const h = marsElevationDeg(90);
  assert.ok(h < 0 && h > -0.1, String(h));
});

test('60 degrees from the sub-Mars point Mars stands 25-35 degrees up', () => {
  const e = marsElevationDeg(60);
  assert.ok(e > 25 && e < 35, String(e));
});
