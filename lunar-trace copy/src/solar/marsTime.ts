import * as THREE from 'three';
import { BODY_BY_ID } from './bodies.ts';
import { localPosition, poleVector } from './ephemeris.ts';

/**
 * The Mars page's held shot: the camera sits just off Phobos, looking at Mars with the moon in front of its limb (the planet large on one side, the text on the other).
 * Frame, in Mars-centred axes: e1 = from Mars out to Phobos, e2 = Mars' north (made perpendicular to e1), e3 = e1 x e2.
 */
export const PHOBOS_CAMERA_KM = 300; // how far the camera stands from Phobos
export const PHOBOS_OFFSET_DEG = -18; // the camera is turned this far round Phobos from the Mars-Phobos line, so Phobos stands left of Mars' centre
export const SHOT_PHASE_DEG = 70; // the phase of Mars in the shot (Sun-Mars-camera angle): a lit gibbous face with the terminator on the left

export interface PhobosFrame { e1: THREE.Vector3; e2: THREE.Vector3; e3: THREE.Vector3 }

export function phobosFrame(phobosRel: THREE.Vector3, pole: THREE.Vector3, out: PhobosFrame): PhobosFrame {
  out.e1.copy(phobosRel).normalize();
  out.e2.copy(pole).addScaledVector(out.e1, -pole.dot(out.e1)).normalize();
  out.e3.crossVectors(out.e1, out.e2);
  return out;
}

const newFrame = (): PhobosFrame => ({ e1: new THREE.Vector3(), e2: new THREE.Vector3(), e3: new THREE.Vector3() });

/** Angle (deg) at Mars between the Phobos side (where the camera is) and the Sun, and which side of the picture the Sun is on (+1 right, -1 left). */
export function shotLighting(ms: number): { phaseDeg: number; sunSide: number } {
  const mars = BODY_BY_ID.get('mars')!;
  const m = localPosition(mars, ms, new THREE.Vector3());
  const rel = localPosition(BODY_BY_ID.get('phobos')!, ms, new THREE.Vector3());
  const f = phobosFrame(rel, poleVector(mars), newFrame());
  const sun = m.clone().negate().normalize(); // Mars -> Sun
  return { phaseDeg: Math.acos(THREE.MathUtils.clamp(sun.dot(f.e1), -1, 1)) * 180 / Math.PI, sunSide: sun.dot(f.e3) < 0 ? 1 : -1 };
}

/** From `from`, the first moment within one Phobos orbit (7.7 hours) when the shot is lit as above with the Sun on the right (`from` itself if it already is). */
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
