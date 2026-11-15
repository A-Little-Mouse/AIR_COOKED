import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type GroundView, groundBasis } from '../frame'
import { G_FAR, G_NEAR } from '../GroundPass'
import { textureBytes } from '../../quality/ledger'
import { trackGpu } from '../../quality/track'
import { type Placement, attitudeQuat, fitPlacement, PLACEMENT_INVALID_Z } from '../lmPlacement'

/**
 * The Apollo 17 Lunar Roving Vehicle (the walking astronaut is parked: see ../../../parked/astronaut), drawn over the ground pass the way the lunar module is: a three.js
 * scene with its own camera, rendered after the ground pass so the ground's depth hides what is behind a rise. Frame metres are
 * (east, north, up); three's axes are (east, up, south).
 *
 * What is real and what is not (the project says so on the page): the rover stands at the measured Station 1 stop of Apollo 17 (Haase et al.
 * control points); its heading is not known and is a guess.
 */
const ROVER_LENGTH_M = 3.1
const enu = (e: number, n: number, u: number): THREE.Vector3 => new THREE.Vector3(e, u, -n)

interface Shadow { mesh: THREE.Mesh }

export class ActorLayer {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 1, G_NEAR, G_FAR)
  private readonly sun = new THREE.DirectionalLight(0xffffff, Math.PI)
  private readonly ambient = new THREE.AmbientLight(0xffffff, 0)
  private blobTex: THREE.Texture | null = null
  private get blob(): THREE.Texture { return (this.blobTex ??= ActorLayer.blobTexture()) } // made on first use (needs a DOM)


  /** The rover, once loaded: where it stands (frame metres, east and north), the heading it is set at, and its four wheel contact points (model space). */
  private rover: { root: THREE.Group; pads: THREE.Vector3[]; shadow: Shadow; e: number; n: number; headingDeg: number; placed: Placement | null } | null = null
  private roverRev = -1
  private roverFitAt = -1e9
  /** Where the rover is wanted (frame metres), or null until `setRoverSite`. */
  private roverSite: { e: number; n: number; headingDeg: number } | null = null

  private sunDir = new THREE.Vector3(0, 1, 0)

  constructor() {
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(512, 512) // 16 m across: 3 cm texels, plenty for a rover
    trackGpu('lm', 'actor-shadow-est', 512 * 512 * 4)
    const c = this.sun.shadow.camera
    c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.near = 1; c.far = 80
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun, this.sun.target, this.ambient)
  }

  /** A soft round alpha texture for the fake contact shadows on the ground (the ground pass cannot receive a second caster). */
  private static blobTexture(): THREE.Texture {
    const s = 64, cv = document.createElement('canvas')
    cv.width = cv.height = s
    const g = cv.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      grad.addColorStop(0, 'rgba(0,0,0,0.85)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad; g.fillRect(0, 0, s, s)
    }
    return new THREE.CanvasTexture(cv)
  }

  private makeShadow(): Shadow {
    const mat = new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 2
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return { mesh }
  }

  private loaderFor(base: string): GLTFLoader {
    const loader = new GLTFLoader()
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath(`${base}draco/`)) // the rover file is Draco-compressed
    return loader
  }

  private roverRequested = false
  /** Rover distance beyond which nothing of it is drawn, and within which its model is fetched (m). */
  private static readonly ROVER_LOAD_M = 400
  private static readonly ROVER_DRAW_M = 900

  /** The rover (1.4 MB) is fetched only once the visitor is within 400 m of its stand. `camE`, `camN`: the camera in frame metres. */
  maybeLoadRover(base: string, camE: number, camN: number): void {
    const site = this.roverSite
    if (this.roverRequested || !site || Math.hypot(camE - site.e, camN - site.n) > ActorLayer.ROVER_LOAD_M) return
    this.roverRequested = true
    void this.loadRover(this.loaderFor(base), `${base}actors/lunar-roving-vehicle.glb`).catch((err) => { console.error('rover failed to load', err); this.roverRequested = false })
  }

  private async loadRover(loader: GLTFLoader, url: string): Promise<void> {
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const alongX = size.x >= size.z // the longest horizontal side becomes the length (model +z is the front, as the module's)
    const length = alongX ? size.x : size.z, width = alongX ? size.z : size.x
    const scale = ROVER_LENGTH_M / length
    const inner = new THREE.Group()
    inner.add(model)
    const c = box.getCenter(new THREE.Vector3())
    model.position.set(-c.x, -box.min.y, -c.z)
    inner.scale.setScalar(scale)
    if (alongX) inner.rotation.y = Math.PI / 2
    const root = new THREE.Group()
    root.add(inner)
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    const seen = new Set<THREE.Texture>()
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      for (const t of [m?.map, m?.normalMap, m?.roughnessMap, m?.metalnessMap, m?.emissiveMap, m?.aoMap]) if (t) seen.add(t)
    })
    let bytes = 0
    for (const t of seen) { const im = t.image as { width?: number; height?: number } | undefined; if (im?.width && im?.height) bytes += textureBytes(im.width, im.height, 4, { mips: true }) }
    trackGpu('lm', 'rover-textures-est', bytes)
    const hl = (length * scale) / 2 * 0.72, hw = (width * scale) / 2 * 0.9
    const pads = [new THREE.Vector3(-hw, 0, -hl), new THREE.Vector3(hw, 0, -hl), new THREE.Vector3(-hw, 0, hl), new THREE.Vector3(hw, 0, hl)]
    root.visible = false
    this.scene.add(root)
    const shadow = this.makeShadow()
    shadow.mesh.visible = false
    shadow.mesh.scale.set(ROVER_LENGTH_M * 1.25, 2.4, 1)
    this.rover = { root, pads, shadow, e: 0, n: 0, headingDeg: 90, placed: null }
    if (this.roverSite) this.setRoverSite(this.roverSite.e, this.roverSite.n, this.roverSite.headingDeg)
  }

  /** Where the rover stands (frame metres east and north) and the bearing its front points to. */
  setRoverSite(e: number, n: number, headingDeg: number): void {
    this.roverSite = { e, n, headingDeg }
    if (!this.rover) return
    Object.assign(this.rover, { e, n, headingDeg, placed: null })
    this.roverRev = -1
  }

  roverPosition(): { e: number; n: number } | null { return this.roverSite ? { e: this.roverSite.e, n: this.roverSite.n } : null }
  get roverReady(): boolean { return !!this.rover }

  /**
   * Sits the rover on the ground under its four wheels (the plane through them, as the module's pads), when finer heights have arrived and not
   * more often than every 1.5 s. `ground` probes the GPU: a few calls per fit, so it is rationed.
   */
  refitRover(now: number, patchRevision: number, ground: (e: number, n: number) => number, camDistM: number): void {
    const r = this.rover
    if (!r) return
    r.root.visible = !!r.placed && camDistM < ActorLayer.ROVER_DRAW_M // nothing of it is drawn from far away
    // Each fit is a few GPU readbacks, so it is rationed: a first placement within 500 m; a re-fit for finer heights only when it can be seen (within 200 m) and 4 s apart.
    const first = !r.placed || r.placed.z < PLACEMENT_INVALID_Z
    const needs = first ? camDistM < 500 : patchRevision !== this.roverRev && camDistM < 200
    if (!needs || now - this.roverFitAt < (first ? 1500 : 4000)) return
    this.roverFitAt = now
    const p = fitPlacement(r.pads, r.headingDeg, (de, dn) => ground(r.e + de, r.n + dn), { maxTiltDeg: 25 })
    if (p.z < PLACEMENT_INVALID_Z) return // the ground cannot answer yet: try again later
    r.placed = p
    this.roverRev = patchRevision
    r.root.position.set(r.e, p.z, -r.n)
    r.root.quaternion.copy(attitudeQuat(p))
    r.root.visible = camDistM < ActorLayer.ROVER_DRAW_M
    r.root.updateMatrixWorld(true)
    this.placeBlob(r.shadow, r.e, r.n, p.z, 0)
  }

  /** The Sun's direction in the frame (unit, east/north/up), the exposure scale and how much of the Sun reaches the ground. */
  updateLight(sunFrame: THREE.Vector3, preExpose: number, sunShare: number, bounce: number): void {
    const s3 = enu(sunFrame.x, sunFrame.y, sunFrame.z).normalize()
    this.sunDir.copy(s3)
    this.sun.intensity = Math.PI * preExpose * sunShare
    this.sun.castShadow = sunShare > 0.01
    this.ambient.intensity = bounce * preExpose
    this.scene.environmentIntensity = preExpose
    // The shadow camera follows what it shades (the rover): 30 m up the Sun's ray.
    const at = this.rover?.root.position ?? new THREE.Vector3()
    this.sun.position.copy(s3).multiplyScalar(30).add(at)
    this.sun.target.position.copy(at)
    this.sun.target.updateMatrixWorld()
    const elev = Math.max(0.05, Math.min(1.4, Math.asin(Math.max(0, Math.min(1, sunFrame.z)))))
    this.sunElev = elev
    const sh = Math.max(0.0, Math.min(0.6, sunShare * 0.6))
    for (const s of [this.rover?.shadow]) if (s) (s.mesh.material as THREE.MeshBasicMaterial).opacity = sh
  }
  private sunElev = 0.2

  /** Lays a soft shadow decal on the ground at (e, n), stretched away from the Sun by the Sun's height. `lengthM` 0 = the rover's own size. */
  private placeBlob(s: Shadow, e: number, n: number, z: number, lengthM: number): void {
    const away = new THREE.Vector3(-this.sunDir.x, 0, -this.sunDir.z)
    const len = away.length() > 1e-4 ? away.normalize() : new THREE.Vector3(1, 0, 0)
    const stretch = lengthM > 0 ? Math.min(14, Math.max(0.9, lengthM / Math.tan(this.sunElev))) : 1
    if (lengthM > 0) s.mesh.scale.set(stretch, 0.8, 1)
    s.mesh.position.set(e + len.x * (lengthM > 0 ? stretch * 0.45 : 0.4), z + 0.03, -n + len.z * (lengthM > 0 ? stretch * 0.45 : 0.4))
    s.mesh.rotation.set(-Math.PI / 2, 0, 0)
    s.mesh.rotateZ(Math.atan2(-len.z, len.x))
  }

  render(renderer: THREE.WebGLRenderer, view: GroundView, aspect: number): void {
    if (!this.rover?.root.visible) return
    const cam = this.camera
    cam.fov = 2 * Math.atan(view.tanHalf) * 180 / Math.PI
    cam.aspect = aspect
    cam.near = G_NEAR
    cam.far = G_FAR
    cam.updateProjectionMatrix()
    const b = groundBasis(view)
    const r = enu(b.right.x, b.right.y, b.right.z), u = enu(b.up.x, b.up.y, b.up.z), k = enu(b.back.x, b.back.y, b.back.z)
    cam.matrixAutoUpdate = false
    cam.matrixWorld.makeBasis(r, u, k).setPosition(enu(view.pos.x, view.pos.y, view.pos.z))
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    // Their own shadow map is redrawn each frame (the module's is redrawn only when the Sun or the module moves).
    renderer.shadowMap.needsUpdate = true
    renderer.render(this.scene, cam)
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mt = m.material as THREE.Material | THREE.Material[] | undefined
      ;(Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose())
    })
    this.blobTex?.dispose()
  }
}
