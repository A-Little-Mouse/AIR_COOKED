export type BodyType = 'star' | 'planet' | 'moon' | 'lander' | 'satellite';

// Where a lander sits on its planet (latitude and longitude).
export type CraftSite = { kind: 'surface'; latDeg: number; lonDeg: number };

export interface BodyDef {
  id: string;
  name: string;
  type: BodyType;
  model: string;
  // Size of the body, in km.
  radiusKm: number;
  // The body it orbits (null for the Sun and Mars).
  parent: string | null;
  // Which way its north pole points.
  pole: { ra: number; dec: number };
  // Hours for one spin.
  rotationHours: number;
  // How far the camera stops from it, in body radii.
  viewRadii: number;
  // Moons only: labels show when the camera is this close to the planet (km).
  labelRangeKm?: number;
  info: string;
  // Landers only: where it stands.
  craft?: CraftSite;
  // Extra facts to show (landers).
  facts?: Array<[string, string]>;
}

// The Sun, Mars and its two moons.
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

// Every body, each planet followed by its landers.
export const ALL_BODIES: BodyDef[] = BODIES.flatMap((b) => [b, ...CRAFT_BODIES.filter((c) => c.parent === b.id)]);
export const BODY_BY_ID = new Map(ALL_BODIES.map((b) => [b.id, b]));
