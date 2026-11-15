/**
 * The descent flight (G2b): the pure geometry of a camera flying the Apollo 17 track. No rendering, no DOM: main.ts feeds it the
 * clock and the moment's frame axes and draws what it returns. Everything is float64 in the site frame (east, north, up metres at
 * the lunar module's rest position, src/ground/frame.ts); the world camera is derived from it at the end.
 *
 * Cameras (all modelled poses, none is a recording):
 *   chase   an observer beside the module, south of it, moving with it, looking at it;
 *   window  the commander's window: a modelled pose from the window geometry (WINDOW below), carried by the track's attitude. No cabin is drawn.
 * Regimes: 'orbit' (the Moon pass draws the ground, the module is drawn over it) far from the site, 'ground' (ground mode) within
 * GROUND_ENTER_M of it. The hand-over from the orbital rig is a 10 s blend of the rig's camera into the flight camera with the clock held.
 */
import { Matrix4, Quaternion, Vector3 } from 'three'
import type { ViewCamera } from '../camera/pose'
import { type FrameAxes, type GroundView, anglesOfBasis, groundFromView, viewFromGround, R_M } from '../ground/frame'
import { type DescentSample, DescentPath } from './DescentPath'
import { APPROACH_T0, BURN_T0, COAST_T0, JOIN_T, burnLevel } from './approach'

export type FlightCamMode = 'chase' | 'window'
export type Regime = 'orbit' | 'ground'

/** Camera within this distance of the site: ground mode draws the ground. Left again beyond GROUND_LEAVE_M (hysteresis for scrubbing). */
export const GROUND_ENTER_M = 15000
export const GROUND_LEAVE_M = 20000
/** The module's model origin sits this far below its pad plane (pad base at model y 0.10, G1 detectPads). */
export const MODEL_BELOW_PAD_M = 0.1
/** The hand-over blend, milliseconds of real time. */
export const HANDOVER_MS = 4000
/** Contact light (725 s): the free ground camera takes over here. The module is 1.3 m up and still drops to its pads (~728 s). */
export const HANDOFF_T = 725
/** The module keeps settling after the camera is released: the track's rest at 731 s, the pose blended into G1's placement over the last SETTLE_BLEND_S. */
export const SETTLE_END_T = 731
export const SETTLE_BLEND_S = 2
export const CHASE = { sideM: 45, upM: 6, fovDeg: 36 }

const DEG = Math.PI / 180

/** The lunar module's centre of mass, model y: the camera looks at this point, not at the pads. */
const LM_LOOK_UP_M = 2.4

/** Model (x left, y up, z forward) to body (X forward, Y left, Z up). */
const P_MODEL_TO_BODY = new Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
/** ENU to three's axes (east, up, south). */
const C_ENU_TO_THREE = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1)

/** The site's sphere radius, metres: the frame's origin is on it. */
export const siteRadius = (h0M: number): number => R_M + h0M

const bodyQuat = (q: DescentSample['quat']): Quaternion => new Quaternion(q[1], q[2], q[3], q[0])

/** Local vertical at a site-frame point (the sphere's centre is `rs` below the origin). */
export function localUp(p: Vector3, rs: number): Vector3 { return new Vector3(p.x, p.y, p.z + rs).normalize() }

export interface LmPose {
  /** The model origin in the site frame (east, north, up). */
  pos: Vector3
  /** Body to ENU. */
  quat: Quaternion
  /** The pad plane's height in the frame (the pad plane is what touches down). */
  padZ: number
}

/**
 * Where the model sits for a sample. `groundOffsetM` is how far the real terrain under the module is from the track's nominal ground
 * (the tangent plane and its curvature), phased in near the ground so the pads meet the actual terrain at contact.
 */
export function lmPoseOf(s: DescentSample, groundOffsetM = 0): LmPose {
  const w = groundBlend(s.altAgl)
  const padZ = s.pos[2] + (s.padAlt - s.altAgl) + groundOffsetM * w
  const quat = bodyQuat(s.quat)
  // Near the ground the lowest pad base is what touches: the model origin sits that far below the pad plane (0.1 m level, more when tilted).
  const below = MODEL_BELOW_PAD_M + (lowestPadRelM(quat) - MODEL_BELOW_PAD_M) * w
  return { pos: new Vector3(s.pos[0], s.pos[1], padZ - below), quat, padZ }
}

