import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { latLonDeg, screenRight, startFrame, walk } from '../src/expedition/walk.ts';

const DEG = Math.PI / 180;
const angleFromStart = (f: { pos: THREE.Vector3 }) => Math.acos(THREE.MathUtils.clamp(f.pos.dot(new THREE.Vector3(0, 0, 1)), -1, 1)) / DEG;

test('start frame: screen-right is +X (camera on +Z looking at the centre, up = +Y)', () => {
  const r = screenRight(startFrame());
  assert.ok(r.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9, r.toArray().join());
});

test('W walks north, D walks east, S south, A west (near the equator)', () => {
  const dir = (ix: number, iy: number) => { const f = startFrame(); walk(f, ix, iy, 0.2); return latLonDeg(f); };
  assert.ok(dir(0, 1).lat > 10 && Math.abs(dir(0, 1).lon) < 1e-6, 'W');
  assert.ok(dir(0, -1).lat < -10, 'S');
  assert.ok(dir(1, 0).lon > 10 && Math.abs(dir(1, 0).lat) < 1e-6, 'D');
  assert.ok(dir(-1, 0).lon < -10, 'A');
});

test('NO WALL AT THE POLES: walking W keeps going straight over the north pole and down the other side', () => {
  const f = startFrame();
  const seen: number[] = [];
  for (let i = 0; i < 400; i++) { walk(f, 0, 1, 0.5 * DEG); seen.push(angleFromStart(f)); }
  // 200 degrees of walking: the angle from the start must increase steadily to 180 (the far side of the sphere)...
  assert.ok(Math.max(...seen) > 179, `furthest ${Math.max(...seen)}`);
  // ...passing through latitude 90 on the way
  const g = startFrame(); let maxLat = 0;
  for (let i = 0; i < 400; i++) { walk(g, 0, 1, 0.5 * DEG); maxLat = Math.max(maxLat, latLonDeg(g).lat); }
  assert.ok(maxLat > 89.9, `max latitude ${maxLat}`);
  // old code clamped latitude at 1.45 rad = 83.1 deg
  assert.ok(maxLat > 83.2);
});

test('same over the south pole, and sideways over a pole', () => {
  const s = startFrame(); let minLat = 0;
  for (let i = 0; i < 400; i++) { walk(s, 0, -1, 0.5 * DEG); minLat = Math.min(minLat, latLonDeg(s).lat); }
  assert.ok(minLat < -89.9, `min latitude ${minLat}`);
  // go to the north pole region, then walk sideways: must still move (no stuck state)
  const f = startFrame();
  for (let i = 0; i < 178; i++) walk(f, 0, 1, 0.5 * DEG); // ~89 degrees: right at the pole
  const before = f.pos.clone();
  for (let i = 0; i < 40; i++) walk(f, 1, 0, 0.5 * DEG);
  assert.ok(before.angleTo(f.pos) > 19 * DEG, `moved ${before.angleTo(f.pos) / DEG} deg`);
});

test('the controls stay screen-consistent across the pole: after crossing it, W still moves "up the screen" (away from where you were)', () => {
  const f = startFrame();
  for (let i = 0; i < 200; i++) walk(f, 0, 1, 0.5 * DEG); // 100 degrees: just past the pole
  const p0 = f.pos.clone();
  const up0 = f.up.clone();
  walk(f, 0, 1, 1 * DEG);
  // the step went in the direction of the screen-up vector
  const step = f.pos.clone().sub(p0).normalize();
  assert.ok(step.dot(up0) > 0.999, `step . up = ${step.dot(up0)}`);
});

test('invariants hold over a long random walk: |pos| = 1, up is unit and tangent, right-handed frame', () => {
  const f = startFrame();
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 20000; i++) {
    const ix = Math.round(rnd() * 2 - 1), iy = Math.round(rnd() * 2 - 1);
    walk(f, ix, iy, rnd() * 0.05);
  }
  assert.ok(Math.abs(f.pos.length() - 1) < 1e-9, `|pos|=${f.pos.length()}`);
  assert.ok(Math.abs(f.up.length() - 1) < 1e-9, `|up|=${f.up.length()}`);
  assert.ok(Math.abs(f.up.dot(f.pos)) < 1e-9, `up.pos=${f.up.dot(f.pos)}`);
});

test('a full lap (2*pi) along a great circle returns to the start; no input does nothing', () => {
  const f = startFrame();
  for (let i = 0; i < 720; i++) walk(f, 1, 1, (2 * Math.PI) / 720);
  assert.ok(f.pos.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-6);
  const g = startFrame();
  assert.equal(walk(g, 0, 0, 1), null);
  assert.ok(g.pos.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12);
});
