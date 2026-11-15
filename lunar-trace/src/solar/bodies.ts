export type BodyType = 'star' | 'planet' | 'moon' | 'lander' | 'satellite';

/** Where a spacecraft model sits. Landers ride on their parent's surface; satellites circle it; ACE hangs at Sun-Earth L1. */
export type CraftSite =
  | { kind: 'surface'; latDeg: number; lonDeg: number }
  | { kind: 'orbit'; altKm: number; incDeg: number; raanDeg: number; phaseDeg: number }
  | { kind: 'l1'; distKm: number };

export interface BodyDef {
  id: string;
  name: string;
  type: BodyType;
  model: string;
  /** Equatorial radius, km. Scene units are kilometres, so this is also the rendered radius. */
  radiusKm: number;
  /** Body this one orbits; null = orbits the Sun (or is the Sun). */
  parent: string | null;
  /** Mesh whose bounds define the size (models with rings etc.). */
  sizeFrom?: string;
  /** Has rings: approach from the sunlit ring face, above the equatorial plane. */
  ringed?: boolean;
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

/** Bodies with models available. Order = list order. (Uranus: no model supplied, so it is not included.) */
export const BODIES: BodyDef[] = [
  {
    id: 'sun', name: 'Sun', type: 'star', model: '/models/sun.glb', radiusKm: 695_700, parent: null,
    pole: { ra: 286.13, dec: 63.87 }, rotationHours: 609.12, viewRadii: 3.2,
    info: "A G-type main-sequence star that holds about 99.86% of the Solar System's mass. Its gravity keeps every planet in orbit.",
  },
  {
    id: 'mercury', name: 'Mercury', type: 'planet', model: '/models/mercury.glb', radiusKm: 2_439.7, parent: null,
    pole: { ra: 281.01, dec: 61.41 }, rotationHours: 1407.6, viewRadii: 4.5,
    info: 'The smallest planet and the closest to the Sun. With almost no atmosphere, its surface swings from scorching days to freezing nights.',
  },
  {
    id: 'venus', name: 'Venus', type: 'planet', model: '/models/venus.glb', radiusKm: 6_051.8, parent: null,
    pole: { ra: 272.76, dec: 67.16 }, rotationHours: -5832.5, viewRadii: 4.5,
    info: 'A rocky planet wrapped in thick carbon-dioxide clouds. A runaway greenhouse effect makes it the hottest planet, and it spins backwards, very slowly.',
  },
  {
    id: 'earth', name: 'Earth', type: 'planet', model: '/models/earth.glb', radiusKm: 6_378.137, parent: null,
    pole: { ra: 0, dec: 90 }, rotationHours: 23.9344696, viewRadii: 4.5,
    info: 'Our home planet and the only world known to harbour life. About 71% of its surface is covered by liquid water.',
  },
  {
    id: 'moon', name: 'Moon', type: 'moon', model: '/models/moon.glb', radiusKm: 1_737.4, parent: 'earth',
    pole: { ra: 269.9949, dec: 66.5392 }, rotationHours: 655.728, viewRadii: 4.5, labelRangeKm: 2e7,
    info: "Earth's only natural satellite. It is tidally locked, always showing the same face to Earth, and it drives the ocean tides.",
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
  {
    id: 'jupiter', name: 'Jupiter', type: 'planet', model: '/models/jupiter.glb', radiusKm: 71_492, parent: null,
    pole: { ra: 268.0566, dec: 64.4953 }, rotationHours: 9.925, viewRadii: 4.5,
    info: "The largest planet: a gas giant with more than twice the mass of all the other planets combined. Its Great Red Spot is a storm wider than Earth.",
  },
  {
    id: 'saturn', name: 'Saturn', type: 'planet', model: '/models/saturn.glb', sizeFrom: 'Saturn.001', ringed: true, radiusKm: 60_268, parent: null,
    pole: { ra: 40.589, dec: 83.537 }, rotationHours: 10.656, viewRadii: 7,
    info: 'A gas giant famous for its bright rings of ice and rock. It is the least dense planet: it would float in a big enough bathtub.',
  },
  {
    id: 'neptune', name: 'Neptune', type: 'planet', model: '/models/neptune.glb', radiusKm: 24_764, parent: null,
    pole: { ra: 299.36, dec: 43.46 }, rotationHours: 16.11, viewRadii: 4.5,
    info: 'The most distant planet: a cold ice giant with supersonic winds. One trip around the Sun takes about 165 years.',
  },
];

import { CRAFT_BODIES } from './craft.ts';

/** Planets/moons first, each followed by the spacecraft that sit on or around it. Order = list order. */
export const ALL_BODIES: BodyDef[] = BODIES.flatMap((b) => [b, ...CRAFT_BODIES.filter((c) => c.parent === b.id)]);
export const BODY_BY_ID = new Map(ALL_BODIES.map((b) => [b.id, b]));
