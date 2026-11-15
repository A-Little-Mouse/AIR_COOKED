// The modelled arrival before the descent track (descent/approach.ts, DescentPath.sampleApproach): one continuous path from about 3,000 km up to the track's own orbit.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Quaternion, Vector3 } from 'three'
import { DescentPath, type TrackDoc } from '../src/descent/DescentPath.ts'
import { APPROACH_T0, BURN_T0, COAST_T0, JOIN_T, SPS_ACCEL, burnLevel } from '../src/descent/approach.ts'

const path = DescentPath.fromDoc(JSON.parse(readFileSync(new URL('../data/apollo17/descent-track.json', import.meta.url), 'utf8')) as TrackDoc)
const RS = 1734774, R = 1737400, MU = 4.9028e12
const alt = (p: number[]): number => Math.hypot(p[0], p[1], p[2] + RS) - R
const speed = (v: number[]): number => Math.hypot(v[0], v[1], v[2])
assert.equal(path.tMin, COAST_T0, 'the path begins on the coast')

// 1. No jump where the approach meets the track: position, velocity and the attitude's turn-around are continuous through JOIN_T.
const before = path.sample(JOIN_T - 0.5), at = path.sample(JOIN_T), after = path.sample(JOIN_T + 0.5)
const dist = (a: number[], b: number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
assert.ok(dist(before.pos, at.pos) < 0.5 * speed(at.vel) * 1.01 + 1, `position is continuous at the join (${dist(before.pos, at.pos).toFixed(1)} m in 0.5 s at ${speed(at.vel).toFixed(0)} m/s)`)
assert.ok(dist(at.pos, after.pos) < 0.5 * speed(at.vel) * 1.01 + 1, 'and on the other side')
assert.ok(dist(before.vel, after.vel) < 2 * SPS_ACCEL, `velocity is continuous at the join (${dist(before.vel, after.vel).toFixed(2)} m/s over 1 s)`)
const qa = new Quaternion(before.quat[1], before.quat[2], before.quat[3], before.quat[0]), qb = new Quaternion(after.quat[1], after.quat[2], after.quat[3], after.quat[0])
assert.ok(qa.angleTo(qb) * 180 / Math.PI < 1, `the attitude is continuous at the join (${(qa.angleTo(qb) * 180 / Math.PI).toFixed(2)} deg in 1 s)`)

// 2. It is a real path: always above the surface, the Moon fills the sky at the start, and the engine burn sheds speed.
let minAlt = Infinity
for (let t = COAST_T0; t <= JOIN_T; t += 25) minAlt = Math.min(minAlt, alt(path.sample(t).pos))
assert.ok(minAlt > 5000, `the lowest point of the approach is ${(minAlt / 1000).toFixed(1)} km up (the join itself)`)
const start = path.sample(APPROACH_T0)
assert.ok(alt(start.pos) > 2000e3 && alt(start.pos) < 5000e3, `the arrival starts ${(alt(start.pos) / 1000).toFixed(0)} km up`)
// the coast: about 60,000 km out at the start of the film, closing on the Moon the whole way (nothing but gravity acts on it)
const far = path.sample(COAST_T0)
assert.ok(alt(far.pos) > 40000e3 && alt(far.pos) < 90000e3, `the coast starts ${(alt(far.pos) / 1000).toFixed(0)} km out`)
for (let t = COAST_T0; t < APPROACH_T0 - 500; t += 500) assert.ok(alt(path.sample(t).pos) > alt(path.sample(t + 500).pos), `closing on the Moon at ${t}`)
assert.ok(speed(far.vel) > 500 && speed(far.vel) < 1500, `${speed(far.vel).toFixed(0)} m/s at the start of the coast`)
assert.ok(speed(path.sample(BURN_T0).vel) - speed(path.sample(JOIN_T).vel) > 400, `the burn sheds ${(speed(path.sample(BURN_T0).vel) - speed(path.sample(JOIN_T).vel)).toFixed(0)} m/s`)
// before the burn it is on an unbound (hyperbolic) path: its specific energy is positive; after the join (the track's own orbit) it is bound
const energy = (s: { pos: number[]; vel: number[] }): number => 0.5 * speed(s.vel) ** 2 - MU / Math.hypot(s.pos[0], s.pos[1], s.pos[2] + RS)
assert.ok(energy(path.sample(BURN_T0 - 10)) > 0, 'before the burn: a hyperbola')
assert.ok(energy(path.sample(JOIN_T + 10)) < 0, 'after the join: the descent orbit, bound to the Moon')
// the burn is a deceleration along the velocity: speed falls through it, by about SPS_ACCEL a second
const dv = (speed(path.sample(BURN_T0 + 100).vel) - speed(path.sample(BURN_T0 + 200).vel)) / 100
assert.ok(dv > 0.5 * SPS_ACCEL && dv < 1.6 * SPS_ACCEL, `deceleration in the burn ${dv.toFixed(2)} m/s^2`)

// 3. The attitude: engine end forward before the join (the module's top points along the track), turned over to the descent attitude (top pointing back) within a minute after it.
const topAgainstTrack = (t: number): number => {
  const s = path.sample(t), q = new Quaternion(s.quat[1], s.quat[2], s.quat[3], s.quat[0])
  const up = new Vector3(s.pos[0], s.pos[1], s.pos[2] + RS).normalize()
  const v = new Vector3(...s.vel); v.addScaledVector(up, -v.dot(up)).normalize()
  return new Vector3(0, 0, 1).applyQuaternion(q).dot(v)
}
assert.ok(topAgainstTrack(BURN_T0 + 100) > 0.9, 'in the burn the stack points forward')
assert.ok(topAgainstTrack(JOIN_T + 70) < -0.8, 'after the turn-around the top points back (the descent attitude)')

// 4. The burn's level: 0 outside, 1 inside, smooth at the ends.
assert.equal(burnLevel(BURN_T0 - 1), 0); assert.equal(burnLevel(JOIN_T + 1), 0); assert.equal(burnLevel((BURN_T0 + JOIN_T) / 2), 1)
assert.ok(burnLevel(BURN_T0 + 3) > 0 && burnLevel(BURN_T0 + 3) < 1)
console.log(`approach.test.mts: ${(alt(far.pos) / 1000).toFixed(0)} km out at the start of the coast, ${(alt(start.pos) / 1000).toFixed(0)} km up at the arrival, ${(minAlt / 1000).toFixed(1)} km at the join, burn sheds ${(speed(path.sample(BURN_T0).vel) - speed(path.sample(JOIN_T).vel)).toFixed(0)} m/s: ok`)
