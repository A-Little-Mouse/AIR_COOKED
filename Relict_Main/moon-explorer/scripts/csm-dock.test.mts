// The command module on the lander's top, and its pull-away (Lunar Trace's landing film, descent/flight.ts, ground/LunarModule.ts loadCsm).
import assert from 'node:assert/strict'
import { CSM_TIP_Y_M, LT_COAST_X, LT_DOCK_RELEASE_S, LT_FILM_S, LT_SEGMENTS, LT_START_T, LT_UNDOCK_T, csmOffsetM } from '../src/descent/flight.ts'

// 1. Clearance. Measured on the two models (the NASA lander as the engine loads it, in metres; the command module scaled so its service module is 3.9 m across):
//    the nose cone's radius grows from 0.66 m at the probe tip to 2.23 m at 2.5 m below it; with the cone's axis through the lander's centre, the highest lander
//    structure under the cone (a feature at x 0.63, z -0.47, y 5.05 m, 0.78 m off the axis, where the cone is 0.18 m up from its tip) needs the tip at 4.87 m or more.
const REQUIRED_TIP_Y_M = 4.87
assert.ok(CSM_TIP_Y_M >= REQUIRED_TIP_Y_M + 0.1, `the docking probe's tip (${CSM_TIP_Y_M} m) clears the lander's top (${REQUIRED_TIP_Y_M} m) by at least 10 cm`)
assert.ok(CSM_TIP_Y_M <= REQUIRED_TIP_Y_M + 0.5, 'and not by so much that the craft look apart while docked')

// 2. The pull-away only ever moves the command module away along the docking axis: it starts docked, never comes back, and leaves the picture.
assert.equal(csmOffsetM(0), 0)
assert.equal(csmOffsetM(-5), 0, 'docked until the undocking')
let prev = 0, gone = -1
for (let u = 0; u < 60; u += 0.05) {
  const d = csmOffsetM(u)
  if (d === null) { if (gone < 0) gone = u; continue }
  assert.ok(gone < 0, 'once gone it stays gone')
  assert.ok(d >= prev, `the offset never decreases (${u.toFixed(2)} s: ${d} < ${prev})`)
  prev = d
}
assert.ok(gone > 8 && gone < 40, `it leaves the picture some seconds after the undocking (${gone.toFixed(1)} s)`)

// 3. The film's schedule: the parts are contiguous in track time, add up, and the lander undocks after the turn-around, not before the orbit insertion is done.
for (let k = 1; k < LT_SEGMENTS.length; k++) assert.equal(LT_SEGMENTS[k].t0, LT_SEGMENTS[k - 1].t1, `part ${k} starts where part ${k - 1} ends`)
assert.equal(LT_SEGMENTS[0].t0, LT_START_T)
assert.ok(LT_SEGMENTS.some((g) => g.t0 === LT_UNDOCK_T), 'a part begins at the undocking')
assert.ok(LT_FILM_S > 30 && LT_FILM_S < 55, `the film after the zoom lasts ${LT_FILM_S} s`)
assert.ok(LT_START_T < -20000 && LT_START_T > -90000, 'it starts on the coast, tens of thousands of km out, not an orbit before')
assert.ok(LT_COAST_X > 20 && LT_COAST_X < 400, `coast rate ${LT_COAST_X.toFixed(0)}x`)
assert.ok(LT_DOCK_RELEASE_S >= 4, 'the camera eases off the docked pair over a few seconds')
console.log(`csm-dock.test.mts: tip ${CSM_TIP_Y_M} m (needs ${REQUIRED_TIP_Y_M}), leaves ${gone.toFixed(1)} s after the undocking, film ${LT_FILM_S} s: ok`)
