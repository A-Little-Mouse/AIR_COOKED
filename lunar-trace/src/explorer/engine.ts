import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../solar/gltf.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { BodyDef } from '../solar/bodies.ts';
import { bodiesOf, craftOf, lightOnlyOf, type WorldId } from '../solar/world.ts';
import { J2000_MS, localPosition, orbitPoints, orientation, poleVector } from '../solar/ephemeris.ts';
import { orbitLinePoints, placeL1, placeOrbiter, surfaceDirection } from '../solar/craft.ts';
import { loadBody, makeGlow } from '../solar/loadBody.ts';

/** Time rates, simulated seconds per real second. */
export const RATES: Array<{ value: number; label: string }> = [
  { value: -31_557_600, label: '−1 yr/s' }, { value: -2_629_800, label: '−1 mo/s' }, { value: -604_800, label: '−1 wk/s' },
  { value: -86_400, label: '−1 day/s' }, { value: -3_600, label: '−1 hr/s' }, { value: -60, label: '−1 min/s' }, { value: -1, label: '−1 s/s' },
  { value: 1, label: 'Real time' }, { value: 60, label: '1 min/s' }, { value: 3_600, label: '1 hr/s' }, { value: 86_400, label: '1 day/s' },
  { value: 604_800, label: '1 wk/s' }, { value: 2_629_800, label: '1 mo/s' }, { value: 31_557_600, label: '1 yr/s' },
];
export const REAL_TIME_INDEX = 7;

export interface Layers { orbits: boolean; labels: boolean }
export interface Snapshot {
  timeMs: number;
  rateIndex: number;
  paused: boolean;
  selectedId: string;
  freeFly: boolean;
  /** Selected body's distance from the Sun, km. */
  distFromSunKm: number;
  /** Camera height above the selected body's surface, km. */
  altitudeKm: number;
}
export interface Callbacks {
  onSelect: (id: string) => void;
  onFreeFly: (on: boolean) => void;
  onProgress: (done: number, total: number) => void;
  onReady: () => void;
  onSnapshot: (s: Snapshot) => void;
  onInteract: () => void;
  /** A flight to a body has finished. */
  onArrive?: (id: string) => void;
}

interface Body {
  def: BodyDef;
  anchor: THREE.Group; // position, relative to the parent body (never rotates)
  world: THREE.Vector3; // world position, km (double precision)
  pick: THREE.Mesh;
  line: THREE.LineLoop | null;
  label: HTMLButtonElement;
  /** Moons and spacecraft only count (label, click target) while the camera is near their parent. */
  near: boolean;
  /** Drawn and lighting the scene, but not labelled, listed or clickable (the Sun in the Mars world). */
  lightOnly?: boolean;
}
interface Flight { target: Body; t: number; dur: number; p0: THREE.Vector3; q0: THREE.Quaternion; offset: THREE.Vector3 }

const DEG = Math.PI / 180;
const FOV = 60; // NASA Eyes default (1.0472 rad)
const SPEED_DRAG = 0.01; // rad per pixel (Eyes: drag sensitivity)
const SPEED_KEY = 0.01; // rad per frame
const SPEED_ZOOM = 0.05; // log2 per frame
const SMOOTH = 0.8; // Eyes: per-frame smoothing (at 60 fps)
const SUN_LIGHT = 3.6; // ~pi: a fully sunlit white surface renders at its albedo; same at every distance, like Eyes
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerpTo = (target: number, prev: number, f: number) => target + (prev - target) * f; // Eyes' lerp(o, smoothed, 0.8)

/**
 * Scene + camera. Scene units are kilometres at TRUE scale (true sizes, true distances).
 * Navigation follows NASA Eyes on the Solar System (Pioneer engine):
 *  - Orbit mode (default): camera orbits the selected body. Drag / A D = yaw, Q E = pitch, wheel / W S = zoom (multiplicative
 *    in altitude, so it works from Neptune's orbit down to a few metres), Z C = roll, Shift = 5x, X = 0.05x.
 *  - Free-fly (K toggles): W S forward/back, A D strafe, E Q up/down, drag = look, wheel = forward/back. Speed is proportional
 *    to the distance to the nearest body, so you slow down automatically as you approach one.
 *  - Click a body, label or list entry to fly to it.
 */