/** The height of the lowest pad base above the model origin for an attitude (body to ENU), metres. Pad bases as G1's detectPads: +-2.76 m, 0.1 m up. */
export function lowestPadRelM(bodyToEnu: Quaternion): number {
  let lo = Infinity
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lo = Math.min(lo, new Vector3(2.76 * z, 2.76 * x, 0.1).applyQuaternion(bodyToEnu).z)
  return lo
}
/** 0 above 100 m, 1 below 30 m. */
export function groundBlend(altM: number): number {
  const k = Math.max(0, Math.min(1, (100 - altM) / 70))
  return k * k * (3 - 2 * k)
}

/** The three.js rotation for the model root: model space to three's axes (east, up, south), from the body-to-ENU attitude. */
export function modelQuaternion(bodyToEnu: Quaternion): Quaternion {
  const m = new Matrix4().makeRotationFromQuaternion(bodyToEnu)
  const full = new Matrix4().multiplyMatrices(C_ENU_TO_THREE, m).multiply(P_MODEL_TO_BODY)
  return new Quaternion().setFromRotationMatrix(full)
}

/** A camera at `pos` looking at `target`, the top of the frame toward `upHint`, as a site-frame ground view. */
export function lookView(pos: Vector3, target: Vector3, upHint: Vector3, fovDeg: number): GroundView {
  const fwd = target.clone().sub(pos).normalize()
  const right = new Vector3().crossVectors(fwd, upHint).normalize()
  const up = new Vector3().crossVectors(right, fwd)
  return { pos: pos.clone(), ...anglesOfBasis(right, up, fwd.clone().negate()), tanHalf: Math.tan(fovDeg * DEG / 2) }
}

/**
 * How much the chase camera makes room for the module's shadow: 0 above 63 m, 1 below 3 m. A low module throws its shadow well away from it
 * (a body 5 m up in a 13 degree Sun lands its shadow 20 to 40 m out), so the camera backs off, widens and looks between the two.
 */
export function shadowRoom(padZ: number): number { return Number.isFinite(padZ) ? 1 - smooth((padZ - 3) / 60) : 0 }
/**
 * The coast camera (audit 6): a module 9 m wide is a speck from the tens of kilometres a high stand-off needs, so for the whole
 * fast-forward (audit 4 and 5: the module appeared only at ignition) the observer trails it instead, as a chase plane would:
 * `backM` behind along the track, `sideM` to the south and `upM` above, looking at it. The horizon and the black sky are then in the
 * frame, and the ground flows toward the camera, which is much slower across the picture than the sideways scroll of a camera abeam.
 * It is a framing CHOICE (the HUD says so), a modelled pose, not a recording.
 */
export const CHASE_COAST = { backM: 80, sideM: 20, upM: 12 }
/** 1 until 620 s before ignition and 0 from 20 s before: the observer comes in from the trailing pose to the 45 m chase over the last 600 s of the coast (37 s of picture at x16). */
export const coastK = (t: number): number => smooth((-t - 20) / 600)
export const CHASE_ROOM = { extraSideM: 12, extraFovDeg: 14, shiftM: 13 }
/** Horizontal direction the shadow falls in the frame: away from the Sun (about 96 degrees azimuth for this descent, so west, a little north). */
export const SHADOW_DIR = new Vector3(-0.994, 0.105, 0)

