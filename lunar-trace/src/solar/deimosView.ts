import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BODY_BY_ID } from './bodies.ts';
import { loadBody } from './loadBody.ts';
import { fbm } from './noise.ts';

/**
 * Mars as seen from the surface of Deimos (the Mars title slide's background). Deimos is tidally locked, so Mars hangs in one place in its sky.
 * Mars is shown at its true apparent size; Deimos is a small dark, rough sphere (illustrative terrain). Units: kilometres.
 */
export const DEIMOS_ORBIT_KM = 23_463.2;
export const DEIMOS_MEAN_RADIUS_KM = 6.2;
const DEG = Math.PI / 180;
const OBSERVER_DEG = 60; // angle from the sub-Mars point: Mars stands about 30 degrees up
const PITCH_DEG = 16; // the view is tilted this far above the horizon, so the ground fills the bottom of the frame
const YAW_DEG = 13; // and turned so Mars sits right of centre, clear of the text

export function angularRadiusDeg(radiusKm: number, distKm: number): number {
  return Math.asin(radiusKm / distKm) / DEG;
}

/** Elevation of Mars' centre for an observer on Deimos at `observerAngleDeg` from the sub-Mars point. */
export function marsElevationDeg(observerAngleDeg: number): number {
  const th = observerAngleDeg * DEG;
  return Math.atan2(DEIMOS_ORBIT_KM * Math.cos(th) - DEIMOS_MEAN_RADIUS_KM, DEIMOS_ORBIT_KM * Math.sin(th)) / DEG;
}

/** Radius (km) of Deimos' rough surface in the direction of unit vector `n`. */
function surfaceRadius(n: THREE.Vector3): number {
  const k = 1 + (fbm(n.x * 6 + 3, n.y * 6 + n.z * 4, 5) - 0.5) * 0.05 + (fbm(n.x * 90, n.z * 90 + n.y * 50, 4) - 0.5) * 0.012;
  return DEIMOS_MEAN_RADIUS_KM * k;
}

export class DeimosViewScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.0005, 1e6);
  private base = new THREE.Vector3();
  private lookDir = new THREE.Vector3();
  private marsPos = new THREE.Vector3();
  /** 0 = standing on Deimos, 1 = pulled back to see the whole of Mars (the Explore Mars transition). */
  pull = 0;

  constructor() {
    const R = DEIMOS_MEAN_RADIUS_KM, th = OBSERVER_DEG * DEG;
    // Frame: Deimos centre at the origin, Mars centre on +X at DEIMOS_ORBIT_KM; the observer stands on the sphere at angle th from +X.
    this.marsPos.set(DEIMOS_ORBIT_KM, 0, 0);
    const up = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
    this.base.copy(up).multiplyScalar(surfaceRadius(up) + 0.004); // 4 m above the ground
    this.lookDir.copy(this.marsPos).sub(this.base).normalize();

    const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
    // From behind the viewer and 28 degrees above the horizon: the ground is lit and Mars is nearly full.
    const h = this.lookDir.clone().addScaledVector(up, -this.lookDir.dot(up)).normalize();
    sun.position.copy(h).multiplyScalar(-Math.cos(28 * DEG)).addScaledVector(up, Math.sin(28 * DEG)).multiplyScalar(1000).add(new THREE.Vector3(0, 0, 150));
    this.scene.add(sun, new THREE.AmbientLight(0x2a1a14, 0.5));

    const geo = new THREE.IcosahedronGeometry(R, 7);
    const p = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = v.clone().normalize();
      p.setXYZ(i, n.x * surfaceRadius(n), n.y * surfaceRadius(n), n.z * surfaceRadius(n));
    }
    geo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a6a56, roughness: 1 })));
    this.setCameraPose(0);
  }

  async loadMars(loader: GLTFLoader): Promise<void> {
    const def = BODY_BY_ID.get('mars')!;
    const { wrapper } = await loadBody(def, loader);
    wrapper.scale.multiplyScalar(def.radiusKm);
    const g = new THREE.Group();
    g.add(wrapper);
    g.position.copy(this.marsPos);
    this.scene.add(g);
  }

  /** A very slow sway of the view, so the picture is alive. t in seconds. */
  setCameraPose(t: number): void {
    const up = this.base.clone().normalize();
    const h = this.lookDir.clone().addScaledVector(up, -this.lookDir.dot(up)).normalize(); // toward Mars, along the ground
    const pitch = (PITCH_DEG + 0.8 * Math.sin(t * 0.07)) * DEG;
    const dir = h.multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
    dir.applyAxisAngle(up, (YAW_DEG + 1.2 * Math.sin(t * 0.05)) * DEG);
    this.camera.up.copy(up);
    const aim = this.base.clone().addScaledVector(dir, DEIMOS_ORBIT_KM);
    if (this.pull > 0) {
      const far = this.marsPos.clone().add(this.base.clone().sub(this.marsPos).normalize().multiplyScalar(3396.2 * 4.5));
      this.camera.position.lerpVectors(this.base, far, this.pull);
      aim.lerp(this.marsPos, this.pull);
    } else this.camera.position.copy(this.base);
    this.camera.lookAt(aim);
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
