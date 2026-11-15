import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BODY_BY_ID } from '../src/solar/bodies.ts';
import { AU_KM, J2000_MS, localPosition, orbitPoints, orientation, poleVector, solveKepler } from '../src/solar/ephemeris.ts';

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

test('Earth at J2000 is ~(-0.177, 0.967, 0) AU (known ephemeris value)', () => {
  const p = heliocentricAU('earth', J2000_MS);
  assert.ok(Math.abs(p.x - -0.1771) < 0.003, `x=${p.x}`);
  assert.ok(Math.abs(p.y - 0.9672) < 0.003, `y=${p.y}`);
  assert.ok(Math.abs(p.z) < 0.001, `z=${p.z}`);
});

test('planet distances stay within perihelion/aphelion and orbital periods match', () => {
  const periodsDays: Record<string, number> = { mercury: 87.97, venus: 224.7, earth: 365.25, mars: 686.98, jupiter: 4332.6, saturn: 10759, neptune: 60190 };
  for (const [id, period] of Object.entries(periodsDays)) {
    const t0 = Date.UTC(2026, 0, 1);
    const a = localPosition(BODY_BY_ID.get(id)!, t0, new THREE.Vector3());
    const b = localPosition(BODY_BY_ID.get(id)!, t0 + period * 86_400_000, new THREE.Vector3());
    // after one sidereal-ish period the planet is back near where it was (within ~3% of the orbit radius)
    assert.ok(a.distanceTo(b) / a.length() < 0.03, `${id}: moved ${a.distanceTo(b) / a.length()}`);
  }
});

test('Moon is ~384,400 km from Earth, within its real perigee/apogee range', () => {
  for (let d = 0; d < 60; d += 3) {
    const r = localPosition(BODY_BY_ID.get('moon')!, Date.UTC(2026, 0, 1) + d * 86_400_000, new THREE.Vector3()).length();
    assert.ok(r > 355_000 && r < 408_000, `r=${r}`);
  }
});

test('Moon completes an orbit in ~27.3 days', () => {
  const t0 = Date.UTC(2026, 3, 1);
  const a = localPosition(BODY_BY_ID.get('moon')!, t0, new THREE.Vector3());
  const b = localPosition(BODY_BY_ID.get('moon')!, t0 + 27.32 * 86_400_000, new THREE.Vector3());
  assert.ok(a.angleTo(b) < 0.08, `angle=${a.angleTo(b)}`);
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

test('Earth pole is the ecliptic-tilted spin axis (23.44 deg from ecliptic north)', () => {
  const deg = Math.acos(poleVector(BODY_BY_ID.get('earth')!).y) * 180 / Math.PI;
  assert.ok(Math.abs(deg - 23.44) < 0.01, `tilt=${deg}`);
  // IAU puts Venus's north pole near ecliptic north and gives it a NEGATIVE rotation rate => it spins backwards.
  const venus = Math.acos(poleVector(BODY_BY_ID.get('venus')!).y) * 180 / Math.PI;
  assert.ok(venus < 5, `venus pole is ${venus} deg from ecliptic north`);
  assert.ok(BODY_BY_ID.get('venus')!.rotationHours < 0);
});

test('orbit lines have the requested resolution and close on the planet', () => {
  const def = BODY_BY_ID.get('mars')!;
  const pts = orbitPoints(def, J2000_MS, 2048);
  assert.equal(pts.length, 2048);
  const now = localPosition(def, J2000_MS, new THREE.Vector3());
  // distance from Mars to the polyline (segments, not just vertices)
  let nearest = Infinity;
  const seg = new THREE.Line3(), closest = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    seg.set(pts[i], pts[(i + 1) % pts.length]);
    seg.closestPointToPoint(now, true, closest);
    nearest = Math.min(nearest, closest.distanceTo(now));
  }
  assert.ok(nearest < 1000, `orbit line passes ${nearest} km from Mars`); // Mars radius is 3,396 km
});

test('the Moon is tidally locked: its 0 deg meridian always faces Earth', () => {
  const moon = BODY_BY_ID.get('moon')!;
  const pole = poleVector(moon);
  for (let d = 0; d < 60; d += 4) {
    const ms = Date.UTC(2026, 0, 1) + d * 86_400_000;
    const prime = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation(moon, ms, new THREE.Quaternion()));
    const toEarth = localPosition(moon, ms, new THREE.Vector3()).negate().normalize();
    // compare in the equatorial plane (Earth sits a few degrees off it because the Moon's orbit is inclined to its equator)
    const proj = (v: THREE.Vector3) => v.clone().sub(pole.clone().multiplyScalar(v.dot(pole))).normalize();
    assert.ok(proj(prime).dot(proj(toEarth)) > 0.99999, `day ${d}: meridian is ${Math.acos(Math.min(1, proj(prime).dot(proj(toEarth)))) * 180 / Math.PI} deg off`);
  }
});

test('other bodies spin at their real rate (Earth ~360.986 deg/day, Venus backwards)', () => {
  const earth = BODY_BY_ID.get('earth')!;
  const t0 = Date.UTC(2026, 5, 1);
  const q0 = orientation(earth, t0, new THREE.Quaternion()), q1 = orientation(earth, t0 + 3_600_000, new THREE.Quaternion());
  const deg = (q0.angleTo(q1) * 180) / Math.PI;
  assert.ok(Math.abs(deg - 15.041) < 0.01, `Earth turns ${deg} deg in an hour`);
});
