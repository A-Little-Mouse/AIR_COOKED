import * as THREE from 'three';
import { createGLTFLoader } from '../solar/gltf.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { BodyDef } from '../solar/bodies.ts';
import { bodiesOf, craftOf, lightOnlyOf, type WorldId } from '../solar/world.ts';
import { localPosition, orientation, poleVector } from '../solar/ephemeris.ts';
import { surfaceDirection } from '../solar/craft.ts';
import { PHOBOS_CAMERA_KM, PHOBOS_OFFSET_DEG, phobosFrame, type PhobosFrame } from '../solar/marsTime.ts';
import { loadBody, makeGlow } from '../solar/loadBody.ts';


export interface Layers { labels: boolean }
export interface Callbacks {
  onSelect: (id: string) => void;
  onFreeFly: (on: boolean) => void;
  onReady: () => void;
  onArrive?: (id: string) => void;
}

interface Body {
  def: BodyDef;
  anchor: THREE.Group; // position, relative to the parent body (never rotates)
  world: THREE.Vector3; // world position, km (double precision)
  pick: THREE.Mesh;
  label: HTMLButtonElement;
  // Moons and landers only get a label and click target while the camera is near their parent.
  near: boolean;
  // Drawn but not labelled or clickable (the Sun).
  lightOnly?: boolean;
}
interface Flight { target: Body; t: number; dur: number; p0: THREE.Vector3; q0: THREE.Quaternion; offset: THREE.Vector3 }

const DEG = Math.PI / 180;
const FOV = 60; // how wide the camera sees, in degrees
const SPEED_DRAG = 0.01; // how far the view turns per pixel of mouse drag
const SPEED_KEY = 0.01; // how far the view turns per frame while a key is held
const SPEED_ZOOM = 0.05; // how fast zooming is
const SMOOTH = 0.8; // how much camera movement is smoothed out
const SUN_LIGHT = 3.6; // Sun brightness (the same at every distance)
// Smooth start-and-stop curve for camera flights (0 to 1 in, 0 to 1 out).
const glide = (k: number) => k * k * k * (k * (k * 6 - 15) + 10);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerpTo = (target: number, prev: number, f: number) => target + (prev - target) * f;

