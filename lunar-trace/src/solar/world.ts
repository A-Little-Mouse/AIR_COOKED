import { BODY_BY_ID, type BodyDef } from './bodies.ts';
import { CRAFT_BODIES } from './craft.ts';

// The explorer shows one system: Mars, its two moons and the landers on it.
export type WorldId = 'mars';

const MARS_BODY_IDS = ['mars', 'phobos', 'deimos'];
const MARS_CRAFT_IDS = ['viking-1', 'viking-2', 'sojourner', 'spirit', 'opportunity', 'insight', 'ingenuity'];

export function worldFromSearch(_search: string): WorldId {
  return 'mars';
}

export function bodiesOf(_world: WorldId): BodyDef[] {
  return MARS_BODY_IDS.map((id) => BODY_BY_ID.get(id)!);
}

export function craftOf(_world: WorldId): BodyDef[] {
  return MARS_CRAFT_IDS.map((id) => CRAFT_BODIES.find((c) => c.id === id)!);
}

// Returns the Places list: Mars, then its landers, then its moons.
export function listOf(world: WorldId): BodyDef[] {
  const [mars, ...moons] = bodiesOf(world);
  return [mars, ...craftOf(world), ...moons];
}

// Picks the body to start on, falling back to Mars.
export function resolveStartId(world: WorldId, hashId: string | null): string {
  return hashId && listOf(world).some((b) => b.id === hashId) ? hashId : 'mars';
}

// Returns the Sun, which lights the scene but isn't listed or clickable.
export function lightOnlyOf(_world: WorldId): BodyDef[] {
  return [BODY_BY_ID.get('sun')!];
}

