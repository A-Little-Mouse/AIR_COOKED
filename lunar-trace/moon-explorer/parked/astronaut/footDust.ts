import * as THREE from 'three'

/**
 * Dust kicked up by the astronaut's feet. There is no air on the Moon, so every grain flies a plain ballistic arc under 1.62 m/s^2 and
 * nothing hangs or drifts: the puff rises, spreads a little and settles in about a second. Positions are three's axes (east, up, south).
 */
const MOON_G = 1.62
const MAX = 240

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, aSize * uScale / max(0.05, -mv.z));
    vAlpha = aAlpha;
  }
`
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float soft = smoothstep(1.0, 0.25, r);
    float a = soft * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

export class FootDust {
  readonly points: THREE.Points
  private readonly pos = new Float32Array(MAX * 3)
  private readonly size = new Float32Array(MAX)
  private readonly alpha = new Float32Array(MAX)
  private readonly vel = new Float32Array(MAX * 3)
  private readonly age = new Float32Array(MAX).fill(-1) // -1 = free
  private readonly life = new Float32Array(MAX)
  private readonly size0 = new Float32Array(MAX)
  private readonly size1 = new Float32Array(MAX)
  private readonly floorY = new Float32Array(MAX)
  private cursor = 0
  private live = 0
  private readonly uniforms = { uScale: { value: 600 }, uColor: { value: new THREE.Color(0.2, 0.19, 0.18) } }

  constructor() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1))
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: true })
    this.points = new THREE.Points(g, m)
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    this.points.visible = false
  }

  get active(): boolean { return this.live > 0 }

  /**
   * One puff at (x, y, z) (three's axes) with a drift velocity (vx, vz horizontal) and `n` grains. `floor` is the ground height there: grains stop on it.
   * `amount` 0..1 scales the speed and the size of the puff.
   */
  emit(x: number, y: number, z: number, vx: number, vz: number, n: number, amount: number): void {
    for (let k = 0; k < n; k++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % MAX
      if (this.age[i] < 0) this.live++
      const r = () => Math.random() * 2 - 1
      const spread = 0.35 + 0.5 * amount
      this.pos[i * 3] = x + r() * 0.05; this.pos[i * 3 + 1] = y + 0.02; this.pos[i * 3 + 2] = z + r() * 0.05
      this.vel[i * 3] = vx + r() * spread
      this.vel[i * 3 + 1] = 0.25 + Math.random() * (0.5 + 0.6 * amount)
      this.vel[i * 3 + 2] = vz + r() * spread
      this.age[i] = 0
      this.life[i] = 0.7 + Math.random() * 0.7
      this.size0[i] = 0.05 + Math.random() * 0.05
      this.size1[i] = 0.14 + Math.random() * 0.14 * (0.5 + amount)
      this.floorY[i] = y
      this.size[i] = this.size0[i]
      this.alpha[i] = 0.55
    }
    this.points.visible = true
  }

  update(dt: number): void {
    if (this.live === 0) return
    let live = 0
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] < 0) continue
      this.age[i] += dt
      const t = this.age[i] / this.life[i]
      if (t >= 1) { this.age[i] = -1; this.alpha[i] = 0; this.size[i] = 0; continue }
      live++
      // ballistic flight; a grain that reaches the ground stops there and fades
      let vy = this.vel[i * 3 + 1] - MOON_G * dt
      let y = this.pos[i * 3 + 1] + vy * dt
      if (y <= this.floorY[i] + 0.01) { y = this.floorY[i] + 0.01; vy = 0; this.vel[i * 3] *= 0.2; this.vel[i * 3 + 2] *= 0.2 }
      this.vel[i * 3 + 1] = vy
      this.pos[i * 3] += this.vel[i * 3] * dt
      this.pos[i * 3 + 1] = y
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * Math.sqrt(t)
      this.alpha[i] = 0.55 * (1 - t) * Math.min(1, t * 12)
    }
    this.live = live
    const g = this.points.geometry
    ;(g.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true
    ;(g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true
    if (live === 0) this.points.visible = false
  }

  /** Dust is lit like the ground it came from: a pale grey, scaled by the exposure and the Sun. */
  setLight(brightness: number): void { this.uniforms.uColor.value.setRGB(brightness, brightness * 0.97, brightness * 0.93) }

  /** Pixels per metre at one metre of depth: viewport height over twice the tangent of the half field. */
  setScale(viewportHeightPx: number, tanHalf: number): void { this.uniforms.uScale.value = viewportHeightPx / (2 * tanHalf) }

  dispose(): void { this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose() }
}
