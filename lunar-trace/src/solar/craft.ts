import * as THREE from 'three';
import type { BodyDef, CraftSite } from './bodies.ts';
import { equatorialToScene } from './frames.ts';

const DEG = Math.PI / 180;
const MU_EARTH = 398_600.4418; // km^3/s^2
const EARTH_R = 6378.137;
const L1_KM = 1_500_000;

const lander = (id: string, name: string, parent: string, model: string, radiusKm: number, latDeg: number, lonDeg: number, site: string, info: string): BodyDef => ({
  id, name, type: 'lander', model: `/models/${model}.glb`, radiusKm, parent, pole: { ra: 0, dec: 90 }, rotationHours: 0, viewRadii: 4, labelRangeKm: parent === 'moon' ? 6e4 : 2.5e5,
  craft: { kind: 'surface', latDeg, lonDeg }, info,
  facts: [['Site', site], ['Position', `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? 'N' : 'S'}, ${lonDeg.toFixed(2)}°E`]],
});
const orbiter = (id: string, name: string, model: string, radiusKm: number, altKm: number, incDeg: number, raanDeg: number, phaseDeg: number, info: string): BodyDef => ({
  id, name, type: 'satellite', model: `/models/${model}.glb`, radiusKm, parent: 'earth', pole: { ra: 0, dec: 90 }, rotationHours: 0, viewRadii: 4, labelRangeKm: 1.5e5,
  craft: { kind: 'orbit', altKm, incDeg, raanDeg, phaseDeg },
  info: `${info} Shown at its real altitude and inclination; its position along the orbit is illustrative.`,
  facts: [['Orbit', `${altKm} km altitude · ${incDeg}° inclination`], ['Period', `${(2 * Math.PI * Math.sqrt((EARTH_R + altKm) ** 3 / MU_EARTH) / 60).toFixed(0)} min`]],
});

/** Spacecraft models placed in the solar system. radiusKm = half the model's longest dimension (approximate, true scale). */
export const CRAFT_BODIES: BodyDef[] = [
  lander('apollo-11-lm', 'Apollo 11 Lunar Module', 'moon', 'apollo-lunar-module', 0.0047, 0.674, 23.473, 'Tranquility Base, Mare Tranquillitatis',
    'Eagle landed here on 20 July 1969. Its descent stage and the first footprints are still there.'),
  lander('apollo-15-lrv', 'Lunar Roving Vehicle', 'moon', 'craft/landers-rovers/lunar-roving-vehicle', 0.0016, 26.132, 3.629, 'Apollo 15, Hadley–Apennine',
    'The battery-powered rover driven by Apollo 15 astronauts in 1971, parked at the end of their last drive. Apollo 16 and 17 left rovers too.'),
  lander('viking-1', 'Viking 1 Lander', 'mars', 'viking-lander', 0.0018, 22.5, 312.0, 'Chryse Planitia',
    'Touched down on 20 July 1976 and sent the first pictures from the surface of Mars. It worked for over six years.'),
  lander('viking-2', 'Viking 2 Lander', 'mars', 'viking-lander', 0.0018, 48.27, 134.0, 'Utopia Planitia',
    'Touched down on 3 September 1976, the second Viking lander. It photographed frost on the ground and worked until 1980.'),
  lander('sojourner','Sojourner Rover', 'mars', 'craft/landers-rovers/sojourner-rover', 0.0003, 19.33, 326.45, 'Ares Vallis (Mars Pathfinder)',
    'The first wheeled vehicle to drive on Mars, in 1997. Only about 65 cm long, it was tethered to its lander and drove a few metres around it.'),
  lander('spirit', 'Spirit', 'mars', 'craft/landers-rovers/spirit-opportunity-rover', 0.0012, -14.57, 175.47, 'Gusev Crater',
    'A Mars Exploration Rover that landed in January 2004. It found evidence of past water and stopped communicating in 2010.'),
  lander('opportunity', 'Opportunity', 'mars', 'craft/landers-rovers/spirit-opportunity-rover', 0.0012, -1.95, 354.47, 'Meridiani Planum',
    'Spirit\'s twin landed in January 2004 and kept driving for almost 15 years, until a global dust storm silenced it in 2018.'),
  lander('insight', 'InSight Lander', 'mars', 'craft/landers-rovers/insight-lander', 0.003, 4.5, 135.62, 'Elysium Planitia',
    'Landed in November 2018 and listened to marsquakes to map the planet\'s interior. The mission ended in December 2022.'),
  lander('ingenuity', 'Ingenuity Helicopter', 'mars', 'craft/landers-rovers/ingenuity-helicopter', 0.0006, 18.44, 77.45, 'Jezero Crater',
    'Flew the first powered, controlled flight on another planet in April 2021, then kept flying for almost three years.'),
  orbiter('aqua', 'Aqua', 'craft/satellites/aqua-a', 0.0085, 705, 98.2, 30, 0, 'Earth-observing satellite launched in 2002 that tracks the water cycle: oceans, clouds, ice and rainfall.'),
  orbiter('aquarius', 'Aquarius / SAC-D', 'craft/satellites/aquarius-a', 0.003, 657, 98.0, 110, 120, 'Mapped sea-surface salinity from 2011 until the satellite failed in 2015.'),
  orbiter('aim', 'AIM', 'craft/satellites/aim', 0.0015, 600, 97.8, 200, 240, 'Aeronomy of Ice in the Mesosphere studies night-shining clouds high in the atmosphere. Launched in 2007.'),
  orbiter('acrimsat', 'ACRIMSAT', 'craft/satellites/acrimsat-a', 0.0007, 685, 98.1, 280, 60, 'Measured the total energy the Sun delivers to Earth. Launched in 1999.'),
  {
    id: 'ace', name: 'Advanced Composition Explorer', type: 'satellite', model: '/models/craft/satellites/ace.glb', radiusKm: 0.0025, parent: 'earth',
    pole: { ra: 0, dec: 90 }, rotationHours: 0, viewRadii: 4, labelRangeKm: 6e6, craft: { kind: 'l1', distKm: L1_KM },
    info: 'Launched in 1997 and parked near the Sun–Earth L1 point, about 1.5 million km sunward of Earth, to sample the solar wind and cosmic particles. It still gives warning of solar storms.',
    facts: [['Position', 'Sun–Earth L1, ~1.5 million km']],
  },
];

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** Direction of a surface point in a body's model space. Moon/Earth models put longitude 0 on +X with east toward -Z; the Mars model is turned 180° about Y. */
export function surfaceDirection(parentId: string, latDeg: number, lonDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const lat = latDeg * DEG, lon = lonDeg * DEG, c = Math.cos(lat);
  return parentId === 'mars'
    ? out.set(-c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon))
    : out.set(c * Math.cos(lon), Math.sin(lat), -c * Math.sin(lon));
}

