import * as THREE from 'three';

/**
 * Walking on a sphere without latitude/longitude, so there are no poles and no walls.
 * The player is a point on the unit sphere (`pos`) plus the direction that is "up the screen" (`up`, a unit vector tangent to
 * the sphere there). The camera looks at the sphere's centre from `pos` with `up` as its up vector, so screen-right is
 * (-pos) x up. Walking rotates both `pos` and `up` about the same axis (parallel transport): W always moves up the screen and
 * D to the right, at the equator, at the poles, everywhere.
 */
export interface WalkFrame { pos: THREE.Vector3; up: THREE.Vector3 }

export const startFrame = (): WalkFrame => ({ pos: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) });

const tmp = new THREE.Vector3();

/** Unit vector pointing to the right of the screen, tangent to the sphere. */
export function screenRight(f: WalkFrame, out = new THREE.Vector3()): THREE.Vector3 {
  return out.crossVectors(tmp.copy(f.pos).negate(), f.up).normalize();
}

/**
 * Walk `angle` radians along the great circle in screen direction (ix = right, iy = up; each -1, 0 or 1).
 * Updates the frame in place and returns the world-space walking direction (tangent at the NEW position), or null if no input.
 */
export function walk(f: WalkFrame, ix: number, iy: number, angle: number): THREE.Vector3 | null {
  if (ix === 0 && iy === 0) return null;
  const motion = screenRight(f).multiplyScalar(ix).addScaledVector(f.up, iy).normalize();
  const axis = new THREE.Vector3().crossVectors(f.pos, motion).normalize(); // d(pos)/d(angle) = axis x pos = motion
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  f.pos.applyQuaternion(q).normalize();
  f.up.applyQuaternion(q);
  f.up.addScaledVector(f.pos, -f.up.dot(f.pos)).normalize(); // keep it tangent and unit length despite rounding
  return motion.applyQuaternion(q);
}

/** Latitude / longitude in degrees (display / debugging only; lon 0 = +Z, increasing toward +X). */
export function latLonDeg(f: WalkFrame): { lat: number; lon: number } {
  return { lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(f.pos.y, -1, 1))), lon: THREE.MathUtils.radToDeg(Math.atan2(f.pos.x, f.pos.z)) };
}
