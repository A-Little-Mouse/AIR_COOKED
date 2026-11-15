import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Ephemeris } from '../../ephemeris'
import { enuDir, frameAxes, makeSiteFrame } from '../frame'
import { trackGpu } from '../../quality/track'
import { type Regional } from './regional'

/**
 * An ILLUSTRATIVE walkable surface at an Apollo landing site that has no ground-level data (Apollo 17 has the real one). Units are metres, in a scene of its own over
 * the Moon page. What is real: the site, the Sun's and the Earth's directions at the moment on screen, the regional slope and roughness from the global height tile
 * (regional.ts), and what stands there (the lunar module's descent stage, and the rover at Apollo 15 and 16). What is not: every metre of the ground itself, which is
 * procedural (rocks, small craters, undulation). The page says so.
 */
export interface WalkSite { id: string; name: string; lon: number; lat: number; rover: boolean }
export const WALK_SITES: readonly WalkSite[] = [
  { id: 'apollo11', name: 'Apollo 11 · Tranquility Base', lon: 23.473, lat: 0.674, rover: false },
  { id: 'apollo12', name: 'Apollo 12 · Ocean of Storms', lon: -23.42, lat: -3.01, rover: false },
  { id: 'apollo14', name: 'Apollo 14 · Fra Mauro', lon: -17.47, lat: -3.65, rover: false },
  { id: 'apollo15', name: 'Apollo 15 · Hadley–Apennine', lon: 3.63, lat: 26.13, rover: true },
  { id: 'apollo16', name: 'Apollo 16 · Descartes Highlands', lon: 15.5, lat: -8.97, rover: true },
]

const D = Math.PI / 180
const MOON_R = 1_737_400
const G = 1.62, EYE = 1.7, WALK = 1.4, RUN = 5, JUMP_V = 1.8
const ASCENT_CUTOFF = 0.5 // meshes whose centre is above this fraction of the module's height are the ascent stage, which left the Moon
const LM_RADIUS_M = 4.7, ROVER_LENGTH_M = 3.1

// --- deterministic noise -------------------------------------------------------------------------------------------------------------
const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }
const hash = (x: number, y: number): number => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const sm = (t: number): number => t * t * (3 - 2 * t)
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}
const fbm = (x: number, y: number, o = 4): number => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++, a *= 0.5, f *= 2.03) v += a * vnoise(x * f, y * f); return v }
const sstep = (a: number, b: number, x: number): number => sm(Math.max(0, Math.min(1, (x - a) / (b - a))))

