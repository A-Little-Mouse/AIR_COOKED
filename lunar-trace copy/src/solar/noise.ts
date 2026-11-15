// Small deterministic helpers (value noise) shared by the ground scenes.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const smooth = (t: number) => t * t * (3 - 2 * t);
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x: number, y: number, oct = 4): number {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++, amp *= 0.5, f *= 2.03) v += amp * vnoise(x * f, y * f);
  return v;
}
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const sstep = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));