// Makes the glowing Sun picture, like the Moon page's Sun.
function makeSunGlare(): THREE.Sprite {
  const N = 512, c = N / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  const veil = g.createRadialGradient(c, c, 0, c, c, c);
  veil.addColorStop(0, 'rgba(255,255,255,1)'); veil.addColorStop(0.035, 'rgba(255,255,255,.95)'); veil.addColorStop(0.09, 'rgba(255,252,244,.42)');
  veil.addColorStop(0.25, 'rgba(255,248,236,.12)'); veil.addColorStop(0.6, 'rgba(255,246,232,.03)'); veil.addColorStop(1, 'rgba(255,246,232,0)');
  g.fillStyle = veil; g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'lighter'; // fine rays: many thin spokes of random length, brightest at the core
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 110; i++) {
    const a = rnd() * Math.PI * 2, len = c * (0.25 + rnd() * 0.7), w = 0.4 + rnd() * 0.9;
    const grad = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
    grad.addColorStop(0, 'rgba(255,255,255,.22)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad; g.lineWidth = w;
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
}

// The 3D engine for Mars: draws the bodies and moves the camera (1 unit = 1 km).
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

  private timeMs = Date.now();
  private layers: Layers = { labels: true };

  private mode: 'orbit' | 'freefly' = 'orbit';
  private target!: Body;
  private lat = 0.15;
  private lon = 0.6;
  private dist = 1;
  private flight: Flight | null = null;
  // The Mars page's held shot: the camera sits near Phobos and follows it.
  private hold: { p0: THREE.Vector3; q0: THREE.Quaternion; t: number; dur: number } | null = null;
  private holdPos = new THREE.Vector3();
  private holdFrame: PhobosFrame = { e1: new THREE.Vector3(), e2: new THREE.Vector3(), e3: new THREE.Vector3() };
  // How far the picture is shifted sideways (share of its width), so Mars sits beside the text.
  private shift = 0;
  private shiftTarget = 0;
  private yawS = 0; private pitchS = 0; private zoomS = 1; private rollS = 0; private roll = 0;
  private moveS = new THREE.Vector3();
  private nearest: Body | null = null;
  private nearestLast = new THREE.Vector3();
  private dragX = 0; private dragY = 0; private zoomOffset = 0;
  private dragging = false;
  private down = { x: 0, y: 0, t: 0 };
  private keys = new Set<string>();

  private raycaster = new THREE.Raycaster();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private mat = new THREE.Matrix4();
  private canvas: HTMLCanvasElement;
  private cleanups: Array<() => void> = [];

  constructor(private mount: HTMLElement, private labelLayer: HTMLElement, private cb: Callbacks, private world: WorldId = 'mars') {
    // Log depth stops near and far objects flickering across huge size ranges.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'none';
    mount.appendChild(this.canvas);
    this.scene.background = new THREE.Color(0x000000);

    this.scene.add(new THREE.PointLight(0xfff1dc, SUN_LIGHT, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x1a2236, this.world === 'mars' ? 4 : 0.6));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.3, 1.15));
    this.composer.addPass(new OutputPass());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(mount);
    this.resize();
    this.bindInput();
  }

  // Loads the planet and moon models, builds the scene and starts the animation loop.
  async start(initialId: string, timeMs?: number): Promise<void> {
    if (timeMs !== undefined) this.timeMs = timeMs;
    const loader = this.loader;
    const BODIES = bodiesOf(this.world), CRAFT_BODIES = craftOf(this.world);
    const loaded = await Promise.all(
      [...BODIES, ...lightOnlyOf(this.world)].map(async (def) => {
        const m = await loadBody(def, loader);
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
        const glow = this.world === 'mars' ? makeSunGlare() : makeGlow();
        glow.scale.setScalar(def.radiusKm * (this.world === 'mars' ? 50 : 6));
        anchor.add(glow);
      }
      const pick = new THREE.Mesh(pickGeo, pickMat); // invisible click target, enlarged with distance
      anchor.add(pick);


      const label = document.createElement('button');
      label.className = 'body-label';
      label.innerHTML = `<span class="dot"></span><span class="name">${def.name}</span>`;
      label.addEventListener('pointerdown', (e) => e.stopPropagation());
      label.addEventListener('click', () => this.travelTo(def.id));
      this.labelLayer.appendChild(label);

      const body: Body = { def, anchor, world: new THREE.Vector3(), pick, label, near: true, lightOnly: lightOnlyOf(this.world).includes(def) };
      if (body.lightOnly) { body.near = false; label.style.display = 'none'; }
      this.bodies.push(body);
      this.byId.set(def.id, body);
    }
    // Moons are attached to their planet so they move with it.
    for (const b of this.bodies) {
      const parent = b.def.parent ? this.byId.get(b.def.parent)!.anchor : this.scene;
      parent.add(b.anchor);
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

  // Loads every lander model in the background after the planets are on screen.
  private async loadAllCraft(): Promise<void> {
    for (const def of craftOf(this.world)) {
      if (this.disposed) return;
      await this.loadCraft(def);
    }
  }

  // Loads one lander model once (Spirit and Opportunity share a model).
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

    if (site.kind === 'surface') {
      // Fixed to the planet's surface so it turns with Mars.
      const n = surfaceDirection(def.parent!, site.latDeg, site.lonDeg, new THREE.Vector3());
      anchor.position.copy(n).multiplyScalar(parent.def.radiusKm + def.radiusKm * 0.35);
      anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      (parent.anchor.userData.pivot as THREE.Group).add(anchor);
    }

    const label = document.createElement('button');
    label.className = 'body-label';
    label.innerHTML = `<span class="dot"></span><span class="name">${def.name}</span>`;
    label.addEventListener('pointerdown', (e) => e.stopPropagation());
    label.addEventListener('click', () => this.travelTo(def.id));
    label.style.display = 'none';
    this.labelLayer.appendChild(label);

    const body: Body = { def, anchor, world: new THREE.Vector3(), pick, label, near: false };
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

  // Works out where the camera should be for the Phobos shot right now.
  private holdPose(pos: THREE.Vector3, q: THREE.Quaternion): void {
    const mars = this.byId.get('mars')!, phobos = this.byId.get('phobos')!;
    phobosFrame(this.tmp.copy(phobos.world).sub(mars.world), poleVector(mars.def), this.holdFrame);
    const a = PHOBOS_OFFSET_DEG * DEG, f = this.holdFrame;
    pos.copy(phobos.world).addScaledVector(f.e1, Math.cos(a) * PHOBOS_CAMERA_KM).addScaledVector(f.e3, Math.sin(a) * PHOBOS_CAMERA_KM);
    this.mat.lookAt(pos, mars.world, f.e2);
    q.setFromRotationMatrix(this.mat);
  }

  holdPhobosShot(instant = false): void {
    if (!this.ready || this.world !== 'mars') return;
    this.flight = null;
    if (this.mode === 'freefly') { this.mode = 'orbit'; this.cb.onFreeFly(false); }
    this.target = this.byId.get('mars')!;
    this.hold = { p0: this.camera.position.clone(), q0: this.camera.quaternion.clone(), t: instant ? 99 : 0, dur: 3.2 };
    this.setShift(0.13, instant);
  }

  // Slides the picture sideways (positive is right).
  setShift(target: number, instant = false): void {
    this.shiftTarget = target;
    if (instant) { this.shift = target; this.applyShift(); }
  }

  private updateShift(dt: number): void {
    if (Math.abs(this.shift - this.shiftTarget) < 1e-4) { if (this.shift !== this.shiftTarget) { this.shift = this.shiftTarget; this.applyShift(); } return; }
    this.shift += (this.shiftTarget - this.shift) * Math.min(1, dt * 1.8);
    this.applyShift();
  }

  private applyShift(): void {
    const w = this.mount.clientWidth || 1, h = this.mount.clientHeight || 1;
    if (this.shift === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, -this.shift * w, 0, w, h);
  }

  // Each frame, glides the camera into the Phobos shot and follows Phobos.
  private updateHold(dt: number): void {
    const hd = this.hold!;
    hd.t += dt;
    const k = glide(Math.min(1, hd.t / hd.dur));
    const pos = this.holdPos, q = this.tmpQ;
    this.holdPose(pos, q);
    this.arc(this.byId.get('mars')!.world, hd.p0, pos, k, this.camera.position);
    this.camera.quaternion.slerpQuaternions(hd.q0, q, k);
  }

  setLayers(l: Layers): void { this.layers = l; }
  // Flies back to the whole-Mars view.
  home(): void { this.travelTo(this.bodies[0].def.id); }
  toggleFreeFly(): void { this.setFreeFly(this.mode !== 'freefly'); }
  getSelectedId(): string { return this.target?.def.id ?? this.bodies[0]?.def.id ?? 'sun'; }
  // Returns the camera and body positions, for testing.
  debug() {
    return {
      mode: this.mode, flying: !!this.flight, target: this.target?.def.id, lat: this.lat, lon: this.lon, dist: this.dist,
      cam: this.camera.position.toArray(), timeMs: this.timeMs,
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
      this.travelTo(this.target.def.id); // leaving free-fly returns to the selected body
    }
  }

  // Flies the camera to a body, then orbits it (or jumps there if instant).
  travelTo(id: string, instant = false): void {
    const b = this.byId.get(id);
    if (!b) {
      const craft = craftOf(this.world).find((c) => c.id === id);
      if (craft && this.ready) void this.loadCraft(craft).then(() => { if (this.byId.has(id)) this.travelTo(id, instant); });
      return;
    }
    if (!this.ready) return;
    this.hold = null;
    if (this.mode === 'freefly') { this.mode = 'orbit'; this.cb.onFreeFly(false); }
    this.target = b;
    this.cb.onSelect(id);
    this.resetSmoothing();
    this.roll = 0;

    // Approach from the sunlit side.
    const dir = id === 'sun' ? this.tmp.copy(this.camera.position).sub(b.world) : this.tmp.copy(b.world).negate();
    if (dir.lengthSq() < 1e-12) dir.set(0.4, 0.3, 1);
    dir.normalize();
    if (b.def.craft) {
      // Landers: view from above the ground.
      const up = b.world.clone().sub(this.byId.get(b.def.parent!)!.world).normalize();
      const tang = dir.clone().addScaledVector(up, -dir.dot(up));
      if (tang.lengthSq() < 1e-6) tang.crossVectors(up, new THREE.Vector3(0, 1, 0));
      dir.copy(up).multiplyScalar(0.8).addScaledVector(tang.normalize(), 0.6);
    } else {
      if (!(this.world === 'mars' && id === 'mars')) dir.y += 0.25; // Mars: look straight down the Sun line so its face is fully lit
    }
    dir.normalize();
    const offset = dir.clone().multiplyScalar(b.def.radiusKm * b.def.viewRadii);

    if (instant) {
      this.flight = null;
      this.setOrbitFromOffset(offset);
      return;
    }
    const dest = b.world.clone().add(offset);
    const base = 0.5 + 0.35 * Math.log10(Math.max(this.camera.position.distanceTo(dest), 1));
    const dur = this.world === 'mars' ? THREE.MathUtils.clamp(base * 1.6, 1.8, 5) : THREE.MathUtils.clamp(base, 0.75, 4);
    this.flight = { target: b, t: 0, dur, p0: this.camera.position.clone(), q0: this.camera.quaternion.clone(), offset };
  }

  // Saves the camera's position around its target as angles and a distance.
  private setOrbitFromOffset(o: THREE.Vector3): void {
    this.dist = o.length();
    this.lat = Math.asin(THREE.MathUtils.clamp(o.y / this.dist, -1, 1));
    this.lon = Math.atan2(-o.z, o.x);
  }

  private resetSmoothing(): void {
    this.yawS = 0; this.pitchS = 0; this.zoomS = 1; this.rollS = 0;
  }


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
    });
    on(this.canvas, 'pointermove', (e) => {
      if (this.dragging) { this.dragX += e.movementX; this.dragY += e.movementY; return; }
      this.canvas.style.cursor = this.pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
    });
    const up = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      // A quick press that barely moves counts as a click.
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
    }, { passive: false });

    onWin('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) { this.keys.clear(); return; } // leave browser shortcuts alone
      const k = e.key.toLowerCase();
      if (k === 'k' && !e.repeat) this.toggleFreeFly();
      this.keys.add(k);
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
      if (!best || b.def.radiusKm < best.def.radiusKm) best = b; // when click areas overlap, pick the smaller body
    }
    return best;
  }

  // Runs every frame: advances time, moves the bodies and camera, and draws the scene.
  private frame = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const nowMs = performance.now();
    const dt = Math.min((nowMs - this.lastFrameMs) / 1000, 0.1);
    this.lastFrameMs = nowMs;
    this.timeMs += dt * 1000;
    this.updateBodies();
    this.updateShift(dt);
    if (this.hold) this.updateHold(dt);
    else if (this.flight) this.updateFlight(dt);
    else if (this.mode === 'orbit') this.updateOrbit(dt);
    else this.updateFreeFly(dt);
    this.dragX = this.dragY = this.zoomOffset = 0;
    this.updateOverlays();
    this.composer.render();
  };

  private updateBodies(): void {
    for (const b of this.bodies) {
      const c = b.def.craft;
      if (c) continue; // landers are fixed to their parent's surface
      localPosition(b.def, this.timeMs, b.anchor.position);
      (b.anchor.userData.pivot as THREE.Group).quaternion.copy(orientation(b.def, this.timeMs, this.tmpQ));
    }
    this.scene.updateMatrixWorld();
    for (const b of this.bodies) b.anchor.getWorldPosition(b.world);
  }

  private modifier(): number { return this.keys.has('shift') ? 5 : this.keys.has('x') ? 0.05 : 1; }

  // Orbit mode: the camera circles the selected body, always looking at it.
  private updateOrbit(dt: number): void {
    const fr = dt * 60, f = Math.pow(SMOOTH, fr);
    const mod = this.modifier();
    const m = mod * Math.min(1, FOV * DEG);
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

    // Zoom changes the height by a percentage, so it feels the same far away and close up.
    let zi = Math.pow(2, this.zoomOffset * SPEED_ZOOM * mod);
    if (K.has('w')) zi /= Math.pow(2, SPEED_ZOOM * mod * fr);
    if (K.has('s')) zi *= Math.pow(2, SPEED_ZOOM * mod * fr);
    this.zoomS = THREE.MathUtils.clamp(lerpTo(zi, this.zoomS, f), 0.8, 1.25);
    if (Math.abs(1 - this.zoomS) < 1e-7) this.zoomS = 1;
    const minAlt = radius * 1e-4;
    if (alt === 0 && this.zoomS > 1) alt = minAlt;
    alt = THREE.MathUtils.clamp(alt * this.zoomS, minAlt, 2e11);
    this.dist = radius + alt;

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

  // Free-fly mode: fly anywhere, slowing down near bodies.
  private updateFreeFly(dt: number): void {
    const fr = dt * 60, f = Math.pow(SMOOTH, fr);
    const mod = this.modifier();
    const K = this.keys;

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

    // Stay with the nearest body so it doesn't drift away as it orbits.
    let nearest = this.bodies[0], nd = Infinity;
    for (const b of this.bodies) {
      const d = this.camera.position.distanceTo(b.world) - b.def.radiusKm;
      if (d < nd) { nd = d; nearest = b; }
    }
    if (this.nearest !== nearest) { this.nearest = nearest; this.nearestLast.copy(nearest.world); }
    else { this.camera.position.add(this.tmp.copy(nearest.world).sub(this.nearestLast)); this.nearestLast.copy(nearest.world); }
    nd = Math.max(nd, 1e-4);

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
    // Never fly into a body.
    for (const b of this.bodies) {
      const off = this.tmp.copy(this.camera.position).sub(b.world);
      const min = b.def.radiusKm * 1.0005;
      if (off.length() < min) this.camera.position.copy(b.world).add(off.setLength(min));
    }
  }

  // Works out a curved camera path round a body, never cutting through it.
  private arc(center: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, k: number, out: THREE.Vector3): THREE.Vector3 {
    const a = this.arcA.copy(p0).sub(center), b = this.arcB.copy(p1).sub(center);
    const d0 = Math.max(a.length(), 1e-9), d1 = Math.max(b.length(), 1e-9);
    a.divideScalar(d0); b.divideScalar(d1);
    const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)), sin = Math.sin(ang);
    if (sin < 1e-4) a.lerp(b, k); // (almost) the same direction, or straight opposite: no great circle to follow
    else a.multiplyScalar(Math.sin((1 - k) * ang) / sin).addScaledVector(b, Math.sin(k * ang) / sin);
    a.normalize();
    const dist = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * k) * (1 + 0.3 * Math.sin(Math.PI * k) * Math.min(1, ang / Math.PI));
    return out.copy(center).addScaledVector(a, dist);
  }
  private arcA = new THREE.Vector3();
  private arcB = new THREE.Vector3();

  private updateFlight(dt: number): void {
    const fl = this.flight!;
    fl.t += dt;
    const k = (this.world === 'mars' ? glide : ease)(Math.min(1, fl.t / fl.dur));
    const dest = this.tmp.copy(fl.target.world).add(fl.offset);
    if (this.world === 'mars') this.arc(fl.target.world, fl.p0, dest, k, this.camera.position);
    else this.camera.position.lerpVectors(fl.p0, dest, k);
    this.mat.lookAt(dest, fl.target.world, this.tmp2.set(0, 1, 0));
    this.tmpQ.setFromRotationMatrix(this.mat);
    this.camera.quaternion.slerpQuaternions(fl.q0, this.tmpQ, k);
    if (k >= 1) {
      this.setOrbitFromOffset(fl.offset);
      this.flight = null;
      this.cb.onArrive?.(fl.target.def.id);
    }
  }

  // Shows, hides and positions the name labels each frame.
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
