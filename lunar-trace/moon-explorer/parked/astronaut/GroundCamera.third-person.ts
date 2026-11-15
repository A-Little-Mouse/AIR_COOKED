import { Vector3 } from 'three'
import { type GroundView, groundBasis } from './frame'
import { clampAngleRate, hermite1, hermitePos } from '../descent/arrival'

/**
 * The ground camera (G1): a float64 pose in the site frame (metres), driven by look and move input,
 * kept above the ground, or walking at eye level, and able to glide to another pose (an attached
 * camera, a tour's end) without a cut. Pure state: no rendering, no DOM. The ground's height comes
 * from a callback (the GPU probe in the app, a function in tests).
 */

export type MoveMode = 'fly' | 'walk'

/** The walking astronaut (third person): frame position of its feet, the bearing it faces, and whether it moved this step. */
export interface Player {
  x: number; y: number; z: number; yawDeg: number; moving: boolean
  /** Velocity (m/s, east and north), speed, and the distance walked: the astronaut speeds up and slows down, and its stride follows the distance. */
  vx: number; vy: number; speed: number; dist: number
}
/** Seconds to reach the walking speed from rest, and to stop (time constants of an exponential ease). */
const ACCEL_TAU = 0.22
const DECEL_TAU = 0.14

/** The lowest the fly camera goes above the ground, metres. */
export const MIN_AGL_FLY = 0.5
/** Eye height of the walking camera, metres (a suited astronaut's eye is about 1.7 m). */
export const EYE_HEIGHT_M = 1.7
export const WALK_SPEED = 1.4
export const WALK_SPEED_FAST = 5
/** Pitch limits, deg above the horizon. */
const PITCH_LIM = 89.5
const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }
const wrap180 = (a: number): number => ((a + 540) % 360) - 180

export interface Glide {
  from: GroundView
  to: GroundView
  t0: number
  ms: number
  arcM: number
  done?: () => void
  /** Keeps the pitch on this point (site frame) during the glide, so a climb stays pointed at it. */
  lookAt?: Vector3
  /** The velocity (m/s, site frame) and pitch rate (deg/s) the glide leaves with: they follow Hermite curves that ease out to the end, so a descent's motion carries on. */
  v0?: Vector3
  pitchRate0?: number
}

export class GroundCamera {
  view: GroundView
  mode: MoveMode = 'fly'
  /** Where the ground is: the frame height (metres) of the ground at (east, north). */
  groundZ: (e: number, n: number) => number
  private glide: Glide | null = null
  /** Held move keys: forward, right, up (each -1, 0 or 1) and the fast modifier. */
  readonly keys = { fwd: 0, right: 0, up: 0, fast: false }
  /** True after the last step moved or turned the camera. */
  moved = false
  /**
   * Walking mode is third person: the camera orbits this player (the astronaut) at `orbitDist` metres, and the keys move the player.
   * Null while flying. (`view.pos` is the camera, as everywhere else.)
   */
  player: Player | null = null
  orbitDist = 5
  /** Called when the visitor turns or moves the camera (which ends any preset). */
  onInput: (() => void) | null = null

  constructor(view: GroundView, groundZ: (e: number, n: number) => number) {
    this.view = { ...view, pos: view.pos.clone() }
    this.groundZ = groundZ
  }

  get gliding(): boolean { return !!this.glide }

  /** Height above the ground under the camera, metres. */
  agl(): number { return this.view.pos.z - this.groundZ(this.view.pos.x, this.view.pos.y) }

  /** Drag: turn the view by degrees (positive dx turns right, positive dy looks down). */
  look(dxDeg: number, dyDeg: number): void {
    this.cancelGlide()
    this.onInput?.()
    this.view.headingDeg = wrap180(this.view.headingDeg + dxDeg)
    this.view.pitchDeg = Math.max(-PITCH_LIM, Math.min(PITCH_LIM, this.view.pitchDeg - dyDeg))
    this.view.rollDeg *= 0.0
    this.syncCamera()
    this.moved = true
  }

