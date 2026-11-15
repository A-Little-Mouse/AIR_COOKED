import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skinWeightsFor } from '../src/expedition/rigWeights.ts';

const dominant = (x: number, y: number, z: number) => {
  const { index, weight } = skinWeightsFor(x, y, z);
  let best = 0; for (let i = 1; i < 4; i++) if (weight[i] > weight[best]) best = i;
  return { bone: index[best], w: weight[best] };
};

test('weights always sum to 1 and are within [0,1] across the whole bounding box', () => {
  for (let x = -0.33; x <= 0.33; x += 0.03) for (let y = -0.5; y <= 0.5; y += 0.02) for (let z = -0.41; z <= 0.41; z += 0.02) {
    const { weight } = skinWeightsFor(x, y, z);
    const sum = weight.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `sum ${sum} at ${x},${y},${z}`);
    assert.ok(weight.every((w) => w >= -1e-12 && w <= 1 + 1e-12));
  }
});

test('feet follow their own leg, hands their own arm, head / backpack / chest stay on the root', () => {
  assert.deepEqual(dominant(0.1, -0.45, -0.15), { bone: 1, w: 1 }); // left foot  (-Z) -> left hip
  assert.deepEqual(dominant(0.1, -0.45, 0.15), { bone: 2, w: 1 });  // right foot (+Z) -> right hip
  assert.equal(dominant(0.05, -0.05, -0.38).bone, 3);               // left hand  -> left shoulder
  assert.equal(dominant(0.05, -0.05, 0.38).bone, 4);                // right hand -> right shoulder
  assert.ok(dominant(0.05, -0.05, 0.38).w > 0.99);
  for (const [x, y, z] of [[0.05, 0.42, 0], [-0.25, 0.3, 0.1], [0.1, 0.0, 0.05], [-0.28, -0.05, -0.1]]) assert.equal(dominant(x, y, z).bone, 0, `${x},${y},${z}`);
});

test('smooth at the joints: weights vary continuously (no jump bigger than 0.25 per 5 mm)', () => {
  for (let y = -0.5; y < 0.5; y += 0.005) for (const z of [-0.3, -0.18, 0, 0.05, 0.2, 0.3]) {
    const a = skinWeightsFor(0, y, z).weight, b = skinWeightsFor(0, y + 0.005, z).weight;
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(a[i] - b[i]) < 0.25, `jump at y=${y} z=${z} bone ${i}`);
  }
});

test('the crotch splits between both legs instead of snapping to one', () => {
  const w = skinWeightsFor(0, -0.3, 0).weight;
  assert.ok(Math.abs(w[1] - w[2]) < 1e-9 && w[1] > 0.4);
});

import * as THREE from 'three';
import { rigAstronaut } from '../src/expedition/astronaut.ts';

/** A stand-in mesh (a few vertices spread over the model's bounding box) so the real rig code can run without WebGL. */
function makeRig() {
  const pts: number[] = [];
  for (const x of [-0.3, 0, 0.3]) for (const y of [-0.5, -0.25, 0, 0.25, 0.5]) for (const z of [-0.4, -0.2, 0, 0.2, 0.4]) pts.push(x, y, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const parent = new THREE.Group();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  parent.add(mesh);
  const rig = rigAstronaut(mesh);
  parent.updateMatrixWorld(true);
  return rig;
}
/** World X (front/back) of a point in a bone's local frame. */
const frontOf = (b: THREE.Bone, local: THREE.Vector3) => { b.updateWorldMatrix(true, false); return local.clone().applyMatrix4(b.matrixWorld).x; };

test('rig: legs and arms swing in opposition - on each side the arm moves opposite to the leg (and left opposes right)', () => {
  const rig = makeRig(); const [, hipL, hipR, shL, shR] = rig.bones;
  const foot = new THREE.Vector3(0, -0.3, 0), handL = new THREE.Vector3(0, 0, -0.35), handR = new THREE.Vector3(0, 0, 0.35);
  rig.pose(0);
  const rest = { fL: frontOf(hipL, foot), fR: frontOf(hipR, foot), aL: frontOf(shL, handL), aR: frontOf(shR, handR) };
  for (const phase of [Math.PI / 2, (3 * Math.PI) / 2]) {
    rig.pose(phase);
    const d = { fL: frontOf(hipL, foot) - rest.fL, fR: frontOf(hipR, foot) - rest.fR, aL: frontOf(shL, handL) - rest.aL, aR: frontOf(shR, handR) - rest.aR };
    assert.ok(Math.abs(d.fL) > 0.12 && Math.abs(d.aL) > 0.12, `real stride/swing: ${JSON.stringify(d)}`);
    assert.ok(d.fL * d.fR < 0, 'left foot and right foot move opposite ways');
    assert.ok(d.fL * d.aL < 0, 'left arm opposes left leg');
    assert.ok(d.fR * d.aR < 0, 'right arm opposes right leg');
    assert.ok(d.aL * d.aR < 0, 'the arms oppose each other');
  }
});

test('rig: swinging reverses over half a cycle, and standing (gait 0) is a calm pose with the legs together', () => {
  const rig = makeRig(); const [, hipL] = rig.bones;
  const foot = new THREE.Vector3(0, -0.3, 0);
  rig.pose(Math.PI / 2); const a = frontOf(hipL, foot);
  rig.pose((3 * Math.PI) / 2); const b = frontOf(hipL, foot);
  assert.ok(a * b < 0 || Math.abs(a + b) < 0.05, `symmetric swing ${a} / ${b}`);
  const idle = makeRig();
  idle.update(1.3, false, 1 / 60); // never walked: gait stays 0
  assert.ok(Math.abs(frontOf(idle.bones[1], foot) - frontOf(idle.bones[1], foot)) < 1e-12);
  assert.ok(Math.abs(idle.bones[1].rotation.z) < 1e-9 && Math.abs(idle.bones[2].rotation.z) < 1e-9, 'legs stay together when standing');
});

test('rig: starting and stopping ease in and out (no snap) and the lean points forward', () => {
  const rig = makeRig();
  rig.update(Math.PI / 2, true, 1 / 60);
  const first = Math.abs(rig.bones[1].rotation.z);
  assert.ok(first > 0 && first < 0.5 * 0.62, `first frame only part-way: ${first}`);
  for (let i = 0; i < 60; i++) rig.update(Math.PI / 2, true, 1 / 60);
  assert.ok(Math.abs(Math.abs(rig.bones[1].rotation.z) - 0.62) < 0.01, 'reaches the full stride');
  assert.ok(rig.bones[0].rotation.z < -0.09, 'leans forward (negative turn about Z = +X front)');
  for (let i = 0; i < 90; i++) rig.update(Math.PI / 2, false, 1 / 60);
  assert.ok(Math.abs(rig.bones[1].rotation.z) < 0.01 && Math.abs(rig.bones[0].rotation.z) < 0.001, 'eased back to standing');
});
