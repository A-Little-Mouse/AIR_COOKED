/**
 * Which gazetteer features each viewpoint (navigator entry, src/viewpointList.ts) already names in its pill, so the centre caption does not repeat them.
 * Explicit, by feature id: a name match would equate "Mons Hadley" with "Hadley Rille" and "Rimae Plato" with "Plato". Entries that name no feature
 * (View from Earth, Fly around the Moon, Earthrise, Long shadows at the terminator, The Moon behind a ridge, the Apollo landing sites) are absent.
 */
// Lunar Trace's list is the Apollo landing sites only, which name no feature, so the table is empty.
export const VIEWPOINT_FEATURES: Readonly<Record<string, readonly string[]>> = {}
