import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CRAFT_BODIES, surfaceDirection } from '../src/solar/craft.ts';
import { ALL_BODIES, BODIES, BODY_BY_ID } from '../src/solar/bodies.ts';

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
  assert.ok(surfaceDirection('mars', 0, 0, new THREE.Vector3()).distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-9);
  assert.ok(surfaceDirection('mars', 0, 90, new THREE.Vector3()).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9);
  const d = surfaceDirection('mars', 22.5, 312, new THREE.Vector3());
  assert.ok(Math.abs(d.length() - 1) < 1e-9 && Math.abs(Math.asin(d.y) * 180 / Math.PI - 22.5) < 1e-9);
});
