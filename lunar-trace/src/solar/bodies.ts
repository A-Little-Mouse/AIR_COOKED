export type BodyType = 'star' | 'planet' | 'moon' | 'lander' | 'satellite';

/** Where a spacecraft model sits: landers ride on their parent's surface. */
export type CraftSite = { kind: 'surface'; latDeg: number; lonDeg: number };

export interface BodyDef {
  id: string;
  name: string;
  type: BodyType;
  model: string;
  /** Equatorial radius, km. Scene units are kilometres, so this is also the rendered radius. */
  radiusKm: number;
  /** Body this one orbits; null = orbits the Sun (or is the Sun). */
  parent: string | null;
  /** IAU north pole, J2000 equatorial coordinates, degrees. */
  pole: { ra: number; dec: number };
  /** Sidereal rotation period in hours; negative = retrograde. */
  rotationHours: number;
  /** Camera distance from the body's centre, in radii, when you travel to it. */
  viewRadii: number;
  /** Moons only: labels/orbit lines show when the camera is within this many km of the parent. */
  labelRangeKm?: number;
  info: string;
  /** Spacecraft only (type 'lander' | 'satellite'): placement. */
  craft?: CraftSite;
  /** Extra rows for the info card (spacecraft). */
  facts?: Array<[string, string]>;
}

/** The bodies of the Mars explorer: the Sun (light only), Mars and its two moons. Order = list order. */
export const BODIES: BodyDef[] = [
  {
    id: 'sun', name: 'Sun', type: 'star', model: '/models/sun.glb', radiusKm: 695_700, parent: null,
    pole: { ra: 286.13, dec: 63.87 }, rotationHours: 609.12, viewRadii: 3.2,
    info: "A G-type main-sequence star that holds about 99.86% of the Solar System's mass. Its gravity keeps every planet in orbit.",
  },
  {
    id: 'mars', name: 'Mars', type: 'planet', model: '/models/mars.glb', radiusKm: 3_396.2, parent: null,
    pole: { ra: 317.269, dec: 54.4325 }, rotationHours: 24.6229, viewRadii: 4.5,
    info: "A cold desert world with the tallest volcano and the deepest canyon in the Solar System. Its axial tilt gives it seasons much like Earth's.",
  },
  {
    id: 'phobos', name: 'Phobos', type: 'moon', model: '/models/phobos.glb', radiusKm: 13.4, parent: 'mars',
    pole: { ra: 317.269, dec: 54.4325 }, rotationHours: 7.6534, viewRadii: 4.5, labelRangeKm: 1.5e6,
    info: 'The larger, inner moon of Mars, a heavily cratered lump. It orbits faster than Mars spins, so it rises in the west and sets in the east.',
  },
  {
    id: 'deimos', name: 'Deimos', type: 'moon', model: '/models/deimos.glb', radiusKm: 7.5, parent: 'mars',
    pole: { ra: 317.269, dec: 54.4325 }, rotationHours: 30.2985, viewRadii: 4.5, labelRangeKm: 1.5e6,
    info: 'The smaller, outer moon of Mars: a dark, irregular body that takes about 30 hours to circle the planet.',
  },
];

import { CRAFT_BODIES } from './craft.ts';

/** Planets/moons first, each followed by the spacecraft that sit on or around it. Order = list order. */
export const ALL_BODIES: BodyDef[] = BODIES.flatMap((b) => [b, ...CRAFT_BODIES.filter((c) => c.parent === b.id)]);
export const BODY_BY_ID = new Map(ALL_BODIES.map((b) => [b.id, b]));
