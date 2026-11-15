import * as THREE from 'three';
import type { BodyDef } from './bodies.ts';

const DEG = Math.PI / 180;

// Builds the data for one lander.
const lander = (id: string, name: string, parent: string, model: string, radiusKm: number, latDeg: number, lonDeg: number, site: string, info: string): BodyDef => ({
  id, name, type: 'lander', model: `/models/${model}.glb`, radiusKm, parent, pole: { ra: 0, dec: 90 }, rotationHours: 0, viewRadii: 4, labelRangeKm: parent === 'moon' ? 6e4 : 2.5e5,
  craft: { kind: 'surface', latDeg, lonDeg }, info,
  facts: [['Site', site], ['Position', `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? 'N' : 'S'}, ${lonDeg.toFixed(2)}°E`]],
});

// The landers and rovers on Mars (size is half the model's longest side).
export const CRAFT_BODIES: BodyDef[] = [
  lander('viking-1', 'Viking 1 Lander', 'mars', 'craft/landers-rovers/viking-lander', 0.0018, 22.5, 312.0, 'Chryse Planitia',
    'Touched down on 20 July 1976 and sent the first pictures from the surface of Mars. It worked for over six years.'),
  lander('viking-2', 'Viking 2 Lander', 'mars', 'craft/landers-rovers/viking-lander', 0.0018, 48.27, 134.0, 'Utopia Planitia',
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
];

// Turns a latitude and longitude into a direction on Mars (the Mars model is turned 180° so it lines up).
export function surfaceDirection(_parentId: string, latDeg: number, lonDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const lat = latDeg * DEG, lon = lonDeg * DEG, c = Math.cos(lat);
  return out.set(-c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon));
}
