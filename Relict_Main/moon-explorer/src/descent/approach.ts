/**
 * Relict: the coast to the Moon and the arrival at the Moon, a MODELLED prelude to the Apollo 17 descent track. The track starts in the descent orbit; before it there is no data in this project.
 * Here the docked command module and lander come in from about 3,000 km up and fire the command module's main engine to slow into that orbit, ending exactly on the track's own
 * state at JOIN_T, so the flight is one continuous path from the approach to the touchdown.
 *
 * How the path is made: the state at JOIN_T (position and velocity, from the track) is integrated BACKWARD in time under the Moon's gravity and a retrograde thrust of
 * SPS_ACCEL along the velocity from JOIN_T back to BURN_T0, then under gravity alone back to APPROACH_T0. Run forward it is a hyperbolic approach, a long burn near the
 * closest point, and capture into the track's orbit. The numbers are physical (about 1 km/s of speed in hand at the Moon, about 0.9 km/s shed in the burn, as for the real lunar
 * orbit insertion) but this is NOT the real Apollo 17 approach: its closest point is the join (about 12 km up, far lower than the real 110 km), the burn is a plain constant
 * thrust, and the Moon's own turning is ignored. Before BURN_T0 the same backward integration (gravity alone) continues out to COAST_T0, about 60,000 km from the Moon: that part is the
 * coast. Its direction of arrival is fixed by the track's orbit and is on the side of the Moon away from Earth (about 140 degrees from Earth's direction), where the real approach came from
 * Earth's side and burned behind the Moon. The captions say so.
 */

export type Vec3 = [number, number, number]

/** The arrival part of the film starts here (seconds from the descent engine's ignition), about 3,000 km up. */
export const APPROACH_T0 = -2700
/** The film itself starts here, about 60,000 km out: the last hours of the coast from Earth (a modelled path: it comes in from the side of the Moon away from Earth, which the real one did not). */
export const COAST_T0 = -50000
/** The main engine fires from here to JOIN_T. */
export const BURN_T0 = -750
/** Where the track's own orbit takes over. */
export const JOIN_T = -300
/** The command and service module's main engine: about 91 kN on about 45 t. */
export const SPS_ACCEL = 2.0
/** The Moon's gravitational parameter, m^3/s^2. */
const MU = 4.9028e12
/** Seconds of sample spacing (the path is stored backward from the join). */
const STEP = 1

/** 0 before the burn, a short ramp up and down at its ends, 1 between: the plume's strength and the thrust's visual weight. */
export function burnLevel(t: number): number {
  if (t < BURN_T0 || t > JOIN_T) return 0
  const up = Math.min(1, (t - BURN_T0) / 12), down = Math.min(1, (JOIN_T - t) / 12)
  const s = (x: number): number => x * x * (3 - 2 * x)
  return s(up) * s(down)
}

export class ApproachPath {
  /** Sample i is the state at t = JOIN_T - i * STEP. */
  private readonly p: Float64Array
  private readonly v: Float64Array
  private readonly n: number

  /** `join`: the track's state at JOIN_T in the site frame (metres, east north up); `siteRadiusM`: the frame's origin is this far above the Moon's centre. */
  constructor(join: { pos: Vec3; vel: Vec3 }, siteRadiusM: number) {
    this.n = Math.ceil((JOIN_T - COAST_T0) / STEP) + 1
    this.p = new Float64Array(this.n * 3)
    this.v = new Float64Array(this.n * 3)
    const rs = siteRadiusM
    let P: Vec3 = [...join.pos], V: Vec3 = [...join.vel]
    const acc = (p: Vec3, v: Vec3, burn: boolean): Vec3 => {
      const x = p[0], y = p[1], z = p[2] + rs
      const r = Math.sqrt(x * x + y * y + z * z), k = -MU / (r * r * r)
      const a: Vec3 = [x * k, y * k, z * k]
      if (burn) {
        const sp = Math.hypot(v[0], v[1], v[2]) || 1
        a[0] -= SPS_ACCEL * v[0] / sp; a[1] -= SPS_ACCEL * v[1] / sp; a[2] -= SPS_ACCEL * v[2] / sp
      }
      return a
    }
    const dt = -STEP
    for (let i = 0; i < this.n; i++) {
      this.p.set(P, i * 3); this.v.set(V, i * 3)
      const t = JOIN_T - i * STEP
      // the thrust acts over [BURN_T0, JOIN_T]; the step that begins at t and goes back to t - STEP is inside it when t - STEP >= BURN_T0
      const burn = t - STEP / 2 >= BURN_T0
      // RK4, backward in time
      const a1 = acc(P, V, burn)
      const P2 = P.map((c, k) => c + 0.5 * dt * V[k]) as Vec3, V2 = V.map((c, k) => c + 0.5 * dt * a1[k]) as Vec3
      const a2 = acc(P2, V2, burn)
      const P3 = P.map((c, k) => c + 0.5 * dt * V2[k]) as Vec3, V3 = V.map((c, k) => c + 0.5 * dt * a2[k]) as Vec3
      const a3 = acc(P3, V3, burn)
      const P4 = P.map((c, k) => c + dt * V3[k]) as Vec3, V4 = V.map((c, k) => c + dt * a3[k]) as Vec3
      const a4 = acc(P4, V4, burn)
      P = P.map((c, k) => c + (dt / 6) * (V[k] + 2 * V2[k] + 2 * V3[k] + V4[k])) as Vec3
      V = V.map((c, k) => c + (dt / 6) * (a1[k] + 2 * a2[k] + 2 * a3[k] + a4[k])) as Vec3
    }
  }

  /** Position and velocity at `t` (JOIN_T and earlier; clamped to the path), by cubic Hermite between the one-second samples. */
  sample(tIn: number): { pos: Vec3; vel: Vec3 } {
    const f = Math.min(this.n - 1, Math.max(0, (JOIN_T - tIn) / STEP))
    const i = Math.min(this.n - 2, Math.floor(f)), s = f - i
    const pos: Vec3 = [0, 0, 0], vel: Vec3 = [0, 0, 0]
    // sample i is later in time than i + 1: Hermite along increasing time from sample i + 1 (t0) to sample i (t1)
    const a = i + 1, b = i, h = STEP, u = 1 - s
    const u2 = u * u, u3 = u2 * u
    for (let k = 0; k < 3; k++) {
      pos[k] = (2 * u3 - 3 * u2 + 1) * this.p[a * 3 + k] + (u3 - 2 * u2 + u) * h * this.v[a * 3 + k] + (-2 * u3 + 3 * u2) * this.p[b * 3 + k] + (u3 - u2) * h * this.v[b * 3 + k]
      vel[k] = this.v[a * 3 + k] + (this.v[b * 3 + k] - this.v[a * 3 + k]) * u
    }
    return { pos, vel }
  }
}