/** The observer beside the module: south of it, `sideM` off and `upM` above, looking at its centre (between the module and its shadow when low). */
/** The docked pair seen from behind and to the side (a three-quarter view: the command module trails the lander along the track, so a view from directly behind would hide it, and one from abeam would sweep far when it eases to the trailing view). */
const R_MOON_M = 1737400
export const DOCK_VIEW = { backM: 36, sideM: 38, upM: 8, centreAlongM: 6.5 }
export function chaseView(lm: LmPose, rs: number, fovDeg = CHASE.fovDeg, shadowDir: Vector3 = SHADOW_DIR, coastK = 0, heading: Vector3 = new Vector3(1, 0, 0), dockK = 0): GroundView {
  const up = localUp(lm.pos, rs)
  // Height above the site's sphere (the frame's z is the tangent plane's, which far away is tens of km off).
  const h = Math.hypot(lm.pos.x, lm.pos.y, lm.pos.z + rs) - rs
  const room = shadowRoom(h)
  const centre = lm.pos.clone().addScaledVector(up, LM_LOOK_UP_M).addScaledVector(shadowDir, CHASE_ROOM.shiftM * room)
  const pos = lm.pos.clone().add(new Vector3(0, -(CHASE.sideM + CHASE_ROOM.extraSideM * room), 0)).addScaledVector(up, CHASE.upM).addScaledVector(shadowDir, CHASE_ROOM.shiftM * room)
  let cam = pos
  let look = centre
  let fov = fovDeg + CHASE_ROOM.extraFovDeg * room
  if (coastK > 0 || dockK > 0) {
    // Behind the module along its track, level with the LOCAL horizon (the coast starts 1,700 km before the site, where the site frame's
    // plane is tilted by tens of degrees against it), on the south side of the track and a little above: the trailing pose, blended into
    // the chase pose by coastK.
    const fwd = heading.clone().addScaledVector(up, -heading.dot(up))
    if (fwd.lengthSq() < 1e-9) fwd.set(1, 0, 0).addScaledVector(up, -up.x)
    fwd.normalize()
    const side = new Vector3().crossVectors(up, fwd).normalize()
    // (Lunar Trace: the observer stays on the same hand of the track all the way round. It used to be forced south of the SITE frame, which flips sides where the
    // orbit passes the site's meridian; at a time-lapse that was a swing of tens of degrees in one frame. Near the site this is the same south side.)
    if (coastK > 0) {
      const trail = lm.pos.clone().addScaledVector(fwd, -CHASE_COAST.backM).addScaledVector(side, CHASE_COAST.sideM).addScaledVector(up, CHASE_COAST.upM)
      cam = pos.clone().lerp(trail, coastK)
      fov = fovDeg
    }
    if (dockK > 0) {
      // The undocking: a view of the docked pair from behind and to the side, looking at the middle of the stack (the lander and the command module on its top), which
      // eases to the lander alone, and to the ordinary chase or trailing pose, as the command module pulls away. (Blended in both branches, so the end of the coast is no cut.)
      const top = new Vector3(0, 0, 1).applyQuaternion(lm.quat)
      // High above the Moon the horizon is far below the level: at 2,600 km it is 66 degrees down, and a level camera sees black sky and no Moon. So the camera rises over the pair by as much as
      // the horizon has dropped (to a limit), keeping the horizon near the middle of the picture with the Moon filling the lower half; it comes back down as the craft does.
      const dip = Math.acos(Math.min(1, R_MOON_M / (R_MOON_M + Math.max(0, h))))
      const rise = Math.hypot(DOCK_VIEW.backM, DOCK_VIEW.sideM) * Math.tan(Math.min(dip, 80 * Math.PI / 180))
      const dockPos = lm.pos.clone().addScaledVector(fwd, -DOCK_VIEW.backM).addScaledVector(side, DOCK_VIEW.sideM).addScaledVector(up, DOCK_VIEW.upM + rise)
      const dockLook = lm.pos.clone().addScaledVector(top, DOCK_VIEW.centreAlongM)
      cam = cam.clone().lerp(dockPos, dockK)
      look = look.clone().lerp(dockLook, dockK)
    }
  }
  return lookView(cam, look, up, fov)
}

/**
 * The commander's window in flight (G2c), a modelled pose derived in scripts/window-pose.mts. TN D-7388: the forward windows see about 65 degrees below
 * the forward axis and 80 outboard; the Earth leaves the right window where it crosses 1.3 degrees left of forward (112:56:33). So the frame spans
 * 1.1 to 80 degrees outboard (centre 40.6 left, 79 degrees across, 49 degrees high at 16:9) and reaches 65 degrees below the axis (centre 40.5 down).
 * Eye and cabin as the window-height preset (no cabin drawn). Model space: +x left, +y up, +z forward.
 */
export const WINDOW = { eye: [0.6, 4.5, 1.9] as [number, number, number], look: [0.495, -0.6494, 0.577] as [number, number, number], fovDeg: 49 }

