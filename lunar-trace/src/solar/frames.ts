import * as THREE from 'three';

export const OBLIQUITY_RAD = 23.4392911 * (Math.PI / 180);

/** Equatorial J2000 vector -> scene axes (equatorial -> ecliptic by the obliquity, then ecliptic x,y,z -> scene x,z,-y). */
export function equatorialToScene(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const ye = y * Math.cos(OBLIQUITY_RAD) + z * Math.sin(OBLIQUITY_RAD), ze = -y * Math.sin(OBLIQUITY_RAD) + z * Math.cos(OBLIQUITY_RAD);
  return out.set(x, ze, -ye);
}
