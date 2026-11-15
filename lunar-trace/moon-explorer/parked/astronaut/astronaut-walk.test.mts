import assert from 'node:assert/strict'
import { GroundCamera, EYE_HEIGHT_M } from '../src/ground/GroundCamera.ts'
import { Vector3 } from 'three'

// Third-person walking (Lunar Trace): the camera orbits the astronaut, the keys move the astronaut along the camera's heading.
const flat = (z0: number) => (_e: number, _n: number) => z0
const view = (headingDeg: number) => ({ pos: new Vector3(0, 0, 3), headingDeg, pitchDeg: -10, rollDeg: 0, tanHalf: Math.tan(20 * Math.PI / 180) })
const horiz = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

{
  const cam = new GroundCamera(view(0), flat(10))
  cam.setMode('walk')
  assert.ok(cam.player, 'walking starts a player')
  const p0 = { ...cam.player! }
  assert.ok(Math.abs(p0.z - 10) < 1e-9, 'the astronaut stands on the ground')
  assert.ok(Math.abs(horiz(cam.view.pos, p0) - cam.orbitDist * Math.cos(10 * Math.PI / 180)) < 1e-6, 'the camera is orbitDist behind it')
  assert.ok(cam.view.pos.z > 10 + 0.45, 'the camera is above the ground')

  // W at heading north: the astronaut eases up to 1.4 m/s (not instantly), walking north and facing north
  cam.keys.fwd = 1
  cam.step(0, 0.016)
  assert.ok(cam.player!.speed > 0 && cam.player!.speed < 0.3, `eases in: ${cam.player!.speed}`)
  for (let i = 0; i < 188; i++) cam.step(0, 0.016) // 3 s
  assert.ok(Math.abs(cam.player!.speed - 1.4) < 0.02, `reaches walking speed: ${cam.player!.speed}`)
  assert.ok(cam.player!.y > p0.y + 3 && Math.abs(cam.player!.x - p0.x) < 1e-6, 'forward moves along the heading')
  assert.ok(Math.abs(cam.player!.yawDeg) < 1e-6 && cam.player!.moving, 'it faces its way')
  const walked = cam.player!.dist
  assert.ok(Math.abs(walked - (cam.player!.y - p0.y)) < 0.05, `distance walked matches the way moved: ${walked}`)
  // let go: it slows down over a fraction of a second rather than stopping dead
  cam.keys.fwd = 0
  cam.step(0, 0.016)
  assert.ok(cam.player!.speed > 0.5, 'still moving a frame after release')
  for (let i = 0; i < 125; i++) cam.step(0, 0.016)
  assert.equal(cam.player!.speed, 0)
  assert.equal(cam.player!.moving, false, 'and stops')

  // the camera keeps its distance as the astronaut walks
  assert.ok(Math.abs(horiz(cam.view.pos, cam.player!) - cam.orbitDist * Math.cos(10 * Math.PI / 180)) < 1e-6)

  // turning the camera 90 degrees: right now moves east
  cam.look(90, 0)
  cam.keys.fwd = 1
  const before = { ...cam.player! }
  for (let i = 0; i < 125; i++) cam.step(0, 0.016)
  assert.ok(cam.player!.x - before.x > 1.4 && Math.abs(cam.player!.y - before.y) < 1e-6, 'forward follows the camera heading')
  assert.ok(Math.abs(cam.player!.yawDeg - 90) < 1e-6)
  cam.keys.fwd = 0

  // the wheel moves the camera in and out, within limits
  cam.keys.fwd = 0
  for (let i = 0; i < 40; i++) cam.dolly(0.5)
  assert.equal(cam.orbitDist, 2.5)
  for (let i = 0; i < 40; i++) cam.dolly(2)
  assert.equal(cam.orbitDist, 16)

  // leaving walk mode drops the player
  cam.setMode('fly')
  assert.equal(cam.player, null)
}

{
  // the ground rising under the astronaut raises its feet and the camera (terrain streaming in)
  let z = 5
  const cam = new GroundCamera(view(0), (_e, _n) => z)
  cam.setMode('walk')
  z = 7.5
  for (let i = 0; i < 60; i++) cam.step(0, 0.016) // feet ease up to it (no pop)
  assert.ok(Math.abs(cam.player!.z - 7.5) < 0.01, `feet follow the ground: ${cam.player!.z}`)
  assert.ok(cam.view.pos.z >= 7.5 + 0.45)
}

assert.ok(EYE_HEIGHT_M > 1)
console.log('astronaut-walk: ok')