  /** Moves along the view's horizontal heading (forward, right) and straight up, metres. Kept above the ground. */
  move(fwd: number, right: number, up: number): void {
    this.cancelGlide()
    this.onInput?.()
    const h = this.view.headingDeg * Math.PI / 180
    const f = new Vector3(Math.sin(h), Math.cos(h), 0), r = new Vector3(Math.cos(h), -Math.sin(h), 0)
    if (this.player && this.mode === 'walk') {
      const p = this.player
      const dx = f.x * fwd + r.x * right, dy = f.y * fwd + r.y * right
      p.x += dx
      p.y += dy
      p.z = this.groundZ(p.x, p.y)
      if (Math.hypot(dx, dy) > 1e-6) { p.yawDeg = Math.atan2(dx, dy) * 180 / Math.PI; p.moving = true }
      this.syncCamera()
      this.moved = true
      return
    }
    this.view.pos.addScaledVector(f, fwd).addScaledVector(r, right)
    this.view.pos.z += up
    this.follow(1)
    this.moved = true
  }

  /** One wheel notch: along the line of sight (flying) or along the ground (walking), by a share of the height above the ground. */
  dolly(factor: number): void {
    this.cancelGlide()
    this.onInput?.()
    const step = (factor - 1) * Math.max(0.6, this.agl())
    if (this.mode === 'walk' && this.player) {
      this.orbitDist = Math.max(2.5, Math.min(16, this.orbitDist * factor))
      this.syncCamera()
      this.moved = true
      return
    }
    if (this.mode === 'walk') { this.move(-step * 0.5, 0, 0); return }
    const b = groundBasis(this.view)
    this.view.pos.addScaledVector(b.back, step)
    this.follow(1)
    this.moved = true
  }

  setMode(mode: MoveMode): void {
    this.mode = mode
    if (mode === 'walk') this.startPlayer()
    else this.player = null
    this.moved = true
  }

  /** Puts the astronaut on the ground a few metres ahead of the camera and keeps the camera behind it. */
  startPlayer(): void {
    const h = this.view.headingDeg * Math.PI / 180
    const x = this.view.pos.x + Math.sin(h) * this.orbitDist, y = this.view.pos.y + Math.cos(h) * this.orbitDist
    this.player = { x, y, z: this.groundZ(x, y), yawDeg: this.view.headingDeg, moving: false, vx: 0, vy: 0, speed: 0, dist: 0 }
    this.syncCamera()
  }

  /** Stands the astronaut at (x, y) facing `yawDeg`, and the camera behind. */
  placePlayer(x: number, y: number, yawDeg: number): void {
    this.cancelGlide()
    this.view.headingDeg = yawDeg
    this.view.pitchDeg = -14
    this.player = { x, y, z: this.groundZ(x, y), yawDeg, moving: false, vx: 0, vy: 0, speed: 0, dist: 0 }
    this.syncCamera()
    this.moved = true
  }

  /** The camera on its orbit around the player's chest, above the ground. */
  syncCamera(): void {
    const p = this.player
    if (!p) return
    const b = groundBasis(this.view)
    const t = new Vector3(p.x, p.y, p.z + 1.25)
    this.view.pos.copy(t).addScaledVector(b.back, this.orbitDist)
    const g = this.groundZ(this.view.pos.x, this.view.pos.y)
    if (this.view.pos.z < g + 0.45) this.view.pos.z = g + 0.45
  }

  /** Keeps the camera above the ground: at least MIN_AGL_FLY flying; at eye height walking (eased by `k`, 1 = at once). */
  follow(k: number): void {
    const p = this.view.pos
    const g = this.groundZ(p.x, p.y)
    if (this.mode === 'walk' && this.player) return
    if (this.mode === 'walk') p.z += (g + EYE_HEIGHT_M - p.z) * k
    else if (p.z < g + MIN_AGL_FLY) p.z = g + MIN_AGL_FLY
  }

  cancelGlide(): void { this.glide = null }

  /** Glides to `to` over `ms`, easing position, heading (by the short way), pitch, roll and the field (on a log scale). */
  glideTo(to: GroundView, now: number, ms?: number, done?: () => void, lookAt?: Vector3, v0?: Vector3, pitchRate0?: number): void {
    const from = { ...this.view, pos: this.view.pos.clone() }
    const target = { ...to, pos: to.pos.clone() }
    const horizontal = Math.hypot(target.pos.x - from.pos.x, target.pos.y - from.pos.y)
    this.glide = { from, to: target, t0: now, ms: ms ?? Math.max(1500, Math.min(6000, 1500 + 60 * Math.sqrt(horizontal))), arcM: horizontal > 15 && !v0 ? Math.min(60, 0.25 * horizontal) : 0, done, lookAt, v0: v0?.clone(), pitchRate0 }
    this.moved = true
  }

