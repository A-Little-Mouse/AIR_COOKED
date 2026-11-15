import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BODY_BY_ID } from './bodies.ts';
import { loadBody } from './loadBody.ts';
import { rng, hash, fbm, vnoise, clamp01, sstep } from './noise.ts';

/**
 * Ground-level scene at Tranquility Base (Apollo 11). Units are METRES, in its own scene, so nothing here has to cope with
 * planet-scale numbers. Sun low in the east (about 11 degrees up, as at the real landing), black sky, no Earth in frame.
 */
const MOON_R = 1_737_400; // m, for the horizon curvature
/** Meshes whose centre is above this fraction of the model's height belong to the ascent stage. */
const ASCENT_CUTOFF = 0.5;
const SUN_ELEVATION = 11 * (Math.PI / 180);

export class SurfaceScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30_000);
  private craters: Array<{ x: number; z: number; r: number; depth: number }> = [];
  private lm: THREE.Object3D | null = null;

  constructor() {
    this.scene.background = new THREE.Color(0x000000);
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
    sun.position.set(Math.cos(SUN_ELEVATION) * 100, Math.sin(SUN_ELEVATION) * 100, -22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.AmbientLight(0x8a93a8, 0.28)); // faint earthshine / bounce so shadows are not pure black

    this.buildCraters();
    this.scene.add(this.buildGround(), this.buildRocks());
    this.setCameraPose(0);
  }

  /** Terrain height (m) at (x, z): gentle rolling, a few craters, a flat pad under the lander, and the Moon's curvature. */
  height(x: number, z: number): number {
    const r2 = x * x + z * z, r = Math.sqrt(r2);
    let h = (0.22 * fbm(x / 90 + 11, z / 90 + 7, 3) + 0.05 * fbm(x / 8 + 3, z / 8 + 19, 3)) * sstep(2, 16, r);
    for (const k of this.craters) {
      const d = Math.hypot(x - k.x, z - k.z) / k.r;
      if (d > 1.6) continue;
      if (d < 1) h -= k.depth * (1 - d * d);
      h += k.depth * 0.35 * Math.exp(-(((d - 1.08) * 6) ** 2)); // raised rim
    }
    return h - r2 / (2 * MOON_R);
  }

  private buildCraters(): void {
    const rand = rng(1969);
    for (let i = 0; i < 40; i++) {
      const r = 3 + Math.pow(rand(), 2.2) * 45;
      const ang = rand() * Math.PI * 2, dist = 40 + r + Math.pow(rand(), 0.7) * 1500; // keep the landing area clear
      this.craters.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, r, depth: r * 0.07 });
    }
  }

  private regolithTexture(): THREE.Texture {
    const size = 1024, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const rand = rng(7);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // tile-able: sample noise on a torus
      const u = (x / size) * Math.PI * 2, v = (y / size) * Math.PI * 2;
      const nx = Math.cos(u) * 6, ny = Math.sin(u) * 6, nz = Math.cos(v) * 6, nw = Math.sin(v) * 6;
      const n = 0.5 * fbm(nx + nz * 0.7 + 40, ny + nw * 0.7 + 40, 5) + 0.5 * fbm(nx * 3 + nw + 90, ny * 3 + nz + 90, 3);
      let g = 0.36 + 0.34 * n;
      if (rand() < 0.012) g += 0.18; // bright pebbles
      if (rand() < 0.01) g -= 0.15;
      const i = (y * size + x) * 4;
      const c = Math.max(0, Math.min(255, g * 255));
      img.data[i] = c; img.data[i + 1] = c * 0.985; img.data[i + 2] = c * 0.96; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  private buildGround(): THREE.Mesh {
    const SEG = 160, RINGS = 240, R0 = 0.25, RMAX = 6000;
    const growth = Math.pow(RMAX / R0, 1 / (RINGS - 2));
    const pos = new Float32Array((RINGS * SEG + 1) * 3), uv = new Float32Array((RINGS * SEG + 1) * 2);
    let n = 0;
    const put = (x: number, z: number) => {
      pos[n * 3] = x; pos[n * 3 + 1] = this.height(x, z); pos[n * 3 + 2] = z;
      uv[n * 2] = x / 9; uv[n * 2 + 1] = z / 9;
      n++;
    };
    put(0, 0);
    for (let k = 0; k < RINGS; k++) {
      const r = R0 * Math.pow(growth, k);
      for (let s = 0; s < SEG; s++) { const a = (s / SEG) * Math.PI * 2; put(Math.cos(a) * r, Math.sin(a) * r); }
    }
    const idx: number[] = [];
    for (let s = 0; s < SEG; s++) idx.push(0, 1 + ((s + 1) % SEG), 1 + s);
    for (let k = 0; k < RINGS - 1; k++) {
      const a = 1 + k * SEG, b = 1 + (k + 1) * SEG;
      for (let s = 0; s < SEG; s++) {
        const s1 = (s + 1) % SEG;
        idx.push(a + s, a + s1, b + s, a + s1, b + s1, b + s);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tex = this.regolithTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 1, metalness: 0, color: 0xaeaca8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRocks(): THREE.InstancedMesh {
    const COUNT = 1400, rand = rng(42);
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const p = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { // lumpy rather than spherical
      v.fromBufferAttribute(p, i);
      const k = 0.82 + 0.3 * vnoise(v.x * 1.6 + 5, v.y * 1.6 + v.z * 1.3) + 0.08 * vnoise(v.x * 5 + 2, v.z * 5 + v.y * 4);
      p.setXYZ(i, v.x * k, v.y * k * 0.72, v.z * k);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x77746f, roughness: 1, metalness: 0 }), COUNT);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const r = 5.5 + Math.pow(rand(), 2.6) * 260, a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const size = (0.03 + Math.pow(rand(), 4) * 0.42) * (1 + r / 120);
      e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      q.setFromEuler(e);
      sc.set(size, size * (0.6 + rand() * 0.5), size * (0.8 + rand() * 0.5));
      t.set(x, this.height(x, z) + size * 0.2, z);
      mesh.setMatrixAt(i, m.compose(t, q, sc));
    }
    return mesh;
  }

  /** The Apollo 11 Lunar Module, true size, standing on the pad. */
  async loadLander(loader: GLTFLoader): Promise<void> {
    const def = BODY_BY_ID.get('apollo-11-lm')!;
    const { wrapper } = await loadBody(def, loader);
    wrapper.scale.multiplyScalar(def.radiusKm * 1000); // unit radius -> metres
    const g = new THREE.Group();
    g.add(wrapper);
    g.updateMatrixWorld(true);
    const full = new THREE.Box3().setFromObject(g);
    // Only the descent stage was left behind: hide the meshes in the upper half of the model (the ascent stage).
    const tmp = new THREE.Box3();
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      tmp.setFromObject(mesh);
      if ((tmp.min.y + tmp.max.y) / 2 > full.min.y + (full.max.y - full.min.y) * ASCENT_CUTOFF) mesh.visible = false;
    });
    const box = new THREE.Box3();
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.visible) box.expandByObject(m); });
    g.position.y -= box.min.y + 0.03; // feet just sunk into the dust
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
    });
    this.lm = g;
    this.scene.add(g);
  }

  /** Slow drift around the lander at eye height. t in seconds. */
  setCameraPose(t: number): void {
    const a = 0.5 + 0.28 * Math.sin(t * 0.05); // radians around the lander
    const r = 17 - 1.6 * Math.sin(t * 0.037);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    this.camera.position.set(x, this.height(x, z) + 1.7 + 0.25 * Math.sin(t * 0.06), z);
    this.camera.lookAt(0, 2.15, 0);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mt = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
    });
  }
}