/** The commander's window (a modelled pose, no cabin): the preset's eye and look carried by the body's attitude. */
export function windowView(lm: LmPose): GroundView {
  const toEnu = (v: number[]): Vector3 => new Vector3(v[2], v[0], v[1]).applyQuaternion(lm.quat)
  const eye = lm.pos.clone().add(toEnu(WINDOW.eye))
  const look = toEnu(WINDOW.look).normalize()
  const top = new Vector3(0, 0, 1).applyQuaternion(lm.quat)
  return lookView(eye, eye.clone().add(look), top, WINDOW.fovDeg)
}

const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }

/** Blends two world cameras: position linear, orientation by quaternion, field on a log scale. */
export function blendCamera(a: ViewCamera, b: ViewCamera, k: number): ViewCamera {
  const qa = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(a.right, a.up, a.back))
  const qb = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(b.right, b.up, b.back))
  const q = qa.slerp(qb, k)
  const m = new Matrix4().makeRotationFromQuaternion(q)
  const right = new Vector3().setFromMatrixColumn(m, 0), up = new Vector3().setFromMatrixColumn(m, 1), back = new Vector3().setFromMatrixColumn(m, 2)
  return { pos: a.pos.clone().lerp(b.pos, k), right, up, back, tanHalf: Math.exp(Math.log(a.tanHalf) + (Math.log(b.tanHalf) - Math.log(a.tanHalf)) * k) }
}

/**
 * The hand-over onto the lander: the camera zooms in on it. The camera's distance from the lander changes by the same factor every moment (a log-scale zoom, so a
 * 3,000 km start does not rush for the first half second and crawl at the end), its direction from the lander swings smoothly from the start's to the end's,
 * and its orientation and field blend as before. A straight line between the two camera positions would cross thousands of kilometres at one speed.
 */
export function zoomBlend(a: ViewCamera, b: ViewCamera, target: Vector3, k: number): ViewCamera {
  const blended = blendCamera(a, b, k) // orientation and field
  const oa = a.pos.clone().sub(target), ob = b.pos.clone().sub(target)
  const la = Math.max(1e-12, oa.length()), lb = Math.max(1e-12, ob.length())
  const da = oa.divideScalar(la), db = ob.divideScalar(lb)
  const dir = da.clone().applyQuaternion(new Quaternion().setFromUnitVectors(da, db).slerp(new Quaternion(), 1 - k))
  const r = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * k)
  return { ...blended, pos: target.clone().addScaledVector(dir, r) }
}

export interface FlightEnv {
  axes: FrameAxes
  /** Site sphere radius, metres. */
  rs: number
  /** Height of the real terrain at (e, n) in the frame, or null when it cannot be read (ground mode not ready). */
  groundZ: ((e: number, n: number) => number | null) | null
  nowMs: number
}
export interface FlightFrame {
  sample: DescentSample
  lm: LmPose
  regime: Regime
  view: GroundView
  cam: ViewCamera
  /** Distance from the site origin to the camera, metres. */
  camDistM: number
  /** True while the rig's camera is still blending into the flight camera. */
  blending: boolean
}

/** Playback state and the camera for one moment of the flight. */
/**
 * Lunar Trace: the Apollo 17 coast, arrival and landing as ONE continuous scene, about 40 s of film after a 4 s zoom onto the docked pair. It starts about 60,000 km out on the coast, then the arrival (about 3,000 km up,
 * descent/approach.ts: a modelled approach and orbit-insertion burn that ends on the track's own state), turns the pair around, undocks the lander and flies the real descent track to touchdown.
 * (The real undocking came 8517 s before ignition and the lander then circled the Moon for over an hour and a half; the film shows it minutes before the descent. The captions say so.)
 * Each part has a track-time span and a number of real seconds; the clock rates are derived from them, so the parts always add up. Change a duration and the rest follows.
 */
