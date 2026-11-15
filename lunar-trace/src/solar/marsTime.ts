import * as THREE from 'three';
import { BODY_BY_ID } from './bodies.ts';
import { localPosition, poleVector } from './ephemeris.ts';

// Settings for the Mars page's main shot: the camera sits just off Phobos looking at Mars.
export const PHOBOS_CAMERA_KM = 300; // distance from the camera to Phobos
export const PHOBOS_OFFSET_DEG = -18; // turns the camera so Phobos appears left of Mars
export const SHOT_PHASE_DEG = 70; // how lit Mars should look (about three-quarters)

// Three directions that describe the shot: toward Phobos, Mars' north, and sideways.
export interface PhobosFrame { e1: THREE.Vector3; e2: THREE.Vector3; e3: THREE.Vector3 }

// Builds those three directions from where Phobos and Mars' pole are.
export function phobosFrame(phobosRel: THREE.Vector3, pole: THREE.Vector3, out: PhobosFrame): PhobosFrame {
  out.e1.copy(phobosRel).normalize();
  out.e2.copy(pole).addScaledVector(out.e1, -pole.dot(out.e1)).normalize();
  out.e3.crossVectors(out.e1, out.e2);
  return out;
}

const newFrame = (): PhobosFrame => ({ e1: new THREE.Vector3(), e2: new THREE.Vector3(), e3: new THREE.Vector3() });

// Returns how lit Mars looks in the shot and which side the Sun is on.
export function shotLighting(ms: number): { phaseDeg: number; sunSide: number } {
  const mars = BODY_BY_ID.get('mars')!;
  const m = localPosition(mars, ms, new THREE.Vector3());
  const rel = localPosition(BODY_BY_ID.get('phobos')!, ms, new THREE.Vector3());
  const f = phobosFrame(rel, poleVector(mars), newFrame());
  const sun = m.clone().negate().normalize(); // direction from Mars to the Sun
  return { phaseDeg: Math.acos(THREE.MathUtils.clamp(sun.dot(f.e1), -1, 1)) * 180 / Math.PI, sunSide: sun.dot(f.e3) < 0 ? 1 : -1 };
}

// Finds the next time (within 8 hours) when Mars is lit the way the shot needs.
export function pickPhobosTime(from: number): number {
  let best = from, bestErr = Infinity;
  for (let min = 0; min <= 8 * 60; min += 3) {
    const t = from + min * 60_000;
    const { phaseDeg, sunSide } = shotLighting(t);
    const err = sunSide === 1 ? Math.abs(phaseDeg - SHOT_PHASE_DEG) : 180;
    if (err <= 3) return t;
    if (err < bestErr) { bestErr = err; best = t; }
  }
  return best;
}
