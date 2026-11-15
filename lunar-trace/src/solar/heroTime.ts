import * as THREE from 'three';
import { BODY_BY_ID } from './bodies.ts';
import { localPosition } from './ephemeris.ts';

/** Cosine of the Moon's elongation from the Sun, seen from Earth (1 = new Moon, -1 = full Moon). */
export function moonElongationCos(ms: number): number {
  const earth = localPosition(BODY_BY_ID.get('earth')!, ms, new THREE.Vector3());
  const moon = localPosition(BODY_BY_ID.get('moon')!, ms, new THREE.Vector3());
  return earth.clone().negate().normalize().dot(moon.normalize());
}

/**
 * The shot looks back at Earth from behind the Moon, so both are lit best near new Moon (Earth then shows ~full). Starting from
 * `from`, return the first time within 20 days when the Moon is within 60 degrees of the Sun; `from` itself if it already is.
 */
export function pickHeroTime(from: number): number {
  for (let h = 0; h <= 20 * 24; h += 6) {
    const t = from + h * 3_600_000;
    if (moonElongationCos(t) >= 0.5) return t;
  }
  return from;
}
