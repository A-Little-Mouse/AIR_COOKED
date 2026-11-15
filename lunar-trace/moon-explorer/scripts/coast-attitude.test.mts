// Before ignition the module holds its attitude against the LOCAL horizon (descent/DescentPath.ts coastAttitude), so a docked pair does not turn against it during a time-lapse.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Quaternion, Vector3 } from 'three'
import { DescentPath, type TrackDoc } from '../src/descent/DescentPath.ts'

const path = DescentPath.fromDoc(JSON.parse(readFileSync(new URL('../data/apollo17/descent-track.json', import.meta.url), 'utf8')) as TrackDoc)
const RS = 1734774
const DEG = 180 / Math.PI
// body axes in the site frame, and where they point against the local vertical and the horizontal velocity at time t
function attitudeAgainstHorizon(t: number): { zUp: number; xFwd: number; yaw: number } {
  const s = path.sample(t)
  const q = new Quaternion(s.quat[1], s.quat[2], s.quat[3], s.quat[0])
  const up = new Vector3(s.pos[0], s.pos[1], s.pos[2] + RS).normalize()
  const v = new Vector3(...s.vel); v.addScaledVector(up, -v.dot(up)).normalize()
  const left = new Vector3().crossVectors(up, v)
  const z = new Vector3(0, 0, 1).applyQuaternion(q), x = new Vector3(1, 0, 0).applyQuaternion(q)
  return { zUp: Math.acos(Math.max(-1, Math.min(1, z.dot(up)))) * DEG, xFwd: Math.acos(Math.max(-1, Math.min(1, x.dot(v)))) * DEG, yaw: Math.atan2(x.dot(left), x.dot(v)) * DEG }
}
const ref = attitudeAgainstHorizon(-0.01)
for (const t of [-240, -200, -150, -100, -60, -20]) { // after the turn-around that follows the orbit insertion (the burn's attitude, before the join, is checked in approach.test.mts)
  const a = attitudeAgainstHorizon(t)
  assert.ok(Math.abs(a.zUp - ref.zUp) < 0.2 && Math.abs(a.xFwd - ref.xFwd) < 0.2, `t ${t}: the module keeps its attitude against the horizon (top ${a.zUp.toFixed(2)} deg from vertical, ignition ${ref.zUp.toFixed(2)})`)
}
// and it is the track's own ignition attitude where the track has one
const s0 = path.sample(0), sm = path.sample(-0.001)
const q0 = new Quaternion(s0.quat[1], s0.quat[2], s0.quat[3], s0.quat[0]), qm = new Quaternion(sm.quat[1], sm.quat[2], sm.quat[3], sm.quat[0])
assert.ok(q0.angleTo(qm) * DEG < 0.05, `the attitude is continuous through ignition (${(q0.angleTo(qm) * DEG).toFixed(3)} deg)`)
console.log(`coast-attitude.test.mts: top of the module ${ref.zUp.toFixed(1)} deg from vertical at ignition and all through the coast; continuous through ignition: ok`)