/** Circular Earth orbit: equatorial inertial frame -> scene axes. `u` = argument of latitude, radians. */
function orbitPoint(s: Extract<CraftSite, { kind: 'orbit' }>, u: number, out: THREE.Vector3): THREE.Vector3 {
  const r = EARTH_R + s.altKm, i = s.incDeg * DEG, O = s.raanDeg * DEG;
  const x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.cos(i) * Math.sin(u));
  const y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.cos(i) * Math.sin(u));
  const z = r * Math.sin(i) * Math.sin(u);
  return equatorialToScene(x, y, z, out);
}

export function orbitLinePoints(s: Extract<CraftSite, { kind: 'orbit' }>, n = 180): THREE.Vector3[] {
  return Array.from({ length: n }, (_, k) => orbitPoint(s, (k / n) * Math.PI * 2, new THREE.Vector3()));
}

/** Position (relative to Earth) and attitude (model +Y pointing away from Earth) of an orbiting craft at `ms` since J2000. */
export function placeOrbiter(s: Extract<CraftSite, { kind: 'orbit' }>, ms: number, j2000Ms: number, pos: THREE.Vector3, q: THREE.Quaternion): void {
  const a = EARTH_R + s.altKm;
  const n = Math.sqrt(MU_EARTH / (a * a * a)); // rad/s
  const u = s.phaseDeg * DEG + n * ((ms - j2000Ms) / 1000);
  orbitPoint(s, u, pos);
  q.copy(tmpQ.setFromUnitVectors(tmpA.set(0, 1, 0), tmpB.copy(pos).normalize()));
}

/** L1: on the Earth->Sun line. `earthPos` is Earth's heliocentric position. */
export function placeL1(s: Extract<CraftSite, { kind: 'l1' }>, earthPos: THREE.Vector3, pos: THREE.Vector3): void {
  pos.copy(earthPos).normalize().multiplyScalar(-s.distKm);
}
