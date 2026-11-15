// Lunar Trace's viewpoint list: fast travel to the Apollo sites and Earthrise. (Upstream's longer test, written for its own list of flights and craters, is parked in parked/.)
import assert from 'node:assert/strict'
import { HOTSPOTS } from '../src/hotspots.ts'
import { MOMENTS } from '../src/moments.ts'
import { HIDDEN_ENTRIES, PIN_MOMENT, VIEWPOINT_ENTRIES as all, availableEntries, locate, nextPos, prevPos, type NavAction, type NavEntry } from '../src/viewpointList.ts'
import { shortLine } from '../src/ui/viewpointCards.ts'

const hotspotIds = new Set(HOTSPOTS.map((h) => h.id))
assert.deepEqual(all.map((e) => e.name), ['Apollo 17', 'Apollo 11', 'Apollo 12', 'Apollo 14', 'Apollo 15', 'Apollo 16'])
assert.equal(new Set(all.map((e) => e.id)).size, all.length, 'unique row ids')
assert.deepEqual(all.map((e) => e.steps.length), [4, 1, 1, 1, 1, 1], 'Apollo 17 has its eye level and three panoramas; the rest are one flight')
const entry = (name: string): NavEntry => all.find((e) => e.name === name)!
for (const n of ['Apollo 11', 'Apollo 12', 'Apollo 14', 'Apollo 15', 'Apollo 16']) {
  const id = `pin-apollo${n.split(' ')[1]}`
  assert.deepEqual(entry(n).steps.map((s) => s.action), [{ kind: 'pin', id }], `${n} is a hotspot flight`)
  assert.ok(hotspotIds.has(id), `${id} is a hotspot`)
}
assert.deepEqual(entry('Apollo 17').steps.map((s) => s.action), [
  { kind: 'ground', id: 'eye' }, { kind: 'panorama', id: 'alsep' }, { kind: 'panorama', id: 'station4' }, { kind: 'panorama', id: 'station6' },
])
assert.ok(MOMENTS.some((m) => m.id === 'earthrise'), 'the Earthrise flight stays for the Earth button')
for (const [pinId, momentId] of Object.entries(PIN_MOMENT)) assert.ok(hotspotIds.has(pinId) && MOMENTS.some((m) => m.id === momentId), `${pinId} routes to ${momentId}`)
assert.deepEqual(HIDDEN_ENTRIES.map((e) => e.id), ['alps-ridge'], 'the Alps ridge stays hidden, not deleted')

// stepping: Next goes through Apollo 17's steps, then wraps to Apollo 11; Back is the reverse
const a17 = all.findIndex((e) => e.name === 'Apollo 17')
assert.deepEqual(nextPos(all, { entry: a17, step: 3 }), { entry: 1, step: 0 }, 'after the last panorama Next moves on to Apollo 11')
assert.deepEqual(nextPos(all, { entry: all.length - 1, step: 0 }), { entry: 0, step: 0 }, 'the list is a ring: the last step wraps to the first entry')
assert.deepEqual(prevPos(all, { entry: 0, step: 0 }), { entry: all.length - 1, step: 0 })
assert.deepEqual(nextPos(all, null), { entry: 0, step: 0 })
assert.deepEqual(locate(all, { kind: 'pin', id: 'pin-apollo15' }), { entry: all.findIndex((e) => e.id === 'pin-apollo15'), step: 0 })
assert.deepEqual(locate(all, { kind: 'pin', id: 'pin-apollo17' }), { entry: a17, step: -1 }, 'the Apollo 17 pin names its entry with no sub-view')
assert.equal(locate(all, { kind: 'pin', id: 'pin-tycho' }), null, 'Tycho is no longer a viewpoint')

// a step whose data is missing is dropped, and its entry with it
const only = availableEntries(all, (a: NavAction) => a.id === 'pin-apollo15')
assert.deepEqual(only.map((e) => e.name), ['Apollo 15'])

// the card lines
for (const e of all) assert.ok(shortLine(e.id, e.caption).length > 0, `${e.id} has a card line`)
console.log('viewpoint-list (Lunar Trace): ok')
