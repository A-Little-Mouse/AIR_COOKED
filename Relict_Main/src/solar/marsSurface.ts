import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BodyDef } from './bodies.ts';
import { loadBody } from './loadBody.ts';
import { fbm, rng, sstep } from './noise.ts';

// A made-up Mars ground scene (the landing sites are real; the ground is not).
export const MARS_SUN_ELEVATION_DEG = 25; // how high the Sun is in the sky
const PAD_RADIUS = 3;
const SIZE = 700; // width of the ground square in metres (fog hides its edge)
const SKY = 0xd9a878, SKY_TOP = 0xb07a52, DUST = 0xa5603a;

// Returns the ground height at a spot: gentle hills, flat under the lander.
export function marsHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const swell = (fbm(x / 70 + 11, z / 70 + 3, 4) - 0.5) * 9;
  const ripple = (fbm(x / 9 + 50, z / 9 + 20, 3) - 0.5) * 0.7;
  return (swell + ripple) * sstep(PAD_RADIUS, PAD_RADIUS + 8, d) * 0.85;
}

// The Mars ground scene: terrain, rocks, sky, lander and a walking camera.
// Mars surface gravity (m/s^2); a suited hop of about 0.5 m, over a second in the air; walking and bounding speeds (m/s).
const MARS_G = 3.71;
const MARS_JUMP = 1.9;
const MARS_WALK = 1.2;
const MARS_RUN = 3;

export class MarsSurfaceScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 3000);
  private lookY = 1.2;
  private manual = false;
  private yaw = 0;
  private pitch = 0;
  private jumpY = 0;
  private vy = 0;
  // Horizontal velocity (m/s, world x and z): it builds up and eases off, and is kept in the air.
  private vx = 0;
  private vz = 0;

  constructor() {
    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(SKY, 80, 520);
    const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
    const el = MARS_SUN_ELEVATION_DEG * (Math.PI / 180);
    sun.position.set(Math.cos(el) * 100, Math.sin(el) * 100, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 300;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target, new THREE.HemisphereLight(0xe6b890, 0x6a3a22, 0.75));
    this.scene.add(this.buildGround(), this.buildRocks());
    this.setCameraPose(0);
  }

  private skyTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const g = cv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + SKY_TOP.toString(16)); grad.addColorStop(1, '#' + SKY.toString(16));
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildGround(): THREE.Mesh {
    const SEG = 220;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, marsHeight(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: DUST, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRocks(): THREE.InstancedMesh {
    const COUNT = 900, rand = rng(4);
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: 1 }), COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const r = PAD_RADIUS + 1.5 + Math.pow(rand(), 2) * 200, a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const size = (0.04 + Math.pow(rand(), 4) * 0.5) * (1 + r / 100);
      q.setFromEuler(e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28));
      s.set(size, size * 0.65, size * (0.8 + rand() * 0.5));
      mesh.setMatrixAt(i, m.compose(t.set(x, marsHeight(x, z) + size * 0.2, z), q, s));
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // Loads the lander at its real size and stands it on the flat pad.
  async loadLander(loader: GLTFLoader, def: BodyDef): Promise<void> {
    const { wrapper } = await loadBody(def, loader);
    wrapper.scale.multiplyScalar(def.radiusKm * 1000); // convert from km to metres
    const g = new THREE.Group();
    g.add(wrapper);
    g.updateMatrixWorld(true);
    g.position.y -= new THREE.Box3().setFromObject(g).min.y + 0.02; // sink the feet slightly into the dust
    g.rotation.y = 0.6; // which way it faces is a guess
    g.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    this.lookY = Math.max(0.35, new THREE.Box3().setFromObject(g).max.y * 0.5);
    this.scene.add(g);
  }

  // Switches from the slow drifting camera to the visitor's own control.
  private enterManual(): void {
    if (this.manual) return;
    this.manual = true;
    const e = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(this.camera.quaternion);
    this.yaw = e.y; this.pitch = e.x;
  }

  look(dx: number, dy: number): void {
    this.enterManual();
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy * 0.004));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // Walks, runs or jumps the camera across the ground (jumps use Mars gravity).
  walk(dt: number, forward: number, strafe: number, run: boolean, jump: boolean): void {
    if (!this.manual && !forward && !strafe && !jump) return;
    this.enterManual();
    const c = this.camera.position;
    const airborne = this.jumpY > 0 || this.vy > 0;
    if (!airborne) {
      // On the ground the speed eases toward the held keys' target (a suited body has inertia); in the air it is kept.
      const n = Math.hypot(forward, strafe) || 1;
      const sp = (run ? MARS_RUN : MARS_WALK) / n;
      const tx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * sp;
      const tz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * sp;
      const a = 1 - Math.exp(-dt / 0.2);
      this.vx += (tx - this.vx) * a;
      this.vz += (tz - this.vz) * a;
      if (!forward && !strafe && Math.hypot(this.vx, this.vz) < 0.01) this.vx = this.vz = 0;
    }
    c.x += this.vx * dt;
    c.z += this.vz * dt;
    if (jump && !airborne) this.vy = MARS_JUMP;
    if (this.vy !== 0 || this.jumpY > 0) {
      this.vy -= MARS_G * dt;
      this.jumpY = Math.max(0, this.jumpY + this.vy * dt);
      if (this.jumpY === 0) this.vy = 0;
    }
    c.y = marsHeight(c.x, c.z) + 1.7 + this.jumpY;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // Slowly circles the lander until the visitor takes over.
  setCameraPose(t: number): void {
    if (this.manual) return;
    const a = 0.7 + 0.25 * Math.sin(t * 0.05);
    const dist = Math.max(3.5, this.lookY * 8) * (1 - 0.08 * Math.sin(t * 0.037));
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    this.camera.position.set(x, Math.max(marsHeight(x, z), 0) + this.lookY * 1.1 + 0.25 * Math.sin(t * 0.06), z);
    this.camera.lookAt(0, this.lookY, 0);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mt = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
    });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
  }
}
