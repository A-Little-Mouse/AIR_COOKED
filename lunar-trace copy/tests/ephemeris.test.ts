import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BODY_BY_ID } from '../src/solar/bodies.ts';
import { AU_KM, localPosition, orientation, poleVector, solveKepler } from '../src/solar/ephemeris.ts';

const heliocentricAU = (id: string, ms: number) => {
  const v = localPosition(BODY_BY_ID.get(id)!, ms, new THREE.Vector3());
  // scene (x, y, z) -> ecliptic (x, -z, y)
  return { x: v.x / AU_KM, y: -v.z / AU_KM, z: v.y / AU_KM };
};

test('Kepler solver satisfies M = E - e sin E', () => {
  for (const e of [0, 0.05, 0.2, 0.9]) for (const M of [-3, -1, 0, 0.5, 2, 3.1]) {
    const E = solveKepler(M, e);
    assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-10, `e=${e} M=${M}`);
  }
});

test('Mars stays between its perihelion and aphelion and returns after one orbit', () => {
  const t0 = Date.UTC(2026, 0, 1);
  const a = localPosition(BODY_BY_ID.get('mars')!, t0, new THREE.Vector3());
  const b = localPosition(BODY_BY_ID.get('mars')!, t0 + 686.98 * 86_400_000, new THREE.Vector3());
  assert.ok(a.distanceTo(b) / a.length() < 0.03, `moved ${a.distanceTo(b) / a.length()}`);
  for (let d = 0; d < 687; d += 30) {
    const r = heliocentricAU('mars', t0 + d * 86_400_000);
    const au = Math.hypot(r.x, r.y, r.z);
    assert.ok(au > 1.37 && au < 1.68, `mars is ${au} AU from the Sun`);
  }
});

test('Phobos / Deimos orbit Mars at their real radii, in Mars\'s equatorial plane', () => {
  const marsPole = poleVector(BODY_BY_ID.get('mars')!);
  for (const [id, a] of [['phobos', 9376], ['deimos', 23463]] as const) {
    for (let h = 0; h < 48; h += 5) {
      const v = localPosition(BODY_BY_ID.get(id)!, Date.UTC(2026, 0, 1) + h * 3_600_000, new THREE.Vector3());
      assert.ok(Math.abs(v.length() - a) / a < 0.02, `${id} r=${v.length()}`);
      assert.ok(Math.abs(v.clone().normalize().dot(marsPole)) < 1e-6, `${id} off the equator`);
    }
  }
});

test('Mars spins at its real rate (24.6229 h per turn)', () => {
  const mars = BODY_BY_ID.get('mars')!;
  const t0 = Date.UTC(2026, 5, 1);
  const q0 = orientation(mars, t0, new THREE.Quaternion()), q1 = orientation(mars, t0 + 3_600_000, new THREE.Quaternion());
  const deg = (q0.angleTo(q1) * 180) / Math.PI;
  assert.ok(Math.abs(deg - 360 / 24.6229) < 0.01, `Mars turns ${deg} deg in an hour`);
});
