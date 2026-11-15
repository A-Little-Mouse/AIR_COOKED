/**
 * Skin weights for the (static, single-mesh) astronaut model, derived from where each vertex sits.
 * Model space: +Y up, +X is the astronaut's front (backpack at -X), Z is left/right; bounds ~ x ±0.33, y ±0.5, z ±0.41.
 * Bones: 0 root (feet), 1 left hip, 2 right hip, 3 left shoulder, 4 right shoulder.   (left = -Z)
 */
export const HIP_Y = -0.2;
export const HIP_Z = 0.13;
export const SHOULDER_Y = 0.1;
export const SHOULDER_Z = 0.2;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface Influences { index: [number, number, number, number]; weight: [number, number, number, number] }

/** Up to 4 bone influences (root, hip L/R, one shoulder), weights sum to 1; smooth blends near the joints so nothing tears. */
export function skinWeightsFor(x: number, y: number, z: number): Influences {
  void x;
  // legs: everything below the hips; which leg depends on the side of the body, blended across the (empty) middle
  const leg = smoothstep(HIP_Y + 0.03, HIP_Y - 0.06, y);
  const right = smoothstep(-0.035, 0.035, z);
  // arms: lateral parts (|z| beyond the torso) at shoulder-to-hand height, never overlapping the legs, head or backpack top
  const band = smoothstep(0.2, 0.14, y) * smoothstep(-0.24, -0.18, y);
  const arm = smoothstep(0.17, 0.25, Math.abs(z)) * band * (1 - leg);
  const root = Math.max(0, 1 - leg - arm);
  return {
    index: [0, 1, 2, z < 0 ? 3 : 4],
    weight: [root, leg * (1 - right), leg * right, arm],
  };
}