  /** The view a glide at progress k (0 to 1, already eased) shows. */
  static blend(a: GroundView, b: GroundView, k: number): GroundView {
    return {
      pos: a.pos.clone().lerp(b.pos, k),
      headingDeg: wrap180(a.headingDeg + wrap180(b.headingDeg - a.headingDeg) * k),
      pitchDeg: a.pitchDeg + (b.pitchDeg - a.pitchDeg) * k,
      rollDeg: a.rollDeg + (b.rollDeg - a.rollDeg) * k,
      tanHalf: Math.exp(Math.log(a.tanHalf) + (Math.log(b.tanHalf) - Math.log(a.tanHalf)) * k),
    }
  }

  /** Advances a glide and the held keys by `dt` seconds. Returns true if the camera changed. */
  step(now: number, dt: number): boolean {
    this.moved = false
    if (this.glide) {
      const g = this.glide
      const s = Math.max(0, Math.min(1, (now - g.t0) / g.ms))
      this.view = GroundCamera.blend(g.from, g.to, smooth(s))
      if (g.v0) {
        const q = hermitePos([g.from.pos.x, g.from.pos.y, g.from.pos.z], [g.to.pos.x, g.to.pos.y, g.to.pos.z], [g.v0.x, g.v0.y, g.v0.z], g.ms, s)
        this.view.pos.set(q[0], q[1], q[2])
        if (g.pitchRate0 !== undefined) this.view.pitchDeg = hermite1(g.from.pitchDeg, g.to.pitchDeg, clampAngleRate(g.pitchRate0, g.to.pitchDeg - g.from.pitchDeg, g.ms), g.ms, s)
      }
      if (g.arcM) this.view.pos.z += g.arcM * Math.sin(Math.PI * s) ** 2
      if (g.lookAt) {
        const d = g.lookAt.clone().sub(this.view.pos)
        this.view.pitchDeg = Math.max(-89, Math.min(this.view.pitchDeg, Math.atan2(d.z, Math.hypot(d.x, d.y)) * 180 / Math.PI))
      }
      if (s >= 1) { this.glide = null; g.done?.() }
      return true
    }
    const k = this.keys
    if (this.player && this.mode === 'walk') {
      // The astronaut has weight: it eases up to speed and eases to a stop, instead of starting and stopping at once.
      const p = this.player
      const h = this.view.headingDeg * Math.PI / 180
      const want = Math.hypot(k.fwd, k.right) > 0
      let tx = 0, ty = 0
      if (want) {
        const n = Math.hypot(k.fwd, k.right), sp = k.fast ? WALK_SPEED_FAST : WALK_SPEED
        tx = (Math.sin(h) * k.fwd + Math.cos(h) * k.right) / n * sp
        ty = (Math.cos(h) * k.fwd - Math.sin(h) * k.right) / n * sp
        this.cancelGlide()
        this.onInput?.()
      }
      const a = 1 - Math.exp(-dt / (want ? ACCEL_TAU : DECEL_TAU))
      p.vx += (tx - p.vx) * a
      p.vy += (ty - p.vy) * a
      p.speed = Math.hypot(p.vx, p.vy)
      if (!want && p.speed < 0.04) { p.vx = 0; p.vy = 0; p.speed = 0 }
      if (p.speed > 0) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.dist += p.speed * dt
        if (p.speed > 0.2) p.yawDeg = Math.atan2(p.vx, p.vy) * 180 / Math.PI
        this.moved = true
      }
      p.moving = p.speed > 0.05
      // feet follow the ground smoothly (terrain heights arrive in steps; a snap would pop the figure up or down)
      const g = this.groundZ(p.x, p.y)
      const dz = g - p.z
      if (Math.abs(dz) > 1e-4) { p.z += dz * Math.min(1, dt * 20); this.moved = true }
      const before = this.view.pos.clone()
      this.syncCamera()
      if (!before.equals(this.view.pos)) this.moved = true
      return this.moved
    }
    if (k.fwd || k.right || k.up) {
      const speed = this.mode === 'walk' ? (k.fast ? WALK_SPEED_FAST : WALK_SPEED) : Math.max(1.5, this.agl() * 0.8) * (k.fast ? 3 : 1)
      this.move(k.fwd * speed * dt, k.right * speed * dt, this.mode === 'fly' ? k.up * speed * dt : 0)
    }
    if (this.mode === 'walk' && !this.player) {
      const before = this.view.pos.z
      this.follow(Math.min(1, dt * 8))
      if (Math.abs(this.view.pos.z - before) > 1e-4) this.moved = true
    }
    return this.moved
  }
}
