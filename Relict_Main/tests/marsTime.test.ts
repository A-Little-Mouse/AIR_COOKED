import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { phobosFrame, pickPhobosTime, shotLighting, SHOT_PHASE_DEG } from '../src/solar/marsTime.ts';

test('phobosFrame is an orthonormal frame with e1 toward Phobos and e2 toward Mars north', () => {
  const f = phobosFrame(new THREE.Vector3(5, 1, -2), new THREE.Vector3(0, 1, 0), { e1: new THREE.Vector3(), e2: new THREE.Vector3(), e3: new THREE.Vector3() });
  assert.ok(Math.abs(f.e1.length() - 1) < 1e-9 && Math.abs(f.e2.length() - 1) < 1e-9 && Math.abs(f.e3.length() - 1) < 1e-9);
  assert.ok(Math.abs(f.e1.dot(f.e2)) < 1e-9 && Math.abs(f.e1.dot(f.e3)) < 1e-9);
  assert.ok(f.e2.y > 0);
});

test('pickPhobosTime finds, within 8 hours, a moment lit as in the shot with the Sun on the right', () => {
  const DAY = 86_400_000;
  for (let d = 0; d < 60; d += 7) {
    const from = Date.UTC(2026, 0, 1) + d * DAY;
    const t = pickPhobosTime(from);
    assert.ok(t >= from && t - from <= 8 * 3_600_000, `+${d}d moved ${(t - from) / 3_600_000} h`);
    const { phaseDeg, sunSide } = shotLighting(t);
    assert.equal(sunSide, 1);
    assert.ok(Math.abs(phaseDeg - SHOT_PHASE_DEG) <= 3.5, `+${d}d phase ${phaseDeg}`);
  }
});