export const LT_START_T = COAST_T0
/** Track time at which the lander undocks from the command module. */
export const LT_UNDOCK_T = -240
/** Track time where the last approach starts. */
export const LT_FINAL_FROM = 640
/** Real seconds of each part: the coast, the approach, the turn-around while docked, the undocking and coast, the powered descent, the last approach. */
export const LT_SEGMENTS: readonly { t0: number; t1: number; s: number }[] = [
  { t0: COAST_T0, t1: APPROACH_T0, s: 5 },
  { t0: APPROACH_T0, t1: BURN_T0, s: 5 },
  { t0: BURN_T0, t1: JOIN_T, s: 6 },
  { t0: JOIN_T, t1: LT_UNDOCK_T, s: 3 },
  { t0: LT_UNDOCK_T, t1: -20, s: 4 },
  { t0: -20, t1: LT_FINAL_FROM, s: 12 },
  { t0: LT_FINAL_FROM, t1: HANDOFF_T, s: 5 },
]
const rateOf = (k: number): number => (LT_SEGMENTS[k].t1 - LT_SEGMENTS[k].t0) / LT_SEGMENTS[k].s
export const LT_COAST_X = rateOf(4)
export const LT_POWER_X = rateOf(5)
export const LT_FINAL_X = rateOf(6)
/** Across each boundary between two parts the clock rate changes smoothly (on a log scale) over this fraction of the shorter part's track time, centred on the boundary: a ramp, not a step. */
export const LT_RATE_BLEND = 0.15
/** Real seconds over which the camera eases from the docked pair to the trailing view once the lander has undocked. */
export const LT_DOCK_RELEASE_S = 6
/** The film's real seconds from the start of the approach to touchdown, not counting the zoom onto the lander. */
export const LT_FILM_S = LT_SEGMENTS.reduce((a, g) => a + g.s, 0)

/**
 * The command module on the lander's top. In the lander's model frame (metres, +Y up through the overhead hatch) its docking probe's tip is CSM_TIP_Y_M above the
 * model origin, with its axis on the model's Y axis. 5.05 m is the measured clearance: the highest lander structure under the module's nose cone, with the cone's
 * profile, needs the tip at 4.87 m or more (scripts/csm-dock.test.mts). It undocks along the docking axis only, so the two can never touch after that.
 */
export const CSM_TIP_Y_M = 5.05
/** The command module's distance from the docked position `u` real seconds after the undocking: 0 while docked, then a smooth pull-away (made quicker than the real few feet per second so it can be seen); null once it has left the picture. */
export function csmOffsetM(u: number): number | null {
  if (u <= 0) return 0
  const d = 0.5 * 1.3 * u * u
  return d > 220 ? null : d
}

export class DescentFlight {
  t = 0
  playing = true
  /** Real seconds played since the hand-over blend ended. */
  elapsed = 0
  /** Real seconds since the lander undocked (0 until then): drives the command module's pull-away and the camera easing off the docked pair. */
  sinceUndock = 0
  /** null: the default schedule (16x before ignition, true time from there); otherwise a fixed rate. */
  rate: number | null = null
  camMode: FlightCamMode = 'chase'
  regime: Regime = 'orbit'
  private blendFrom: ViewCamera | null = null
  private blendT0 = 0

  constructor(readonly path: DescentPath) { this.t = LT_START_T }

  /** Starts the hand-over: the rig's camera blends into the flight camera over HANDOVER_MS, the clock held. */
  begin(rigCam: ViewCamera, nowMs: number): void {
    this.t = LT_START_T
    this.elapsed = 0
    this.sinceUndock = 0
    this.resume(rigCam, nowMs)
  }

  /** Resume at the held simulation time, blending from the actually displayed camera. */
  resume(rigCam: ViewCamera, nowMs: number): void {
    this.playing = true
    this.blendFrom = { pos: rigCam.pos.clone(), right: rigCam.right.clone(), up: rigCam.up.clone(), back: rigCam.back.clone(), tanHalf: rigCam.tanHalf }
    this.blendT0 = nowMs
  }
  get blending(): boolean { return this.blendFrom !== null }

