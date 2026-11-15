import * as THREE from 'three';

/** A model whose surfaces average brighter than this (0..1, as seen: sRGB) is dimmed to it, so white craft do not glare against the dark scene. */
export const MAX_ALBEDO = 0.55;
/** ...but never to less than this share of its own colour, so a very white model stays recognisably white, only softer. */
export const MIN_DIM = 0.45;

/** How much to multiply a model's colours by, given its average brightness. 1 = leave it alone. */
export function dimFactor(avgAlbedo: number): number {
  return avgAlbedo <= MAX_ALBEDO ? 1 : Math.max(MIN_DIM, MAX_ALBEDO / avgAlbedo);
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const textureCache = new WeakMap<THREE.Texture, number>();

/** Average brightness (sRGB luminance, 0..1) of a texture, read from a 16 x 16 copy; 1 if it cannot be read. */
function textureAverage(tex: THREE.Texture): number {
  const known = textureCache.get(tex);
  if (known !== undefined) return known;
  let avg = 1;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(tex.image as CanvasImageSource, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += lum(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    avg = sum / (d.length / 4);
  } catch { /* an unreadable texture counts as full white: the model may be dimmed, never brightened */ }
  textureCache.set(tex, avg);
  return avg;
}

const rgb = { r: 0, g: 0, b: 0 };

/** Average brightness of a model's surfaces, weighted by how many vertices each mesh has. */
export function averageAlbedo(root: THREE.Object3D): number {
  let sum = 0, weight = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const w = (mesh.geometry.attributes.position?.count ?? 1);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.color) continue;
      mat.color.getRGB(rgb as THREE.RGB, THREE.SRGBColorSpace);
      const base = lum(rgb.r, rgb.g, rgb.b) * (mat.map ? textureAverage(mat.map) : 1);
      sum += base * w; weight += w;
    }
  });
  return weight ? sum / weight : 0;
}

/** Dim a model that is too bright or white (once per material). Returns the factor applied. */
export function dimBrightModel(root: THREE.Object3D): number {
  const f = dimFactor(averageAlbedo(root));
  if (f >= 1) return 1;
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial;
      if (done.has(mat) || !mat.color) continue;
      done.add(mat);
      mat.color.multiplyScalar(f);
      if ('envMapIntensity' in mat) mat.envMapIntensity *= f;
    }
  });
  return f;
}
