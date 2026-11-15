import { BORDER, H_PX, H_SIZE, H_STEP_M, L0_DEG, heightPath, tileOf } from '../../moon/tiles/grid'
import { decodeHeightPlanes, gunzipIfNeeded } from '../../moon/tiles/codec'

/**
 * The real terrain around a site, as far as the global tiles go: the level-0 height tile (5 degrees, 64 px/degree, about 474 m a pixel) gives the
 * regional slope and how rough the ground is. The walkable illustration (WalkScene.ts) tilts and roughens its ground by these, so a highland
 * site is hillier than a mare, and every finer detail is procedural. Null when the tile cannot be fetched (the illustration is then flat-ish).
 */
export interface Regional { slopeE: number; slopeN: number; reliefM: number; meanM: number }

export function regionalFromHeights(q: Int32Array, lon: number, lat: number): Regional {
  const { tx, ty } = tileOf(0, lon, lat)
  const lon0 = -180 + tx * L0_DEG, lat0 = 90 - ty * L0_DEG // the tile's west edge and north edge
  const px = (lon - lon0) * (H_PX / L0_DEG) + BORDER, py = (lat0 - lat) * (H_PX / L0_DEG) + BORDER
  const texelM = (2 * Math.PI * 1737400) / 360 / (H_PX / L0_DEG)
  const east = texelM * Math.cos((lat * Math.PI) / 180)
  const at = (x: number, y: number): number => q[Math.max(0, Math.min(H_SIZE - 1, Math.round(y))) * H_SIZE + Math.max(0, Math.min(H_SIZE - 1, Math.round(x)))] * H_STEP_M
  const R = 6 // about +-3 km
  let sx = 0, sy = 0, n = 0, sum = 0, sumSq = 0
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const h = at(px + i, py + j)
    sum += h; sumSq += h * h; n++
  }
  for (let j = -R; j <= R; j++) { sx += at(px + R, py + j) - at(px - R, py + j); sy += at(px + j, py - R) - at(px + j, py + R) }
  const mean = sum / n
  return {
    slopeE: sx / (2 * R + 1) / (2 * R * east), // metres per metre, east positive
    slopeN: sy / (2 * R + 1) / (2 * R * texelM), // north positive (py grows southwards)
    reliefM: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    meanM: mean,
  }
}

export async function fetchRegional(tilesBase: string, lon: number, lat: number): Promise<Regional | null> {
  try {
    const { tx, ty } = tileOf(0, lon, lat)
    const res = await fetch(`${tilesBase}${heightPath(0, tx, ty)}`)
    if (!res.ok) return null
    const q = decodeHeightPlanes(await gunzipIfNeeded(await res.arrayBuffer()))
    return regionalFromHeights(q, lon, lat)
  } catch { return null }
}
