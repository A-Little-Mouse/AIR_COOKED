import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type GroundView, groundBasis } from '../frame'
import { G_FAR, G_NEAR } from '../GroundPass'
import { textureBytes } from '../../quality/ledger'
import { trackGpu } from '../../quality/track'
import { type Placement, attitudeQuat, fitPlacement, PLACEMENT_INVALID_Z } from '../lmPlacement'

// Draws the lunar rovers on the ground: the real Apollo 17 rover at Station 1, plus an extra one near the lunar module (the heading of both is a guess).
const ROVER_LENGTH_M = 3.1
const enu = (e: number, n: number, u: number): THREE.Vector3 => new THREE.Vector3(e, u, -n)

interface Shadow { mesh: THREE.Mesh }

export class ActorLayer {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 1, G_NEAR, G_FAR)
  private readonly sun = new THREE.DirectionalLight(0xffffff, Math.PI)
  private readonly ambient = new THREE.AmbientLight(0xffffff, 0)
  private blobTex: THREE.Texture | null = null
  private get blob(): THREE.Texture { return (this.blobTex ??= ActorLayer.blobTexture()) } // made the first time it's needed


  // The rovers once loaded: where each stands, which way it faces, and where its wheels touch.
  private rovers: Array<{ root: THREE.Group; pads: THREE.Vector3[]; shadow: Shadow; e: number; n: number; headingDeg: number; placed: Placement | null; rev: number; fitAt: number }> = []
  // Where the rovers should stand (the first is the real Apollo 17 rover).
  private roverSites: Array<{ e: number; n: number; headingDeg: number }> = []
  // The rover the Sun's shadow is drawn for (the nearest one).
  private shadowFocus = 0

  private sunDir = new THREE.Vector3(0, 1, 0)

  constructor() {
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(512, 512) // sharp enough for a rover
    trackGpu('lm', 'actor-shadow-est', 512 * 512 * 4)
    const c = this.sun.shadow.camera
    c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.near = 1; c.far = 80
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun, this.sun.target, this.ambient)
  }

  // Makes a soft round picture used as a fake shadow under each rover.
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

  // Makes one fake shadow patch for a rover.
  private makeShadow(): Shadow {
    const mat = new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 2
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return { mesh }
  }

  // Makes a model loader that can open compressed files.
  private loaderFor(base: string): GLTFLoader {
    const loader = new GLTFLoader()
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath(`${base}draco/`)) // the rover file is compressed
    return loader
  }

  private roverRequested = false
  // How close the visitor must be to load the rover, and how far away it is still drawn (metres).
  private static readonly ROVER_LOAD_M = 400
  private static readonly ROVER_DRAW_M = 900

  // Loads the rover model once the visitor is within 400 m of any rover.
  maybeLoadRover(base: string, camE: number, camN: number): void {
    if (this.roverRequested || !this.roverSites.some((s) => Math.hypot(camE - s.e, camN - s.n) <= ActorLayer.ROVER_LOAD_M)) return
    this.roverRequested = true
    void this.loadRover(this.loaderFor(base), `${base}actors/lunar-roving-vehicle.glb`).catch((err) => { console.error('rover failed to load', err); this.roverRequested = false })
  }

  // Loads the rover model and makes one copy for each stand.
  private async loadRover(loader: GLTFLoader, url: string): Promise<void> {
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const alongX = size.x >= size.z // the longest side is the rover's length
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
    for (let i = 0; i < this.roverSites.length; i++) {
      const r = i === 0 ? root : root.clone(true) // copies share the same textures
      r.visible = false
      this.scene.add(r)
      const shadow = this.makeShadow()
      shadow.mesh.visible = false
      shadow.mesh.scale.set(ROVER_LENGTH_M * 1.25, 2.4, 1)
      this.rovers.push({ root: r, pads, shadow, e: 0, n: 0, headingDeg: 90, placed: null, rev: -1, fitAt: -1e9 })
    }
    this.roverSites.forEach((s, i) => this.placeRoverAt(i, s.e, s.n, s.headingDeg))
  }

  // Sets where the first rover stands and which way it faces.
  setRoverSite(e: number, n: number, headingDeg: number): void {
    this.roverSites[0] = { e, n, headingDeg }
    this.placeRoverAt(0, e, n, headingDeg)
  }

  // Adds another rover at a spot.
  addRoverSite(e: number, n: number, headingDeg: number): void {
    this.roverSites.push({ e, n, headingDeg })
    this.placeRoverAt(this.roverSites.length - 1, e, n, headingDeg)
  }

  // Updates a rover's spot and marks it to be re-fitted to the ground.
  private placeRoverAt(i: number, e: number, n: number, headingDeg: number): void {
    const r = this.rovers[i]
    if (!r) return
    Object.assign(r, { e, n, headingDeg, placed: null, rev: -1 })
  }

  // Returns where the first rover stands, for the "go to" button.
  roverPosition(): { e: number; n: number } | null { const s = this.roverSites[0]; return s ? { e: s.e, n: s.n } : null }
  get roverReady(): boolean { return this.rovers.length > 0 }

  // Sits each rover on the ground under its wheels, once the terrain detail is loaded.
  refitRovers(now: number, patchRevision: number, ground: (e: number, n: number) => number, camE: number, camN: number): void {
    let nearest = Infinity
    this.rovers.forEach((r, i) => {
      const camDistM = Math.hypot(camE - r.e, camN - r.n)
      if (camDistM < nearest) { nearest = camDistM; this.shadowFocus = i }
      r.root.visible = !!r.placed && camDistM < ActorLayer.ROVER_DRAW_M // hide it when far away
      // Fitting is costly, so only do it when near and not too often.
      const first = !r.placed || r.placed.z < PLACEMENT_INVALID_Z
      const needs = first ? camDistM < 500 : patchRevision !== r.rev && camDistM < 200
      if (!needs || now - r.fitAt < (first ? 1500 : 4000)) return
      r.fitAt = now
      const p = fitPlacement(r.pads, r.headingDeg, (de, dn) => ground(r.e + de, r.n + dn), { maxTiltDeg: 25 })
      if (p.z < PLACEMENT_INVALID_Z) return // ground not ready yet, try later
      r.placed = p
      r.rev = patchRevision
      r.root.position.set(r.e, p.z, -r.n)
      r.root.quaternion.copy(attitudeQuat(p))
      r.root.visible = camDistM < ActorLayer.ROVER_DRAW_M
      r.root.updateMatrixWorld(true)
      this.placeBlob(r.shadow, r.e, r.n, p.z, 0)
    })
  }

  // Updates the lighting to match the Sun and the ground's exposure.
  updateLight(sunFrame: THREE.Vector3, preExpose: number, sunShare: number, bounce: number): void {
    const s3 = enu(sunFrame.x, sunFrame.y, sunFrame.z).normalize()
    this.sunDir.copy(s3)
    this.sun.intensity = Math.PI * preExpose * sunShare
    this.sun.castShadow = sunShare > 0.01
    this.ambient.intensity = bounce * preExpose
    this.scene.environmentIntensity = preExpose
    // Aim the shadow at the nearest rover.
    const at = this.rovers[this.shadowFocus]?.root.position ?? new THREE.Vector3()
    this.sun.position.copy(s3).multiplyScalar(30).add(at)
    this.sun.target.position.copy(at)
    this.sun.target.updateMatrixWorld()
    const elev = Math.max(0.05, Math.min(1.4, Math.asin(Math.max(0, Math.min(1, sunFrame.z)))))
    this.sunElev = elev
    const sh = Math.max(0.0, Math.min(0.6, sunShare * 0.6))
    for (const r of this.rovers) (r.shadow.mesh.material as THREE.MeshBasicMaterial).opacity = sh
  }
  private sunElev = 0.2

  // Lays a soft shadow patch on the ground, stretched away from the Sun.
  private placeBlob(s: Shadow, e: number, n: number, z: number, lengthM: number): void {
    const away = new THREE.Vector3(-this.sunDir.x, 0, -this.sunDir.z)
    const len = away.length() > 1e-4 ? away.normalize() : new THREE.Vector3(1, 0, 0)
    const stretch = lengthM > 0 ? Math.min(14, Math.max(0.9, lengthM / Math.tan(this.sunElev))) : 1
    if (lengthM > 0) s.mesh.scale.set(stretch, 0.8, 1)
    s.mesh.position.set(e + len.x * (lengthM > 0 ? stretch * 0.45 : 0.4), z + 0.03, -n + len.z * (lengthM > 0 ? stretch * 0.45 : 0.4))
    s.mesh.rotation.set(-Math.PI / 2, 0, 0)
    s.mesh.rotateZ(Math.atan2(-len.z, len.x))
  }

  // Draws the rovers on top of the ground.
  render(renderer: THREE.WebGLRenderer, view: GroundView, aspect: number): void {
    if (!this.rovers.some((r) => r.root.visible)) return
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
    // Redraw the rovers' shadows every frame.
    renderer.shadowMap.needsUpdate = true
    renderer.render(this.scene, cam)
  }

  // Frees the graphics memory.
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
