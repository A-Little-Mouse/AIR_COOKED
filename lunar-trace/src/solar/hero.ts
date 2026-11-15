import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from './gltf.ts';
import { BODY_BY_ID, type BodyDef } from './bodies.ts';
import { localPosition, orientation } from './ephemeris.ts';
import { loadBody } from './loadBody.ts';
import { pickHeroTime } from './heroTime.ts';
import { SurfaceScene } from './surface.ts';

/**
 * Solar-system background for the title slide. True scale and true positions (scene units = km), as in the explorer.
 *  - 'earth-moon': an "Earthrise" shot. The camera hovers above the Moon's far side, the Moon fills the lower frame and Earth
 *    sits just beyond its limb (true sizes and distances: Earth is small because it really is 384,400 km away).
 *  - 'mars': a sunlit view of Mars (the "View Mars" button).
 */
export type Shot = 'earth-moon' | 'mars';

const DAY_MS = 86_400_000;
const DEG = Math.PI / 180;
const FOV = 26;
const SUN_LIGHT = 3.6; // ~pi: a fully sunlit white surface renders at its albedo; no distance falloff, like NASA Eyes
const BLEND_SECONDS = 2.4;
const FADE_SECONDS = 0.9;
const PHASE_SECONDS = { orbit: 11, dive: 6, surface: 26 };
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

