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
  mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081] },
  venus: { a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889], L: [181.9790995, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418] },
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
  jupiter: { a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106] },
  saturn: { a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794] },
  neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664] },
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
  if (id === 'moon') {
    // Mean lunar elements (geocentric, referred to the ecliptic); good to a fraction of a degree.
    const L = (218.3164477 + 481267.88123421 * T) * DEG;
    const peri = (83.3532465 + 4069.0137287 * T) * DEG;
    const node = (125.0445479 - 1934.1362891 * T) * DEG;
    return { a: 384_400, e: 0.0549, I: 5.145 * DEG, w: peri - node, node, M: L - peri };
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

/** Points along a body's orbit (relative to its parent), for drawing the orbit line. */
export function orbitPoints(def: BodyDef, ms: number, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const o = orbitOf(def.id, ms);
  const m = MARS_MOONS[def.id];
  if (!o && !m) return pts;
  const basis = m ? equatorBasis(poleVector(BODY_BY_ID.get('mars')!)) : null;
  for (let i = 0; i < n; i++) {
    const E = (i / n) * Math.PI * 2;
    if (o) {
      pts.push(perifocalToScene(o.a * (Math.cos(E) - o.e), o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E), o.I, o.w, o.node, new THREE.Vector3()));
    } else if (m && basis) {
      const xp = m.a * (Math.cos(E) - m.e), yp = m.a * Math.sqrt(1 - m.e * m.e) * Math.sin(E);
      pts.push(basis[0].clone().multiplyScalar(xp).addScaledVector(basis[1], yp));
    }
  }
  return pts;
}

/** Spin angle about the body's pole, radians. Earth uses the sidereal angle (GMST); others spin from an arbitrary zero. */
export function spinAngle(def: BodyDef, ms: number): number {
  const d = days(ms);
  if (def.id === 'earth') return (((280.46061837 + 360.98564736629 * d) % 360) * DEG);
  const turns = (d * 24) / def.rotationHours;
  return (turns % 1) * Math.PI * 2;
}

const yAxis = new THREE.Vector3(0, 1, 0);
const xAxis = new THREE.Vector3(1, 0, 0);
const tmpQ = new THREE.Quaternion();
const tmpA = new THREE.Vector3();
const tmpT = new THREE.Vector3();

/**
 * Orientation of a body's model (model +Y = north pole): align to the IAU pole, then spin.
 * The Moon is tidally locked: its model's 0 deg longitude (+X in the model) is turned to face Earth.
 */
export function orientation(def: BodyDef, ms: number, out: THREE.Quaternion): THREE.Quaternion {
  out.setFromUnitVectors(yAxis, poleVector(def));
  let spin = spinAngle(def, ms);
  if (def.id === 'moon') {
    const pole = poleVector(def);
    tmpA.copy(xAxis).applyQuaternion(out); // where the prime meridian points with no spin
    localPosition(def, ms, tmpT).negate().normalize(); // direction Moon -> Earth
    spin = Math.atan2(pole.dot(tmpA.clone().cross(tmpT)), tmpA.dot(tmpT));
  }
  return out.multiply(tmpQ.setFromAxisAngle(yAxis, spin));
}
