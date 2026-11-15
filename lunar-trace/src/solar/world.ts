import { ALL_BODIES, BODIES, BODY_BY_ID, type BodyDef } from './bodies.ts';
import { CRAFT_BODIES } from './craft.ts';

/** Which set of bodies an explorer page shows: the whole solar system, or only Mars and its moons with the landers on it. */
export type WorldId = 'solar' | 'mars';

const MARS_BODY_IDS = ['mars', 'phobos', 'deimos'];
const MARS_CRAFT_IDS = ['viking-1', 'viking-2', 'sojourner', 'spirit', 'opportunity', 'insight', 'ingenuity'];

export function worldFromSearch(search: string): WorldId {
  return new URLSearchParams(search).get('world') === 'mars' ? 'mars' : 'solar';
}

/** The bodies the engine loads (the Sun is not one of them in the Mars world). */
export function bodiesOf(world: WorldId): BodyDef[] {
  return world === 'mars' ? MARS_BODY_IDS.map((id) => BODY_BY_ID.get(id)!) : BODIES;
}

export function craftOf(world: WorldId): BodyDef[] {
  return world === 'mars' ? MARS_CRAFT_IDS.map((id) => CRAFT_BODIES.find((c) => c.id === id)!) : CRAFT_BODIES;
}

/** List order: Mars, its landers, then its moons. */
export function listOf(world: WorldId): BodyDef[] {
  if (world !== 'mars') return ALL_BODIES;
  const [mars, ...moons] = bodiesOf('mars');
  return [mars, ...craftOf('mars'), ...moons];
}

export function resolveStartId(world: WorldId, hashId: string | null): string {
  return hashId && listOf(world).some((b) => b.id === hashId) ? hashId : world === 'mars' ? 'mars' : 'sun';
}

/** Bodies that are drawn and light the scene but are not listed, labelled or clickable: the Sun in the Mars world. */
export function lightOnlyOf(world: WorldId): BodyDef[] {
  return world === 'mars' ? [BODY_BY_ID.get('sun')!] : [];
}
