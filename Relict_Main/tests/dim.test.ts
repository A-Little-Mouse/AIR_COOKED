import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { averageAlbedo, dimBrightModel, dimFactor, MAX_ALBEDO, MIN_DIM } from '../src/solar/dim.ts';

const model = (hex: number) => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: hex })));
  return g;
};

test('dimFactor leaves dark and mid models alone, dims bright ones to the cap, and never below the floor', () => {
  assert.equal(dimFactor(0.2), 1);
  assert.equal(dimFactor(MAX_ALBEDO), 1);
  assert.ok(Math.abs(dimFactor(0.8) - MAX_ALBEDO / 0.8) < 1e-9);
  assert.equal(dimFactor(1), MAX_ALBEDO);
  assert.equal(dimFactor(5), MIN_DIM);
});

test('a white model is dimmed and a dark one is not', () => {
  const white = model(0xffffff), dark = model(0x303030);
  assert.ok(averageAlbedo(white) > 0.95);
  assert.ok(dimBrightModel(white) < 1);
  assert.ok(((white.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.r < 1);
  assert.equal(dimBrightModel(dark), 1);
});

test('materials shared by several meshes are dimmed once', () => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), mat), new THREE.Mesh(new THREE.BoxGeometry(), mat));
  const f = dimBrightModel(g);
  assert.ok(Math.abs(mat.color.r - f) < 1e-6, `r ${mat.color.r} vs factor ${f}`);
});