interface Placed { def: BodyDef; anchor: THREE.Group; pivot: THREE.Group; world: THREE.Vector3; spinRate: number }

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.001, 1e13);
  private placed = new Map<string, Placed>();
  private simMs = pickHeroTime(Date.now());
  private shot: Shot = 'earth-moon';
  private blend = 1;
  private fromPos = new THREE.Vector3();
  private fromQuat = new THREE.Quaternion();
  private raf = 0;
  private lastMs = 0;
  private elapsed = 0;
  private disposed = false;
  private surface: SurfaceScene | null = null;
  private cycleOn = true;
  private view: 'space' | 'surface' = 'space';
  private phase: 'idle' | 'orbit' | 'dive' | 'surface' = 'idle';
  private phaseT = 0;
  private fading = false;
  private altitude = 9000; // km above the Moon in the Earthrise shot
  private ready = false;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private onResize = () => this.resize();
  private tmp = new THREE.Vector3();
  private mat = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private spinQ = new THREE.Quaternion();

  constructor(private canvas: HTMLCanvasElement, private captionEl: HTMLElement | null = null) {
    // Log depth: the scene spans ~1e3 km (Moon/Earth) to ~2e8 km (Mars' orbit).
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0); // transparent: the page's own background shows behind the bodies
    this.scene.add(new THREE.PointLight(0xfff1dc, SUN_LIGHT, 0, 0)); // the Sun, at the origin
    this.scene.add(new THREE.AmbientLight(0x1a2236, 0.6));
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  /** Load Earth, Moon and Mars (the Sun is just the light), then start rendering. */
  async load(): Promise<void> {
    const loader = createGLTFLoader();
    const defs = (['earth', 'moon', 'mars'] as const).map((id) => BODY_BY_ID.get(id)!);
    const models = await Promise.all(defs.map(async (def) => ({ def, wrapper: (await loadBody(def, loader)).wrapper })));
    if (this.disposed) return;
    for (const { def, wrapper } of models) {
      const anchor = new THREE.Group();
      const pivot = new THREE.Group();
      wrapper.scale.multiplyScalar(def.radiusKm);
      pivot.add(wrapper);
      anchor.add(pivot);
      // Earth and Mars turn slowly for life; the Moon is tidally locked so it stays put.
      this.placed.set(def.id, { def, anchor, pivot, world: new THREE.Vector3(), spinRate: def.id === 'moon' ? 0 : (Math.PI * 2) / (def.id === 'earth' ? 90 : 140) });
    }
    this.scene.add(this.placed.get('earth')!.anchor, this.placed.get('mars')!.anchor);
    this.placed.get('earth')!.anchor.add(this.placed.get('moon')!.anchor); // the Moon rides on Earth, as in the explorer
    this.updateBodies();
    this.applyPose(this.poseFor(this.shot, 0), 1);
    this.ready = true;
    this.lastMs = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (this.cycleOn) void this.loadSurface(loader); // the Tranquility Base shots are skipped when the scene is only a placeholder (setCycle(false))
  }

  /** The ground-level Tranquility Base scene streams in after the first frame; the cycle starts once it is ready. */
  private async loadSurface(loader: GLTFLoader): Promise<void> {
    try {
      const surface = new SurfaceScene();
      await surface.loadLander(loader);
      if (this.disposed) { surface.dispose(); return; }
      this.surface = surface;
      this.resize();
      this.phase = 'orbit';
      this.phaseT = 0;
    } catch (e) {
      console.error('Tranquility Base scene failed to load; staying on Earthrise', e);
    }
  }

  /**
   * Cycle: Earthrise (hold) -> dive toward the Moon -> fade -> Tranquility Base (hold) -> fade -> Earthrise ...
   * Fades use the canvas opacity; the swap between the two scenes happens while it is fully transparent.
   */
  private advanceCycle(dt: number): void {
    if (!this.surface || this.reduced || this.phase === 'idle') return;
    this.phaseT += dt;
    const T = PHASE_SECONDS;
    switch (this.phase) {
      case 'orbit':
        if (this.phaseT > T.orbit) this.enter('dive');
        break;
      case 'dive': {
        const k = Math.min(1, this.phaseT / T.dive);
        this.altitude = 9000 - (9000 - 2200) * ease(k);
        if (this.phaseT > T.dive - FADE_SECONDS && !this.fading) this.fade(true);
        if (this.phaseT >= T.dive) { this.view = 'surface'; this.enter('surface'); this.caption(true); this.fade(false); }
        break;
      }
      case 'surface':
        if (this.phaseT > T.surface - FADE_SECONDS && !this.fading) this.fade(true);
        if (this.phaseT >= T.surface) { this.view = 'space'; this.altitude = 9000; this.caption(false); this.enter('orbit'); this.fade(false); }
        break;
      default:
    }
  }

  private enter(p: 'orbit' | 'dive' | 'surface'): void { this.phase = p; this.phaseT = 0; }

  private fade(out: boolean): void {
    this.fading = out;
    this.canvas.style.opacity = out ? '0' : '';
  }

  private caption(on: boolean): void {
    if (!this.captionEl) return;
    this.captionEl.classList.toggle('on', on);
    document.body.classList.toggle('ground-view', on);
  }

  /** Dev-only: jump straight to a phase (used by screenshots). */
  debugGoto(p: 'orbit' | 'dive' | 'surface', t = 0): void {
    this.view = p === 'surface' ? 'surface' : 'space';
    this.altitude = 9000;
    this.phase = p;
    this.phaseT = t;
    this.fading = false;
    this.canvas.style.opacity = '';
    this.caption(p === 'surface');
  }

  /** false: hold Earthrise only (no dive, no ground scene, none of its models loaded). Call before `load`. */
  setCycle(on: boolean): void { this.cycleOn = on }

  setShot(shot: Shot): void {
    if (shot === this.shot) return;
    this.shot = shot;
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.blend = this.reduced ? 1 : 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mt = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
    });
    this.surface?.dispose();
    this.renderer.dispose();
  }

  /** Whether the first frame has been drawn (the page fades the canvas in once it is). */
  isReady(): boolean { return this.ready; }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Wide screens: the copy is on the left, so push the scene to the right (the hero's own two-column layout).
    if (w > 940) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (this.surface) {
      const c = this.surface.camera;
      c.aspect = w / h;
      if (w > 940) c.setViewOffset(w, h, -w * 0.2, 0, w, h); else c.clearViewOffset();
      c.updateProjectionMatrix();
    }
  }

  private updateBodies(): void {
    for (const p of this.placed.values()) {
      localPosition(p.def, this.simMs, p.anchor.position);
      p.pivot.quaternion.copy(orientation(p.def, this.simMs, this.qa));
    }
    this.scene.updateMatrixWorld();
    for (const p of this.placed.values()) p.anchor.getWorldPosition(p.world);
  }

  /** Camera position + look direction for a shot at time t (seconds). Gentle swings keep it alive without ever cutting. */
  private poseFor(shot: Shot, t: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
    const swing = this.reduced ? 0 : t;
    if (shot === 'mars') {
      const mars = this.placed.get('mars')!;
      const dir = mars.world.clone().negate().normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.5 * Math.sin(swing * 0.08));
      dir.y += 0.25;
      dir.normalize();
      return { pos: mars.world.clone().addScaledVector(dir, mars.def.radiusKm * 7.5), dir: dir.clone().negate() };
    }
    // Earthrise: camera above the Moon, Earth beyond the limb.
    const moon = this.placed.get('moon')!, earth = this.placed.get('earth')!;
    const e = earth.world.clone().sub(moon.world).normalize(); // Moon -> Earth
    const up = new THREE.Vector3(0, 1, 0);
    const u = up.sub(e.clone().multiplyScalar(e.dot(up))).normalize(); // "north", perpendicular to e
    u.applyAxisAngle(e, 0.22 * Math.sin(swing * 0.1)); // slow roll of the viewpoint around the Earth-Moon axis
    const altitude = this.altitude; // km above the Moon's surface
    const d = moon.def.radiusKm + altitude;
    const moonRadiusAngle = Math.asin(moon.def.radiusKm / d);
    const psi = moonRadiusAngle + (4 + 1.2 * Math.sin(swing * 0.07)) * DEG; // Earth sits ~4 degrees outside the limb
    const n = e.clone().multiplyScalar(-Math.cos(psi)).addScaledVector(u, Math.sin(psi)); // Moon centre -> camera
    const pos = moon.world.clone().addScaledVector(n, d);
    const dir = n.clone().negate().add(e).normalize(); // aim between the Moon's centre and Earth
    return { pos, dir };
  }

  private applyPose(p: { pos: THREE.Vector3; dir: THREE.Vector3 }, k: number): void {
    this.mat.lookAt(p.pos, this.tmp.copy(p.pos).add(p.dir), THREE.Object3D.DEFAULT_UP);
    this.qa.setFromRotationMatrix(this.mat);
    if (k >= 1) {
      this.camera.position.copy(p.pos);
      this.camera.quaternion.copy(this.qa);
    } else {
      this.camera.position.lerpVectors(this.fromPos, p.pos, k);
      this.camera.quaternion.slerpQuaternions(this.fromQuat, this.qa, k);
    }
  }

  private frame = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min((now - this.lastMs) / 1000, 0.1);
    this.lastMs = now;
    if (!this.reduced) this.elapsed += dt;

    // slow axial spin on top of the true (fixed-time) orientation: reset to it, then add the spin for this instant
    for (const p of this.placed.values()) {
      p.pivot.quaternion.copy(orientation(p.def, this.simMs, this.qa));
      if (p.spinRate) p.pivot.quaternion.multiply(this.spinQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.elapsed * p.spinRate));
    }
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / BLEND_SECONDS);
    this.advanceCycle(dt);
    this.applyPose(this.poseFor(this.shot, this.elapsed), ease(this.blend));
    if (this.view === 'surface' && this.surface) {
      this.surface.setCameraPose(this.reduced ? 0 : this.phaseT);
      this.renderer.render(this.surface.scene, this.surface.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };
}
