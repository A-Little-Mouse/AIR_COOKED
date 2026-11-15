import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BodyDef } from './bodies.ts';
import { dimBrightModel } from './dim.ts';

export interface LoadedModel {
  /** Model centred on the origin and scaled to UNIT radius (+Y = north pole). */
  wrapper: THREE.Group;
}

type LegacyJson = { materials?: Array<{ extensions?: Record<string, { diffuseTexture?: { index: number } }> }> };

/** Load a .glb, fix up its materials, centre it and normalize it to unit radius. */
export async function loadBody(def: BodyDef, loader: GLTFLoader): Promise<LoadedModel> {
  const gltf = await loader.loadAsync(def.model);
  const model = gltf.scene;

  // Old spec/gloss models (Mercury, Earth): three no longer reads that extension, so rebuild from its diffuse texture.
  const json = gltf.parser.json as LegacyJson;
  const isCraft = !!def.craft; // spacecraft keep their authored materials
  const legacyTex = json.materials?.[0]?.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture;
  const legacyMap = legacyTex && !isCraft ? ((await gltf.parser.getDependency('texture', legacyTex.index)) as THREE.Texture) : null;

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || isCraft) return;
    const old = mesh.material as THREE.MeshStandardMaterial;
    if (old.transparent) {
      // Translucent parts (Saturn's rings, Neptune's atmosphere): keep the authored material, two-sided, non-occluding.
      old.side = THREE.DoubleSide;
      old.depthWrite = false;
      return;
    }
    // The Sun's texture is an emissive map (its base colour is black); old spec/gloss models use the legacy diffuse texture.
    const map = old.map ?? (def.type === 'star' ? old.emissiveMap : null) ?? legacyMap;
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    mesh.material =
      def.type === 'star'
        ? makeSunMaterial(map)
        : new THREE.MeshStandardMaterial({ map, normalMap: old.normalMap, roughness: 0.95, metalness: 0 });
    old.dispose();
  });

  if (isCraft) dimBrightModel(model); // white craft are dimmed so they do not glare against the dark scene

  // Normalize: centre and scale to unit radius.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  model.position.sub(center);
  wrapper.add(model);
  wrapper.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
  return { wrapper };
}

/**
 * The Sun's surface: unlit (it is the light source) with
 *  - limb darkening: the rim is dimmer and redder than the centre (blue light darkens more), the main cue for a round, glowing Sun;
 *  - a warm gold-white tint: the photosphere texture is partly desaturated toward white;
 *  - a slight HDR boost so only its brightest spots bloom.
 * Static: no animation, nothing evaluated per frame beyond the shading itself.
 */
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
  // limb darkening I(mu)/I(1) = 1 - u (1 - mu), with u larger for blue => redder, dimmer rim
  outgoingLight *= clamp(1.0 - vec3(0.45, 0.62, 0.80) * (1.0 - sunMu), 0.0, 1.0);
  #include <opaque_fragment>`);
  };
  return mat;
}

/**
 * Corona: a soft white-gold glow hugging the limb plus faint streamers (the part inside the disc is depth-occluded by the Sun).
 * Brightness is stored in the colour channels (alpha = 1) instead of in a low alpha: sRGB storage has far more steps in the
 * darks, which avoids banding, and tiny noise dithers what is left. Additive blending then adds exactly that brightness.
 */
export function makeGlow(): THREE.Sprite {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const limb = 1 / 3; // sprite is 6x the Sun's radius wide, so the limb sits at 1/3 of the sprite radius
  // fixed sine "streamers" (coronal rays): deterministic, so the look never changes
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
        I = 0.36 * k ** 3.4 + 0.05 * streamer(th) * k ** 1.7; // steep inner glow + faint long streamers
        I *= 1 - Math.min(1, Math.max(0, (r - 0.72) / 0.28)) ** 2; // fade to exactly zero at the sprite edge
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
