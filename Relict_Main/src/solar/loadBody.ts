import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BodyDef } from './bodies.ts';
import { dimBrightModel } from './dim.ts';

export interface LoadedModel {
  // The model, centred and sized to a radius of 1.
  wrapper: THREE.Group;
}

// Loads a 3D model file and gets it ready to place in the scene.
export async function loadBody(def: BodyDef, loader: GLTFLoader): Promise<LoadedModel> {
  const gltf = await loader.loadAsync(def.model);
  const model = gltf.scene;

  const isCraft = !!def.craft; // landers keep their own materials

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || isCraft) return;
    const old = mesh.material as THREE.MeshStandardMaterial;
    // The Sun's picture is stored as a glow map, not a colour map.
    const map = old.map ?? (def.type === 'star' ? old.emissiveMap : null);
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    mesh.material =
      def.type === 'star'
        ? makeSunMaterial(map)
        : new THREE.MeshStandardMaterial({ map, normalMap: old.normalMap, roughness: 0.95, metalness: 0 });
    old.dispose();
  });

  if (isCraft) dimBrightModel(model); // tone down white landers

  // Centre the model and size it to a radius of 1.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  model.position.sub(center);
  wrapper.add(model);
  wrapper.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
  return { wrapper };
}

// Makes the Sun's surface: self-lit, warm-white, with a darker, redder edge so it looks round.
function makeSunMaterial(map: THREE.Texture | null): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ map });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vSunN;\nvarying vec3 vSunV;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vSunN = normalize(normalMatrix * normal);\n  vSunV = -mvPosition.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec3 vSunN;\nvarying vec3 vSunV;\nvoid main() {')
      .replace('#include <opaque_fragment>', `
  float sunMu = clamp(dot(normalize(vSunN), normalize(vSunV)), 0.0, 1.0);
  float sunLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  outgoingLight = mix(vec3(sunLuma), outgoingLight, 0.7) * vec3(1.32, 1.2, 0.98); // warm gold-white
  // Darken and redden the edge.
  outgoingLight *= clamp(1.0 - vec3(0.45, 0.62, 0.80) * (1.0 - sunMu), 0.0, 1.0);
  #include <opaque_fragment>`);
  };
  return mat;
}

// Makes the soft glow ring around the Sun.
export function makeGlow(): THREE.Sprite {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const limb = 1 / 3; // where the Sun's edge sits in the glow picture
  // Thin rays around the Sun (the same every time).
  const streamer = (th: number) => {
    const rays = Math.sin(th * 3 + 0.7) * 0.5 + Math.sin(th * 5 + 2.1) * 0.35 + Math.sin(th * 9 + 4.2) * 0.25 + Math.sin(th * 14 + 1.3) * 0.12;
    return Math.max(0, rays) ** 2;
  };
  const tint = [1.0, 0.93, 0.78]; // white-gold
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = ((x + 0.5) / N) * 2 - 1, dy = ((y + 0.5) / N) * 2 - 1;
      const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      let I = 0; // linear brightness added to the scene
      if (r >= limb) {
        const k = limb / r;
        I = 0.36 * k ** 3.4 + 0.05 * streamer(th) * k ** 1.7;
        I *= 1 - Math.min(1, Math.max(0, (r - 0.72) / 0.28)) ** 2; // fade out at the edge
      }
      const i = (y * N + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const lin = I * tint[ch];
        const v = lin > 0 ? 255 * Math.pow(lin, 1 / 2.2) + (rnd() - 0.5) * 1.6 : 0; // to sRGB, dithered
        img.data[i + ch] = Math.max(0, Math.min(255, v));
      }
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
}
