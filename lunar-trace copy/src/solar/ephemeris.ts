import * as THREE from 'three';
import { BODY_BY_ID, type BodyDef } from './bodies.ts';

/**
 * Approximate positions: JPL "Keplerian elements for approximate positions of the major planets" (valid 1800-2050,
 * accuracy of arc-minutes), the Moon from mean lunar elements, and Phobos/Deimos as Keplerian orbits in Mars's
 * equatorial plane (their phase at J2000 is arbitrary). Scene units are km, Y is ecliptic north.
 */
export const AU_KM = 149_597_870.7;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_MS = 86_400_000;
const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;

type Rate = [number, number]; // [value at J2000, change per Julian century]
interface Elements { a: Rate; e: Rate; I: Rate; L: Rate; peri: Rate; node: Rate }

const PLANETS: Record<string, Elements> = {
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
};

const MARS_MOONS: Record<string, { a: number; e: number; periodDays: number }> = {
  phobos: { a: 9_376, e: 0.0151, periodDays: 0.31891 },
  deimos: { a: 23_463, e: 0.00033, periodDays: 1.26244 },
};

const centuries = (ms: number) => (ms - J2000_MS) / (DAY_MS * 36525);
const days = (ms: number) => (ms - J2000_MS) / DAY_MS;
const at = (r: Rate, T: number) => r[0] + r[1] * T;

/** Solve Kepler's equation M = E - e sin E (M in radians). */
export function solveKepler(M: number, e: number): number {
  const twoPi = Math.PI * 2;
  M = ((((M + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

/** Orbit-plane point -> ecliptic J2000 -> scene axes (ecliptic x,y,z -> scene x,z,-y). Angles in radians. */
function perifocalToScene(xp: number, yp: number, I: number, w: number, node: number, out: THREE.Vector3): THREE.Vector3 {
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  return out.set(x, z, -y);
}

interface Orbit { a: number; e: number; I: number; w: number; node: number; M: number }

function orbitOf(id: string, ms: number): Orbit | null {
  const T = centuries(ms);
  const el = PLANETS[id];
  if (el) {
    const node = at(el.node, T) * DEG;
    const peri = at(el.peri, T) * DEG;
    return { a: at(el.a, T) * AU_KM, e: at(el.e, T), I: at(el.I, T) * DEG, w: peri - node, node, M: at(el.L, T) * DEG - peri };
  }
  return null;
}

const poleCache = new Map<string, THREE.Vector3>();
/** North pole direction in scene axes, from IAU right ascension / declination. */
export function poleVector(def: BodyDef): THREE.Vector3 {
  const c = poleCache.get(def.id);
  if (c) return c;
  const ra = def.pole.ra * DEG, dec = def.pole.dec * DEG;
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  const xe = x, ye = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY), ze = -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
  const v = new THREE.Vector3(xe, ze, -ye).normalize();
  poleCache.set(def.id, v);
  return v;
}

/** In-plane basis (u, v) of the equatorial plane of a body, from its pole. */
function equatorBasis(pole: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const ref = Math.abs(pole.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const u = ref.sub(pole.clone().multiplyScalar(ref.dot(pole))).normalize();
  return [u, new THREE.Vector3().crossVectors(pole, u)];
}

/** Position relative to the parent body (the Sun for planets), km, scene axes. */
export function localPosition(def: BodyDef, ms: number, out: THREE.Vector3): THREE.Vector3 {
  if (def.id === 'sun') return out.set(0, 0, 0);
  const o = orbitOf(def.id, ms);
  if (o) {
    const E = solveKepler(o.M, o.e);
    return perifocalToScene(o.a * (Math.cos(E) - o.e), o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E), o.I, o.w, o.node, out);
  }
  const m = MARS_MOONS[def.id];
  if (m) {
    const [u, v] = equatorBasis(poleVector(BODY_BY_ID.get('mars')!));
    const M = (2 * Math.PI * days(ms)) / m.periodDays;
    const E = solveKepler(M, m.e);
    const xp = m.a * (Math.cos(E) - m.e), yp = m.a * Math.sqrt(1 - m.e * m.e) * Math.sin(E);
    return out.copy(u).multiplyScalar(xp).addScaledVector(v, yp);
  }
  return out.set(0, 0, 0);
}

/** Spin angle about the body's pole, radians, from an arbitrary zero. */
export function spinAngle(def: BodyDef, ms: number): number {
  const d = days(ms);
  const turns = (d * 24) / def.rotationHours;
  return (turns % 1) * Math.PI * 2;
}

const yAxis = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();

/**
 * Orientation of a body's model (model +Y = north pole): align to the IAU pole, then spin.
 */
export function orientation(def: BodyDef, ms: number, out: THREE.Quaternion): THREE.Quaternion {
  out.setFromUnitVectors(yAxis, poleVector(def));
  const spin = spinAngle(def, ms);
  return out.multiply(tmpQ.setFromAxisAngle(yAxis, spin));
}