export class WalkScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60_000)
  private sun = new THREE.DirectionalLight(0xfff4e6, 3.4)
  private craters: Array<{ x: number; z: number; r: number; depth: number }> = []
  private reg: Regional = { slopeE: 0, slopeN: 0, reliefM: 40, meanM: 0 }
  private raf = 0
  private last = 0
  private disposed = false
  private keys = new Set<string>()
  private pos = new THREE.Vector3(0, EYE, 12) // metres: x east, y up, z south
  private yaw = 0 // degrees, heading clockwise from north; starts 12 m south of the lander, facing north toward it
  private pitch = -4
  private vx = 0; private vz = 0; private jumpH = 0; private jumpV = 0
  private drag: { id: number; x: number; y: number } | null = null
  private earthDir = new THREE.Vector3()
  private sunDir = new THREE.Vector3()
  private cleanups: Array<() => void> = []
  /** Called every second or so with the Earth's bearing and height, for the page's readout. */
  onEarth: ((bearingDeg: number, elevationDeg: number) => void) | null = null
  private earthAt = 0

  constructor(private canvas: HTMLCanvasElement, private site: WalkSite, e: Ephemeris, regional: Regional | null, private base: string) {
    if (regional) this.reg = regional
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.scene.background = new THREE.Color(0x000000)

    // the real directions at this moment, in the site's east-north-up frame
    const axes = frameAxes(e, makeSiteFrame(site.lon, site.lat, 0))
    const s = enuDir(axes, e.sunDir), en = enuDir(axes, e.earthDir)
    this.sunDir.set(s.x, s.z, -s.y).normalize() // three: x east, y up, z south
    this.earthDir.set(en.x, en.z, -en.y).normalize()
    const up = Math.max(0.0, this.sunDir.y)
    this.sun.position.copy(this.sunDir).multiplyScalar(100)
    this.sun.intensity = up > 0.02 ? 3.4 : 0
    this.sun.castShadow = up > 0.02
    this.sun.shadow.mapSize.set(2048, 2048)
    const c = this.sun.shadow.camera
    c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 400
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target, new THREE.AmbientLight(0x8a93a8, up > 0.02 ? 0.28 : 0.1))

    trackGpu('lm', 'walk-shadow-est', 2048 * 2048 * 4)
    trackGpu('lm', 'walk-ground-est', 512 * 512 * 4 * 1.34 + 200 * 128 * 40)
    this.buildCraters()
    this.scene.add(this.buildGround(), this.buildRocks())
    this.buildSky()
    this.resize()
    const onResize = (): void => this.resize()
    window.addEventListener('resize', onResize)
    this.cleanups.push(() => window.removeEventListener('resize', onResize))
    this.bindInput()
  }

  // --- the ground -----------------------------------------------------------------------------------------------------------------
  /** Terrain height (m) at (x, z): the real regional tilt, procedural undulation scaled by the real roughness, craters, and the Moon's curvature. */
  height(x: number, z: number): number {
    const r2 = x * x + z * z, r = Math.sqrt(r2)
    const rough = Math.max(0.5, Math.min(3, this.reg.reliefM / 40))
    const tilt = this.reg.slopeE * x + this.reg.slopeN * -z // z is south
    let h = tilt + (0.22 * rough * fbm(x / 90 + 11, z / 90 + 7, 3) + 0.05 * rough * fbm(x / 8 + 3, z / 8 + 19, 3)) * sstep(2, 16, r)
    for (const k of this.craters) {
      const d = Math.hypot(x - k.x, z - k.z) / k.r
      if (d > 1.6) continue
      if (d < 1) h -= k.depth * (1 - d * d)
      h += k.depth * 0.35 * Math.exp(-(((d - 1.08) * 6) ** 2))
    }
    return h - r2 / (2 * MOON_R)
  }
  private buildCraters(): void {
    const rand = rng(this.site.id.length * 7919 + Math.round(this.site.lon * 100))
    const rough = Math.max(0.5, Math.min(3, this.reg.reliefM / 40))
    for (let i = 0; i < 40; i++) {
      const r = 3 + Math.pow(rand(), 2.2) * 45 * Math.sqrt(rough)
      const a = rand() * Math.PI * 2, d = 40 + r + Math.pow(rand(), 0.7) * 1500
      this.craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth: r * 0.07 })
    }
  }
  private regolith(): THREE.Texture {
    const size = 512, cv = document.createElement('canvas')
    cv.width = cv.height = size
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(size, size)
    const rand = rng(7)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2, v = (y / size) * Math.PI * 2
      const nx = Math.cos(u) * 6, ny = Math.sin(u) * 6, nz = Math.cos(v) * 6, nw = Math.sin(v) * 6
      const n = 0.5 * fbm(nx + nz * 0.7 + 40, ny + nw * 0.7 + 40, 5) + 0.5 * fbm(nx * 3 + nw + 90, ny * 3 + nz + 90, 3)
      let g = 0.36 + 0.34 * n
      if (rand() < 0.012) g += 0.18
      if (rand() < 0.01) g -= 0.15
      const i = (y * size + x) * 4, c = Math.max(0, Math.min(255, g * 255))
      img.data[i] = c; img.data[i + 1] = c * 0.985; img.data[i + 2] = c * 0.96; img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return t
  }
  private buildGround(): THREE.Mesh {
    const SEG = 128, RINGS = 200, R0 = 0.25, RMAX = 6000
    const growth = Math.pow(RMAX / R0, 1 / (RINGS - 2))
    const pos = new Float32Array((RINGS * SEG + 1) * 3), uv = new Float32Array((RINGS * SEG + 1) * 2)
    let n = 0
    const put = (x: number, z: number): void => { pos[n * 3] = x; pos[n * 3 + 1] = this.height(x, z); pos[n * 3 + 2] = z; uv[n * 2] = x / 9; uv[n * 2 + 1] = z / 9; n++ }
    put(0, 0)
    for (let k = 0; k < RINGS; k++) { const r = R0 * Math.pow(growth, k); for (let s = 0; s < SEG; s++) { const a = (s / SEG) * Math.PI * 2; put(Math.cos(a) * r, Math.sin(a) * r) } }
    const idx: number[] = []
    for (let s = 0; s < SEG; s++) idx.push(0, 1 + ((s + 1) % SEG), 1 + s)
    for (let k = 0; k < RINGS - 1; k++) {
      const a = 1 + k * SEG, b = 1 + (k + 1) * SEG
      for (let s = 0; s < SEG; s++) { const s1 = (s + 1) % SEG; idx.push(a + s, a + s1, b + s, a + s1, b + s1, b + s) }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals()
    const tex = this.regolith()
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 1, metalness: 0, color: 0xaeaca8 }))
    mesh.receiveShadow = true
    return mesh
  }
  private buildRocks(): THREE.InstancedMesh {
    const COUNT = 1100, rand = rng(42 + this.site.id.length)
    const geo = new THREE.IcosahedronGeometry(1, 3)
    const p = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.82 + 0.3 * vnoise(v.x * 1.6 + 5, v.y * 1.6 + v.z * 1.3); p.setXYZ(i, v.x * k, v.y * k * 0.72, v.z * k) }
    geo.computeVertexNormals()
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x77746f, roughness: 1 }), COUNT)
    mesh.castShadow = true; mesh.receiveShadow = true
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), t = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      const r = 6 + Math.pow(rand(), 2.6) * 260, a = rand() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r
      const size = (0.03 + Math.pow(rand(), 4) * 0.42) * (1 + r / 120)
      e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28); q.setFromEuler(e)
      sc.set(size, size * (0.6 + rand() * 0.5), size * (0.8 + rand() * 0.5)); t.set(x, this.height(x, z) + size * 0.2, z)
      mesh.setMatrixAt(i, m.compose(t, q, sc))
    }
    return mesh
  }
  /** The Earth, where it really stands (a disc at its true angular size) and a glare at the Sun. */
  private buildSky(): void {
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshStandardMaterial({ roughness: 1, color: 0x6f8fc0, emissive: 0x0a1424 }))
    const dist = 20_000, rad = dist * (6378 / 384_400)
    earth.scale.setScalar(rad); earth.position.copy(this.earthDir).multiplyScalar(dist); earth.renderOrder = -1
    new THREE.TextureLoader().load(`${this.base}earth/albedo-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}.jpg`, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; const mt = earth.material as THREE.MeshStandardMaterial; mt.map = tx; mt.color.set(0xffffff); mt.needsUpdate = true })
    this.scene.add(earth)
    const g = document.createElement('canvas'); g.width = g.height = 64
    const gx = g.getContext('2d')!; const grad = gx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,250,235,1)'); grad.addColorStop(0.15, 'rgba(255,244,220,0.85)'); grad.addColorStop(1, 'rgba(255,240,210,0)')
    gx.fillStyle = grad; gx.fillRect(0, 0, 64, 64)
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    glare.position.copy(this.sunDir).multiplyScalar(25_000); glare.scale.setScalar(900)
    if (this.sunDir.y > -0.05) this.scene.add(glare)
  }

  /** The lunar module's descent stage at the origin (and the rover at Apollo 15 and 16). */
  async loadModels(): Promise<void> {
    const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${this.base}draco/`))
    const place = (obj: THREE.Object3D, keep: (m: THREE.Mesh) => boolean): THREE.Group => {
      const g = new THREE.Group(); g.add(obj); g.updateMatrixWorld(true)
      const box = new THREE.Box3()
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { if (!keep(m)) m.visible = false; else { m.castShadow = true; m.receiveShadow = true } } })
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.visible) box.expandByObject(m) })
      g.position.y -= box.min.y
      return g
    }
    const lmGltf = await loader.loadAsync(`${this.base}lm/apollo-lunar-module.glb`)
    const lm = lmGltf.scene
    lm.updateMatrixWorld(true)
    const full = new THREE.Box3().setFromObject(lm)
    lm.scale.multiplyScalar((LM_RADIUS_M * 2) / Math.max(...full.getSize(new THREE.Vector3()).toArray()))
    lm.updateMatrixWorld(true)
    const sized = new THREE.Box3().setFromObject(lm), tmp = new THREE.Box3()
    const lmG = place(lm, (m) => { tmp.setFromObject(m); return (tmp.min.y + tmp.max.y) / 2 <= sized.min.y + (sized.max.y - sized.min.y) * ASCENT_CUTOFF })
    lmG.position.set(0, lmG.position.y + this.height(0, 0) - 0.03, 0)
    this.scene.add(lmG)
    if (this.site.rover) {
      const g = (await loader.loadAsync(`${this.base}actors/lunar-roving-vehicle.glb`)).scene
      g.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new THREE.Vector3())
      const along = Math.max(sz.x, sz.z)
      g.scale.multiplyScalar(ROVER_LENGTH_M / along)
      g.updateMatrixWorld(true)
      const cb = new THREE.Box3().setFromObject(g), cc = cb.getCenter(new THREE.Vector3())
      g.position.x -= cc.x; g.position.z -= cc.z
      const R = place(g, () => true)
      const rx = 22, rz = 14
      R.position.set(rx, R.position.y + this.height(rx, rz), rz); R.rotation.y = 0.9
      this.scene.add(R)
    }
  }

  // --- input and loop -------------------------------------------------------------------------------------------------------------
  private bindInput(): void {
    const kd = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(k)) return
      e.stopImmediatePropagation(); e.preventDefault()
      if (k === ' ') { if (!e.repeat && this.jumpH <= 0 && this.jumpV <= 0) this.jumpV = JUMP_V; return }
      this.keys.add(k)
    }
    const ku = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()) }
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true)
    const pd = (e: PointerEvent): void => { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId) }
    const pm = (e: PointerEvent): void => {
      if (!this.drag || this.drag.id !== e.pointerId) return
      this.yaw += (e.clientX - this.drag.x) * 0.15
      this.pitch = Math.max(-89, Math.min(89, this.pitch - (e.clientY - this.drag.y) * 0.15))
      this.drag.x = e.clientX; this.drag.y = e.clientY
    }
    const pu = (): void => { this.drag = null }
    this.canvas.addEventListener('pointerdown', pd); this.canvas.addEventListener('pointermove', pm); this.canvas.addEventListener('pointerup', pu); this.canvas.addEventListener('pointercancel', pu)
    this.cleanups.push(() => {
      window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true)
      this.canvas.removeEventListener('pointerdown', pd); this.canvas.removeEventListener('pointermove', pm); this.canvas.removeEventListener('pointerup', pu); this.canvas.removeEventListener('pointercancel', pu)
    })
  }
  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
  start(): void { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame) }
  private frame = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    // move along the heading on the ground; in the air keep the velocity
    if (this.jumpH <= 0 && this.jumpV <= 0) {
      const f = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0)
      const r = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0)
      const n = Math.hypot(f, r), sp = this.keys.has('shift') ? RUN : WALK, h = this.yaw * D
      this.vx = n ? ((Math.sin(h) * f + Math.cos(h) * r) / n) * sp : 0
      this.vz = n ? ((-Math.cos(h) * f + Math.sin(h) * r) / n) * sp : 0 // north is -z
    }
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt
    if (this.jumpH > 0 || this.jumpV > 0) {
      this.jumpV -= G * dt; this.jumpH += this.jumpV * dt
      if (this.jumpH <= 0 && this.jumpV < 0) { this.jumpH = 0; this.jumpV = 0 }
    }
    const ground = this.height(this.pos.x, this.pos.z)
    this.pos.y += (ground + EYE + this.jumpH - this.pos.y) * Math.min(1, dt * 20)
    const cam = this.camera
    cam.position.copy(this.pos)
    const hy = this.yaw * D, hp = this.pitch * D
    cam.lookAt(this.pos.x + Math.sin(hy) * Math.cos(hp), this.pos.y + Math.sin(hp), this.pos.z - Math.cos(hy) * Math.cos(hp))
    this.sun.target.position.copy(this.pos); this.sun.position.copy(this.pos).addScaledVector(this.sunDir, 60); this.sun.target.updateMatrixWorld()
    this.renderer.render(this.scene, cam)
    if (this.onEarth && now - this.earthAt > 400) {
      this.earthAt = now
      const eb = ((Math.atan2(this.earthDir.x, -this.earthDir.z) / D) + 360) % 360
      const el = Math.asin(Math.max(-1, Math.min(1, this.earthDir.y))) / D
      this.onEarth(eb, el)
    }
  }
  /** Where the camera looks, so a readout can say how far to turn to the Earth. */
  heading(): number { return ((this.yaw % 360) + 360) % 360 }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.cleanups.forEach((f) => f())
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()) })
    this.renderer.dispose()
  }
}
