import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CRAFT_BODIES, orbitLinePoints, placeL1, placeOrbiter, surfaceDirection } from '../src/solar/craft.ts';
import { ALL_BODIES, BODIES, BODY_BY_ID } from '../src/solar/bodies.ts';
import { J2000_MS } from '../src/solar/ephemeris.ts';

test('every craft has a parent body, unique id and a model path', () => {
  const ids = new Set<string>();
  for (const c of CRAFT_BODIES) {
    assert.ok(BODIES.some((b) => b.id === c.parent), `${c.id} parent`);
    assert.ok(!ids.has(c.id) && !BODY_BY_ID.has(c.id) === false, c.id);
    ids.add(c.id);
    assert.match(c.model, /^\/models\/.+\.glb$/);
  }
  assert.equal(ALL_BODIES.length, BODIES.length + CRAFT_BODIES.length);
});

test('surface directions are unit vectors; the Mars model is turned 180° about Y', () => {
  const v = surfaceDirection('moon', 0, 0, new THREE.Vector3());
  assert.ok(v.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9); // lon 0 on +X
  assert.ok(surfaceDirection('moon', 0, 90, new THREE.Vector3()).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9); // east = -Z
  assert.ok(surfaceDirection('mars', 0, 0, new THREE.Vector3()).distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-9);
  assert.ok(surfaceDirection('mars', 0, 90, new THREE.Vector3()).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9);
  const d = surfaceDirection('mars', 22.5, 312, new THREE.Vector3());
  assert.ok(Math.abs(d.length() - 1) < 1e-9 && Math.abs(Math.asin(d.y) * 180 / Math.PI - 22.5) < 1e-9);
});

test('satellites stay at their altitude and complete an orbit in the right period', () => {
  const aqua = CRAFT_BODIES.find((c) => c.id === 'aqua')!.craft!;
  assert.equal(aqua.kind, 'orbit');
  if (aqua.kind !== 'orbit') return;
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), q = new THREE.Quaternion();
  placeOrbiter(aqua, J2000_MS, J2000_MS, p0, q);
  assert.ok(Math.abs(p0.length() - (6378.137 + 705)) < 1e-6);
  const period = 2 * Math.PI * Math.sqrt((6378.137 + 705) ** 3 / 398600.4418);
  assert.ok(period / 60 > 98 && period / 60 < 100); // Aqua: ~99 min
  placeOrbiter(aqua, J2000_MS + period * 1000, J2000_MS, p1, q);
  assert.ok(p0.distanceTo(p1) < 1e-3);
  for (const p of orbitLinePoints(aqua, 36)) assert.ok(Math.abs(p.length() - (6378.137 + 705)) < 1e-6);
});

test('ACE sits on the Earth-Sun line, sunward of Earth', () => {
  const ace = CRAFT_BODIES.find((c) => c.id === 'ace')!.craft!;
  if (ace.kind !== 'l1') throw new Error('ace should be l1');
  const earth = new THREE.Vector3(1.4e8, 0, 4e7), out = new THREE.Vector3();
  placeL1(ace, earth, out);
  assert.ok(Math.abs(out.length() - 1.5e6) < 1e-3);
  assert.ok(out.clone().normalize().dot(earth.clone().normalize()) < -0.999999);
});
