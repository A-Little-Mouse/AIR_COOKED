import { BODY_BY_ID, type BodyDef } from './bodies.ts';
import { CRAFT_BODIES } from './craft.ts';

/** The explorer shows one system: Mars and its two moons, with the landers and rovers on it. (The solar-system world and its planet models were removed.) */
export type WorldId = 'mars';

const MARS_BODY_IDS = ['mars', 'phobos', 'deimos'];
const MARS_CRAFT_IDS = ['viking-1', 'viking-2', 'sojourner', 'spirit', 'opportunity', 'insight', 'ingenuity'];

export function worldFromSearch(_search: string): WorldId {
  return 'mars';
}

/** The bodies the engine loads (the Sun is not one of them: it is drawn as light only). */
export function bodiesOf(_world: WorldId): BodyDef[] {
  return MARS_BODY_IDS.map((id) => BODY_BY_ID.get(id)!);
}

export function craftOf(_world: WorldId): BodyDef[] {
  return MARS_CRAFT_IDS.map((id) => CRAFT_BODIES.find((c) => c.id === id)!);
}

/** List order: Mars, its landers, then its moons. */
export function listOf(world: WorldId): BodyDef[] {
  const [mars, ...moons] = bodiesOf(world);
  return [mars, ...craftOf(world), ...moons];
}

export function resolveStartId(world: WorldId, hashId: string | null): string {
  return hashId && listOf(world).some((b) => b.id === hashId) ? hashId : 'mars';
}

/** Bodies that are drawn and light the scene but are not listed, labelled or clickable: the Sun. */
export function lightOnlyOf(_world: WorldId): BodyDef[] {
  return [BODY_BY_ID.get('sun')!];
}

