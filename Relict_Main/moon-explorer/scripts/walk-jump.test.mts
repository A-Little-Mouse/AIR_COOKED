import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { EYE_HEIGHT_M, GroundCamera, JUMP_SPEED, MOON_G, WALK_SPEED } from '../src/ground/GroundCamera.ts'

// First-person walking (Lunar Trace): eased walking, lunar jump, eye follows the ground.
const view = (headingDeg: number) => ({ pos: new Vector3(0, 0, 3), headingDeg, pitchDeg: -5, rollDeg: 0, tanHalf: Math.tan(20 * Math.PI / 180) })
const flat = (z0: number) => (_e: number, _n: number) => z0
const run = (cam: GroundCamera, seconds: number, dt = 0.016): void => { for (let t = 0; t < seconds; t += dt) cam.step(t * 1000, dt) }

{
  const cam = new GroundCamera(view(0), flat(10))
  cam.setMode('walk')
  assert.ok(Math.abs(cam.view.pos.z - (10 + EYE_HEIGHT_M)) < 1e-9, 'eye height above the ground')

  // W: walks at once along the heading (north), at walking speed
  cam.keys.fwd = 1
  run(cam, 2)
  assert.ok(Math.abs(cam.view.pos.y - WALK_SPEED * 2) < 0.05 && Math.abs(cam.view.pos.x) < 1e-6, `walks along the heading: ${cam.view.pos.y}`)
  // let go: it stops
  cam.keys.fwd = 0
  const y0 = cam.view.pos.y
  run(cam, 0.5)
  assert.ok(Math.abs(cam.view.pos.y - y0) < 0.03, 'stops when the key is released')
}

{
  // jump: up and down under lunar gravity, back to eye height; the speed it left with carries on
  const cam = new GroundCamera(view(90), flat(0))
  cam.setMode('walk')
  cam.keys.fwd = 1
  run(cam, 2)
  const speed = WALK_SPEED
  const x0 = cam.view.pos.x
  assert.equal(cam.jump(), true)
  assert.equal(cam.airborne, true)
  assert.equal(cam.jump(), false, 'no jump in the air')
  let peak = 0, airTime = 0
  for (let t = 0; t < 6 && (cam.airborne || t === 0); t += 0.016) {
    cam.step(0, 0.016)
    peak = Math.max(peak, cam.view.pos.z - EYE_HEIGHT_M)
    airTime += 0.016
  }
  const expectPeak = (JUMP_SPEED * JUMP_SPEED) / (2 * MOON_G)
  assert.ok(Math.abs(peak - expectPeak) < 0.03, `peak ${peak} vs ${expectPeak}`)
  const expectAir = (2 * JUMP_SPEED) / MOON_G
  assert.ok(Math.abs(airTime - expectAir) < 0.1, `airtime ${airTime} vs ${expectAir}`)
  assert.ok(Math.abs(cam.view.pos.z - EYE_HEIGHT_M) < 0.02, 'lands at eye height')
  assert.ok(cam.view.pos.x - x0 > speed * expectAir * 0.9, 'keeps its speed in the air')
  cam.setMode('fly')
  assert.equal(cam.jump(), false, 'no jump while flying')
}

{
  // the eye rides finer ground that streams in, without a pop
  let z = 5
  const cam = new GroundCamera(view(0), () => z)
  cam.setMode('walk')
  z = 7
  cam.step(0, 0.016)
  assert.ok(cam.view.pos.z < 7 + EYE_HEIGHT_M - 0.5, 'a big step eases, not a pop')
  run(cam, 1)
  assert.ok(Math.abs(cam.view.pos.z - (7 + EYE_HEIGHT_M)) < 0.01)
}

{
  // stand(): placed at eye height, at rest, facing where asked
  const cam = new GroundCamera(view(0), flat(3))
  cam.setMode('walk')
  cam.stand(40, -12, 135)
  assert.equal(cam.view.pos.x, 40); assert.equal(cam.view.pos.y, -12)
  assert.ok(Math.abs(cam.view.pos.z - (3 + EYE_HEIGHT_M)) < 1e-9)
  assert.equal(cam.view.headingDeg, 135)
}
console.log('walk-jump: ok')