  /** The scheduled clock rate at the current track time, in sim seconds per real second: each part's own rate, blended smoothly across the boundaries between them. */
  speed(): number {
    if (this.rate !== null) return this.rate
    const t = this.t
    let k = LT_SEGMENTS.length - 1
    for (let i = 0; i < LT_SEGMENTS.length; i++) if (t < LT_SEGMENTS[i].t1) { k = i; break }
    const span = (i: number): number => LT_SEGMENTS[i].t1 - LT_SEGMENTS[i].t0
    // a window centred on the boundary at the end of part k, and on the one at its start
    if (k < LT_SEGMENTS.length - 1) {
      const w = LT_RATE_BLEND * Math.min(span(k), span(k + 1))
      const b = LT_SEGMENTS[k].t1
      if (t > b - w) return Math.exp(Math.log(rateOf(k)) + (Math.log(rateOf(k + 1)) - Math.log(rateOf(k))) * smooth((t - (b - w)) / (2 * w)))
    }
    if (k > 0) {
      const w = LT_RATE_BLEND * Math.min(span(k - 1), span(k))
      const b = LT_SEGMENTS[k].t0
      if (t < b + w) return Math.exp(Math.log(rateOf(k - 1)) + (Math.log(rateOf(k)) - Math.log(rateOf(k - 1))) * smooth((t - (b - w)) / (2 * w)))
    }
    return rateOf(k)
  }

  /** 1 while the camera is on the docked pair, easing to 0 as the command module pulls away (a function of the real seconds since the undocking). */
  dockK(): number { return 1 - smooth(this.sinceUndock / LT_DOCK_RELEASE_S) }

  /** The command module's offset from the docked position now, or null once it is gone. */
  csmOffset(): number | null { return csmOffsetM(this.sinceUndock) }

  /** The main engine's strength now, 0 to 1 (descent/approach.ts burnLevel). */
  burn(): number { return burnLevel(this.t) }

  /** Advances the clock by `dtS` real seconds (held during the hand-over blend and at the end). */
  advance(dtS: number): void {
    if (!this.playing || this.blendFrom) return
    this.elapsed += dtS
    if (this.t >= LT_UNDOCK_T) this.sinceUndock += dtS
    const step = dtS * this.speed()
    // A fast-forward never steps over the ignition: the default schedule lands on -20 and slows there.
    const t1 = this.rate === null && this.t < -20 && this.t + step > -20 ? -20 : this.t + step
    this.t = Math.min(this.path.tMax, Math.max(this.path.tMin, t1))
    if (this.t >= HANDOFF_T) this.playing = false
  }
  get ended(): boolean { return this.t >= HANDOFF_T }

  seek(t: number): void { this.t = Math.min(this.path.tMax, Math.max(this.path.tMin, t)) }

  evaluate(env: FlightEnv): FlightFrame {
    const sample = this.path.sample(this.t)
    let off = 0
    if (env.groundZ && groundBlend(sample.altAgl) > 0) {
      const g = env.groundZ(sample.pos[0], sample.pos[1])
      // The terrain under the module against the track's nominal ground (tangent plane with curvature).
      if (g !== null) off = g + (sample.pos[0] ** 2 + sample.pos[1] ** 2) / (2 * env.rs)
    }
    const lm = lmPoseOf(sample, off)
    let view = this.camMode === 'window' ? windowView(lm) : chaseView(lm, env.rs, CHASE.fovDeg, SHADOW_DIR, coastK(this.t), new Vector3(sample.vel[0], sample.vel[1], sample.vel[2]), this.dockK())
    const camDistM = view.pos.length()
    this.regime = env.groundZ === null ? 'orbit' : this.regime === 'ground' ? (camDistM > GROUND_LEAVE_M ? 'orbit' : 'ground') : (camDistM < GROUND_ENTER_M ? 'ground' : 'orbit')
    // Never under the terrain (the chase camera beside a slope).
    if (this.regime === 'ground' && env.groundZ) {
      const g = env.groundZ(view.pos.x, view.pos.y)
      if (g !== null && view.pos.z < g + 1.7) view = { ...view, pos: new Vector3(view.pos.x, view.pos.y, g + 1.7) }
    }
    let cam = viewFromGround(env.axes, view)
    let blending = false
    if (this.blendFrom) {
      const k = (env.nowMs - this.blendT0) / HANDOVER_MS
      if (k >= 1) this.blendFrom = null
      else { cam = zoomBlend(this.blendFrom, cam, viewFromGround(env.axes, { ...view, pos: lm.pos }).pos, smooth(k)); view = groundFromView(env.axes, cam); blending = true }
    }
    return { sample, lm, regime: this.regime, view, cam, camDistM, blending }
  }
}