/** A soft white-to-warm radial glare sprite. */
function makeSunGlare(): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,252,240,1)'); grad.addColorStop(0.06, 'rgba(255,244,215,.9)'); grad.addColorStop(0.2, 'rgba(255,214,160,.32)'); grad.addColorStop(0.5, 'rgba(255,190,130,.08)'); grad.addColorStop(1, 'rgba(255,190,130,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
}

export class SolarEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1e-5, 1e13);
  private composer: EffectComposer;
  private bodies: Body[] = [];
  private byId = new Map<string, Body>();
  private lastFrameMs = 0;
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;
  private ready = false;
  private loader = createGLTFLoader();
  private modelCache = new Map<string, Promise<THREE.Group>>();
  private craftLoads = new Map<string, Promise<void>>();

  // time
  private timeMs = Date.now();
  private rateIndex = REAL_TIME_INDEX;
  private paused = false;
  private layers: Layers = { orbits: true, labels: true };

  // navigation
  private mode: 'orbit' | 'freefly' = 'orbit';
  private target!: Body;
  private lat = 0.15;
  private lon = 0.6;
  private dist = 1;
  private flight: Flight | null = null;
  private yawS = 0; private pitchS = 0; private zoomS = 1; private rollS = 0; private roll = 0;
  private moveS = new THREE.Vector3();
  private nearest: Body | null = null;
  private nearestLast = new THREE.Vector3();
  private dragX = 0; private dragY = 0; private zoomOffset = 0;
  private dragging = false;
  private down = { x: 0, y: 0, t: 0 };
  private keys = new Set<string>();
  private lastSnapshot = 0;

  private raycaster = new THREE.Raycaster();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private mat = new THREE.Matrix4();
  private canvas: HTMLCanvasElement;
  private cleanups: Array<() => void> = [];

  constructor(private mount: HTMLElement, private labelLayer: HTMLElement, private cb: Callbacks, private world: WorldId = 'solar') {
    // Log depth: one scene spans metres (Phobos) to ~10^10 km (Neptune's orbit and beyond).
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'none';
    mount.appendChild(this.canvas);
    this.scene.background = new THREE.Color(0x000000);

    // The Sun lights everything with no distance falloff (like Eyes), so the outer planets stay readable.
    this.scene.add(new THREE.PointLight(0xfff1dc, SUN_LIGHT, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x1a2236, this.world === 'mars' ? 1.8 : 0.6)); // Mars: the night side stays faintly visible, as on the Moon page

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.3, 1.15));
    this.composer.addPass(new OutputPass());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(mount);
    this.resize();
    this.bindInput();
  }

  // ---------------------------------------------------------------- setup

  /** Load all models, build the scene, start at `initialId` (instantly, like Eyes' embed view). */
  async start(initialId: string, timeMs?: number, rateIndex?: number): Promise<void> {
    if (timeMs !== undefined) this.timeMs = timeMs;
    if (rateIndex !== undefined) this.rateIndex = rateIndex;
    const loader = this.loader;
    let done = 0;
    const BODIES = bodiesOf(this.world), CRAFT_BODIES = craftOf(this.world);
    this.cb.onProgress(0, BODIES.length);
    const loaded = await Promise.all(
      [...BODIES, ...lightOnlyOf(this.world)].map(async (def) => {
        const m = await loadBody(def, loader);
        this.cb.onProgress(++done, BODIES.length);
        return { def, wrapper: m.wrapper };
      }),
    );
    if (this.disposed) return;

    const pickGeo = new THREE.SphereGeometry(1, 12, 8);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const { def, wrapper } of loaded) {
      const anchor = new THREE.Group();
      const pivot = new THREE.Group(); // spin / pole orientation
      wrapper.scale.multiplyScalar(def.radiusKm);
      pivot.add(wrapper);
      anchor.add(pivot);
      anchor.userData.pivot = pivot;
      if (def.type === 'star') {
        // From Mars the Sun is a tiny disc, so the Mars world draws a plain radial glare around it (the solar-system glow texture has a hole sized for the full-size Sun).
        const glow = this.world === 'mars' ? makeSunGlare() : makeGlow();
        glow.scale.setScalar(def.radiusKm * (this.world === 'mars' ? 50 : 6));
        anchor.add(glow);
      }
      const pick = new THREE.Mesh(pickGeo, pickMat); // invisible click target, enlarged with distance
      anchor.add(pick);

      let line: THREE.LineLoop | null = null;
      if (def.type !== 'star' && this.world === 'solar') { // the Mars world has no orbit lines
        const pts = orbitPoints(def, this.timeMs, def.type === 'moon' ? 360 : 4096);
        line = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: def.type === 'moon' ? 0x9a8cff : 0x5b86c9, transparent: true, opacity: 0.55 }),
        );
      }

      const label = document.createElement('button');
      label.className = 'body-label';
      label.innerHTML = `<span class="dot"></span><span class="name">${def.name}</span>`;
      label.addEventListener('pointerdown', (e) => e.stopPropagation());
      label.addEventListener('click', () => this.travelTo(def.id));
      this.labelLayer.appendChild(label);

      const body: Body = { def, anchor, world: new THREE.Vector3(), pick, line, label, near: true, lightOnly: lightOnlyOf(this.world).includes(def) };
      if (body.lightOnly) { body.near = false; label.style.display = 'none'; }
      this.bodies.push(body);
      this.byId.set(def.id, body);
    }
    // parent/child wiring: moons ride on their parent's anchor; planets on the scene (Sun at the origin)
    for (const b of this.bodies) {
      const parent = b.def.parent ? this.byId.get(b.def.parent)!.anchor : this.scene;
      parent.add(b.anchor);
      if (b.line) parent.add(b.line);
    }
    const initialCraft = CRAFT_BODIES.find((c) => c.id === initialId);
    if (initialCraft) await this.loadCraft(initialCraft);
    if (this.disposed) return;
    this.updateBodies();
    this.ready = true;
    this.target = this.byId.get(initialId) ?? this.bodies[0];
    this.travelTo(this.target.def.id, true);
    this.cb.onReady();
    this.lastFrameMs = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    void this.loadAllCraft();
  }

  /** Spacecraft models are large, so they stream in after the planets are on screen (or on demand when selected). */
  private async loadAllCraft(): Promise<void> {
    for (const def of craftOf(this.world)) {
      if (this.disposed) return;
      await this.loadCraft(def);
    }
  }

  private loadCraft(def: BodyDef): Promise<void> {
    let p = this.craftLoads.get(def.id);
    if (p) return p;
    let model = this.modelCache.get(def.model); // Spirit and Opportunity share one model
    if (!model) {
      model = loadBody(def, this.loader).then((m) => m.wrapper);
      this.modelCache.set(def.model, model);
    }
    p = model
      .then((wrapper) => { if (!this.disposed) this.addCraft(def, wrapper.clone(true)); })
      .catch((e) => console.error(`Failed to load ${def.model}`, e));
    this.craftLoads.set(def.id, p);
    return p;
  }

  private addCraft(def: BodyDef, wrapper: THREE.Group): void {
    const site = def.craft!;
    const parent = this.byId.get(def.parent!)!;
    const anchor = new THREE.Group();
    const pivot = new THREE.Group();
    wrapper.scale.multiplyScalar(def.radiusKm);
    pivot.add(wrapper);
    anchor.add(pivot);
    anchor.userData.pivot = pivot;
    const pick = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    anchor.add(pick);

    let line: THREE.LineLoop | null = null;
    if (site.kind === 'surface') {
      // glued to the surface: a child of the parent's spinning model, standing along the local vertical
      const n = surfaceDirection(def.parent!, site.latDeg, site.lonDeg, new THREE.Vector3());
      anchor.position.copy(n).multiplyScalar(parent.def.radiusKm + def.radiusKm * 0.35);
      anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      (parent.anchor.userData.pivot as THREE.Group).add(anchor);
    } else {
      parent.anchor.add(anchor);
      if (site.kind === 'orbit') {
        line = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(orbitLinePoints(site)),
          new THREE.LineBasicMaterial({ color: 0x5fd8b0, transparent: true, opacity: 0.5 }),
        );
        parent.anchor.add(line);
      }
    }

    const label = document.createElement('button');
    label.className = 'body-label';
    label.innerHTML = `<span class="dot"></span><span class="name">${def.name}</span>`;
    label.addEventListener('pointerdown', (e) => e.stopPropagation());
    label.addEventListener('click', () => this.travelTo(def.id));
    label.style.display = 'none';
    this.labelLayer.appendChild(label);

    const body: Body = { def, anchor, world: new THREE.Vector3(), pick, line, label, near: false };
    this.bodies.push(body);
    this.byId.set(def.id, body);
    this.scene.updateMatrixWorld();
    anchor.getWorldPosition(body.world);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.cleanups.forEach((f) => f());
    this.bodies.forEach((b) => b.label.remove());
    this.composer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mt = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    this.canvas.remove();
  }

  private resize(): void {
    const w = this.mount.clientWidth || 1, h = this.mount.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- public controls

  setLayers(l: Layers): void { this.layers = l; }
  setRateIndex(i: number): void { this.rateIndex = THREE.MathUtils.clamp(i, 0, RATES.length - 1); }
  setPaused(p: boolean): void { this.paused = p; }
  setTime(ms: number): void { this.timeMs = ms; }
  getTime(): number { return this.timeMs; }
  /** Back to the overview of the world's main body (the Moon page's Home). */
  home(): void { this.travelTo(this.bodies[0].def.id); }
  toggleFreeFly(): void { this.setFreeFly(this.mode !== 'freefly'); }
  getSelectedId(): string { return this.target?.def.id ?? this.bodies[0]?.def.id ?? 'sun'; }
  /** Read-only state for tests/debugging. */
  debug() {
    return {
      mode: this.mode, flying: !!this.flight, target: this.target?.def.id, lat: this.lat, lon: this.lon, dist: this.dist,
      cam: this.camera.position.toArray(), paused: this.paused, timeMs: this.timeMs, rateIndex: this.rateIndex,
      bodies: Object.fromEntries(this.bodies.map((b) => [b.def.id, b.world.toArray()])),
    };
  }

  setFreeFly(on: boolean): void {
    if (!this.ready) return;
    if (on && this.mode !== 'freefly') {
      this.flight = null;
      this.mode = 'freefly';
      this.nearest = null;
      this.moveS.set(0, 0, 0);
      this.resetSmoothing();
      this.cb.onFreeFly(true);
    } else if (!on && this.mode === 'freefly') {
      this.cb.onFreeFly(false);
      this.travelTo(this.target.def.id); // Eyes: leaving free-fly flies back to the selected body
    }
  }

  /** Fly to a body (instant = jump), then orbit it. Leaves free-fly, like Eyes. */
  travelTo(id: string, instant = false): void {
    const b = this.byId.get(id);
    if (!b) {
      const craft = craftOf(this.world).find((c) => c.id === id);
      if (craft && this.ready) void this.loadCraft(craft).then(() => { if (this.byId.has(id)) this.travelTo(id, instant); });
      return;
    }
    if (!this.ready) return;
    if (this.mode === 'freefly') { this.mode = 'orbit'; this.cb.onFreeFly(false); }
    this.target = b;
    this.cb.onSelect(id);
    this.resetSmoothing();
    this.roll = 0;

    // Approach from the sunlit side, slightly above the orbital plane (for the Sun: from where the camera is).
    const dir = id === 'sun' ? this.tmp.copy(this.camera.position).sub(b.world) : this.tmp.copy(b.world).negate();
    if (dir.lengthSq() < 1e-12) dir.set(0.4, 0.3, 1);
    dir.normalize();
    if (b.def.craft) {
      // Spacecraft: view from above the local horizon, on the sunlit side.
      const up = b.world.clone().sub(this.byId.get(b.def.parent!)!.world).normalize();
      const tang = dir.clone().addScaledVector(up, -dir.dot(up));
      if (tang.lengthSq() < 1e-6) tang.crossVectors(up, new THREE.Vector3(0, 1, 0));
      dir.copy(up).multiplyScalar(0.8).addScaledVector(tang.normalize(), 0.6);
    } else if (b.def.ringed) {
      // Lift the camera off the ring plane, onto the side the Sun is shining on, so the rings are lit and open.
      const pole = poleVector(b.def);
      dir.addScaledVector(pole, (dir.dot(pole) >= 0 ? 1 : -1) * 0.5);
    } else {
      if (this.world === 'mars' && id === 'mars') dir.applyAxisAngle(this.tmp2.set(0, 1, 0), -140 * DEG); // Mars as a crescent with the Sun glaring at the edge of the frame, as the Moon page shows the Moon
      dir.y += 0.25;
    }
    dir.normalize();
    const offset = dir.clone().multiplyScalar(b.def.radiusKm * b.def.viewRadii);

    if (instant) {
      this.flight = null;
      this.setOrbitFromOffset(offset);
      return;
    }
    const dest = b.world.clone().add(offset);
    const dur = THREE.MathUtils.clamp(0.5 + 0.35 * Math.log10(Math.max(this.camera.position.distanceTo(dest), 1)), 0.75, 4);
    this.flight = { target: b, t: 0, dur, p0: this.camera.position.clone(), q0: this.camera.quaternion.clone(), offset };
  }

  private setOrbitFromOffset(o: THREE.Vector3): void {
    this.dist = o.length();
    this.lat = Math.asin(THREE.MathUtils.clamp(o.y / this.dist, -1, 1));
    this.lon = Math.atan2(-o.z, o.x);
  }

  private resetSmoothing(): void {
    this.yawS = 0; this.pitchS = 0; this.zoomS = 1; this.rollS = 0;
  }

  // ---------------------------------------------------------------- input (mirrors Eyes' Input class)

  private bindInput(): void {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opt);
      this.cleanups.push(() => el.removeEventListener(type, fn));
    };
    const onWin = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn);
      this.cleanups.push(() => window.removeEventListener(type, fn));
    };

    on(this.canvas, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
      this.cb.onInteract();
    });
    on(this.canvas, 'pointermove', (e) => {
      if (this.dragging) { this.dragX += e.movementX; this.dragY += e.movementY; return; }
      this.canvas.style.cursor = this.pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
    });
    const up = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      // Eyes: a press shorter than 0.5 s that moves under 5 px is a click/select
      const isClick = performance.now() - this.down.t <= 500 && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) <= 5;
      const hit = isClick ? this.pickAt(e.clientX, e.clientY) : null;
      this.canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) this.travelTo(hit.def.id);
    };
    on(this.canvas, 'pointerup', up);
    on(this.canvas, 'pointercancel', up);
    on(this.canvas, 'wheel', (e) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
      this.zoomOffset += 0.1 * px;
      this.cb.onInteract();
    }, { passive: false });

    onWin('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) { this.keys.clear(); return; } // leave browser shortcuts alone
      const k = e.key.toLowerCase();
      if (k === 'k' && !e.repeat) this.toggleFreeFly();
      this.keys.add(k);
      if ('wasdqezcx'.includes(k) && k.length === 1) this.cb.onInteract();
    });
    onWin('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });
    onWin('blur', () => { this.keys.clear(); this.dragging = false; });
  }

  private pickAt(clientX: number, clientY: number): Body | null {
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hits = this.raycaster.intersectObjects(this.bodies.filter((b) => b.near).map((b) => b.pick), false);
    let best: Body | null = null;
    for (const h of hits) {
      const b = this.bodies.find((x) => x.pick === h.object)!;
      if (!best || b.def.radiusKm < best.def.radiusKm) best = b; // overlapping click areas (moon inside planet's): prefer the smaller
    }
    return best;
  }

  // ---------------------------------------------------------------- per frame

  private frame = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const nowMs = performance.now();
    const dt = Math.min((nowMs - this.lastFrameMs) / 1000, 0.1);
    this.lastFrameMs = nowMs;
    if (!this.paused) this.timeMs += dt * 1000 * RATES[this.rateIndex].value;
    this.updateBodies();
    if (this.flight) this.updateFlight(dt);
    else if (this.mode === 'orbit') this.updateOrbit(dt);
    else this.updateFreeFly(dt);
    this.dragX = this.dragY = this.zoomOffset = 0;
    this.updateOverlays();
    this.composer.render();
    const now = performance.now();
    if (now - this.lastSnapshot > 250) {
      this.lastSnapshot = now;
      this.cb.onSnapshot(this.snapshot());
    }
  };

  private snapshot(): Snapshot {
    const t = this.target;
    return {
      timeMs: this.timeMs, rateIndex: this.rateIndex, paused: this.paused, selectedId: t.def.id, freeFly: this.mode === 'freefly',
      distFromSunKm: t.world.length(), altitudeKm: Math.max(0, this.camera.position.distanceTo(t.world) - t.def.radiusKm),
    };
  }

  private updateBodies(): void {
    for (const b of this.bodies) {
      const c = b.def.craft;
      if (c) { // spacecraft: landers are fixed to their parent's surface; satellites and ACE are placed analytically
        if (c.kind === 'orbit') placeOrbiter(c, this.timeMs, J2000_MS, b.anchor.position, b.anchor.quaternion);
        else if (c.kind === 'l1') placeL1(c, this.byId.get(b.def.parent!)!.anchor.position, b.anchor.position);
        continue;
      }
      localPosition(b.def, this.timeMs, b.anchor.position);
      (b.anchor.userData.pivot as THREE.Group).quaternion.copy(orientation(b.def, this.timeMs, this.tmpQ));
    }
    this.scene.updateMatrixWorld();
    for (const b of this.bodies) b.anchor.getWorldPosition(b.world);
  }

  private modifier(): number { return this.keys.has('shift') ? 5 : this.keys.has('x') ? 0.05 : 1; }

  /** Orbit mode: camera on a sphere around the target, always looking at it. */
  private updateOrbit(dt: number): void {
    const fr = dt * 60, f = Math.pow(SMOOTH, fr);
    const mod = this.modifier();
    const m = mod * Math.min(1, FOV * DEG); // Eyes scales rotation by the field of view
    const K = this.keys;

    let yaw = -this.dragX * SPEED_DRAG * m, pitch = this.dragY * SPEED_DRAG * m;
    if (K.has('d')) yaw += SPEED_KEY * m * fr;
    if (K.has('a')) yaw -= SPEED_KEY * m * fr;
    if (K.has('e')) pitch -= SPEED_KEY * m * fr;
    if (K.has('q')) pitch += SPEED_KEY * m * fr;
    this.yawS = lerpTo(yaw, this.yawS, f);
    this.pitchS = lerpTo(pitch, this.pitchS, f);
    if (Math.abs(this.yawS) < 1e-4 * m) this.yawS = 0;
    if (Math.abs(this.pitchS) < 1e-4 * m) this.pitchS = 0;

    const radius = this.target.def.radiusKm;
    let alt = Math.max(this.dist - radius, 0);
    const u = Math.min(alt / radius, 1); // rotate slower near the surface
    this.lat = THREE.MathUtils.clamp(this.lat + this.pitchS * u, -Math.PI / 2 + 1e-4, Math.PI / 2 - 1e-4);
    this.lon += this.yawS * u;

    // zoom: multiplicative on altitude
    let zi = Math.pow(2, this.zoomOffset * SPEED_ZOOM * mod);
    if (K.has('w')) zi /= Math.pow(2, SPEED_ZOOM * mod * fr);
    if (K.has('s')) zi *= Math.pow(2, SPEED_ZOOM * mod * fr);
    this.zoomS = THREE.MathUtils.clamp(lerpTo(zi, this.zoomS, f), 0.8, 1.25);
    if (Math.abs(1 - this.zoomS) < 1e-7) this.zoomS = 1;
    const minAlt = radius * 1e-4;
    if (alt === 0 && this.zoomS > 1) alt = minAlt;
    alt = THREE.MathUtils.clamp(alt * this.zoomS, minAlt, 2e11);
    this.dist = radius + alt;

    // roll (Z / C)
    let r = 0;
    if (K.has('c')) r += SPEED_KEY * mod * fr;
    if (K.has('z')) r -= SPEED_KEY * mod * fr;
    this.rollS = lerpTo(r, this.rollS, f);
    if (Math.abs(this.rollS) < 1e-4) this.rollS = 0;
    this.roll += this.rollS;

    const c = Math.cos(this.lat);
    this.tmp.set(c * Math.cos(this.lon), Math.sin(this.lat), -c * Math.sin(this.lon)).multiplyScalar(this.dist);
    this.camera.position.copy(this.target.world).add(this.tmp);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target.world);
    if (this.roll !== 0) this.camera.rotateOnAxis(this.tmp2.set(0, 0, -1), this.roll);
  }

  /** Free-fly: 6-DoF flight whose speed scales with the distance to the nearest body. */
  private updateFreeFly(dt: number): void {
    const fr = dt * 60, f = Math.pow(SMOOTH, fr);
    const mod = this.modifier();
    const K = this.keys;

    // look: drag turns the view about the camera's own axes
    const lookMod = (this.keys.has('x') ? 0.05 : 1) * Math.min(1, FOV * DEG);
    this.yawS = lerpTo(-this.dragX * SPEED_DRAG * lookMod, this.yawS, f);
    this.pitchS = lerpTo(-this.dragY * SPEED_DRAG * lookMod, this.pitchS, f);
    if (Math.abs(this.yawS) < 1e-4 * lookMod) this.yawS = 0;
    if (Math.abs(this.pitchS) < 1e-4 * lookMod) this.pitchS = 0;
    this.camera.rotateY(this.yawS);
    this.camera.rotateX(this.pitchS);
    let r = 0;
    if (K.has('c')) r += SPEED_KEY * mod * fr;
    if (K.has('z')) r -= SPEED_KEY * mod * fr;
    this.rollS = lerpTo(r, this.rollS, f);
    if (Math.abs(this.rollS) < 1e-4) this.rollS = 0;
    if (this.rollS) this.camera.rotateOnAxis(this.tmp2.set(0, 0, -1), this.rollS);

    // nearest body (surface distance); ride along with it so it doesn't slide away as it orbits
    let nearest = this.bodies[0], nd = Infinity;
    for (const b of this.bodies) {
      const d = this.camera.position.distanceTo(b.world) - b.def.radiusKm;
      if (d < nd) { nd = d; nearest = b; }
    }
    if (this.nearest !== nearest) { this.nearest = nearest; this.nearestLast.copy(nearest.world); }
    else { this.camera.position.add(this.tmp.copy(nearest.world).sub(this.nearestLast)); this.nearestLast.copy(nearest.world); }
    nd = Math.max(nd, 1e-4);

    // move in camera axes: x right, y forward, z up (Eyes: D/A, W/S, E/Q; wheel = forward/back)
    const n = this.tmp2.set(0, 0, 0);
    const s = SPEED_ZOOM * mod * fr;
    if (K.has('d')) n.x += s;
    if (K.has('a')) n.x -= s;
    if (K.has('w')) n.y += s;
    if (K.has('s')) n.y -= s;
    if (K.has('e')) n.z += s;
    if (K.has('q')) n.z -= s;
    n.y += -this.zoomOffset * SPEED_ZOOM * mod;
    this.moveS.set(lerpTo(n.x, this.moveS.x, f), lerpTo(n.y, this.moveS.y, f), lerpTo(n.z, this.moveS.z, f));
    if (n.lengthSq() === 0 && this.moveS.lengthSq() < 1e-7) this.moveS.set(0, 0, 0);
    if (this.moveS.lengthSq() > 0) {
      const q = this.camera.quaternion;
      const mv = new THREE.Vector3(this.moveS.x, this.moveS.z, -this.moveS.y).applyQuaternion(q).multiplyScalar(nd);
      this.camera.position.add(mv);
    }
    // never fly into a body
    for (const b of this.bodies) {
      const off = this.tmp.copy(this.camera.position).sub(b.world);
      const min = b.def.radiusKm * 1.0005;
      if (off.length() < min) this.camera.position.copy(b.world).add(off.setLength(min));
    }
  }

  /** Eased flight to a body; position and view both interpolate, then hand over to orbit mode. */
  private updateFlight(dt: number): void {
    const fl = this.flight!;
    fl.t += dt;
    const k = ease(Math.min(1, fl.t / fl.dur));
    const dest = this.tmp.copy(fl.target.world).add(fl.offset);
    this.camera.position.lerpVectors(fl.p0, dest, k);
    this.mat.lookAt(dest, fl.target.world, this.tmp2.set(0, 1, 0));
    this.tmpQ.setFromRotationMatrix(this.mat);
    this.camera.quaternion.slerpQuaternions(fl.q0, this.tmpQ, k);
    if (k >= 1) {
      this.setOrbitFromOffset(fl.offset);
      this.flight = null;
      this.cb.onArrive?.(fl.target.def.id);
    }
  }

  /** Labels + orbit-line visibility. A label is an icon + name; the icon hides once the body is big on screen. */
  private updateOverlays(): void {
    const w = this.mount.clientWidth, h = this.mount.clientHeight;
    const pxPerRad = h / 2 / Math.tan((FOV * DEG) / 2);
    const cam = this.camera.position;
    const fwd = this.tmp2.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const b of this.bodies) {
      const d = cam.distanceTo(b.world);
      let near = true; // moons only show when the camera is near their parent
      if (b.def.labelRangeKm) near = cam.distanceTo(this.byId.get(b.def.parent!)!.world) < b.def.labelRangeKm;
      b.near = !b.lightOnly && (near || b === this.target);
      if (b.lightOnly) continue; // the Sun in the Mars world: no label, no click target
      if (b.line) b.line.visible = this.layers.orbits && near;
      b.pick.scale.setScalar(Math.max(b.def.radiusKm * 1.15, d * 0.015));

      const v = this.tmp.copy(b.world).sub(cam);
      const front = v.dot(fwd) > 0;
      const rPx = (b.def.radiusKm / d) * pxPerRad;
      const el = b.label;
      let show = this.layers.labels && near && front && rPx < h * 0.9;
      if (show) {
        const p = this.tmp.copy(b.world).project(this.camera);
        const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
        show = x > -50 && x < w + 50 && y > -20 && y < h + 20;
        if (show) {
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.classList.toggle('big', rPx > 9);
          el.style.setProperty('--off', `${Math.max(rPx, 0) + 6}px`);
          el.classList.toggle('selected', b === this.target);
        }
      }
      el.style.display = show ? '' : 'none';
    }
  }
}
