import type { Ephemeris } from '../../ephemeris'
import { fetchRegional } from './regional'
import { WALK_SITES, WalkScene, type WalkSite } from './WalkScene'

/** The landing site nearest to a point (degrees), within `maxKm`, or null. */
export function nearestWalkSite(lon: number, lat: number, maxKm = 600): WalkSite | null {
  const D = Math.PI / 180
  let best: WalkSite | null = null, bestKm = maxKm
  for (const s of WALK_SITES) {
    const a = Math.sin(lat * D) * Math.sin(s.lat * D) + Math.cos(lat * D) * Math.cos(s.lat * D) * Math.cos((lon - s.lon) * D)
    const km = Math.acos(Math.max(-1, Math.min(1, a))) * 1737.4
    if (km < bestKm) { best = s; bestKm = km }
  }
  return best
}

let active: { scene: WalkScene; root: HTMLElement; leave: () => void } | null = null
export const walkActive = (): boolean => active !== null

/** Opens the illustrative walk at `site` over the Moon page (full screen); Esc or the button leaves it. */
export async function startWalk(site: WalkSite, e: Ephemeris, tilesBase: string | null, base: string, onLeave?: () => void): Promise<void> {
  if (active) return
  const root = document.createElement('div')
  root.className = 'walk-overlay'
  root.innerHTML = '<canvas class="walk-canvas"></canvas><div class="walk-top"><div><b class="walk-title"></b><span class="walk-note">Illustration. The site, the Sun, the Earth and the regional slope are real; the ground itself is procedural.</span></div><button type="button" class="walk-exit">Leave (Esc)</button></div><div class="walk-earth" aria-live="off"></div><div class="walk-keys">W A S D walk · Shift run · Space jump · drag to look</div>'
  ;(root.querySelector('.walk-title') as HTMLElement).textContent = site.name
  document.body.append(root)
  const earthEl = root.querySelector('.walk-earth') as HTMLElement
  const regional = tilesBase ? await fetchRegional(tilesBase, site.lon, site.lat) : null
  const scene = new WalkScene(root.querySelector('.walk-canvas') as HTMLCanvasElement, site, e, regional, base)
  scene.onEarth = (bearing, elevation) => {
    let d = ((bearing - scene.heading() + 540) % 360) - 180
    const side = Math.abs(d) < 8 ? 'ahead' : d < 0 ? `${Math.round(-d)}° to your left` : `${Math.round(d)}° to your right`
    earthEl.textContent = elevation > 0 ? `Earth: ${Math.round(elevation)}° up, ${side}` : 'Earth: below the horizon'
  }
  await scene.loadModels().catch((err) => console.warn('walk models failed:', err))
  scene.start()
  const leave = (): void => {
    if (!active) return
    window.removeEventListener('keydown', esc, true)
    scene.dispose()
    root.remove()
    active = null
    onLeave?.()
  }
  const esc = (ev: KeyboardEvent): void => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); leave() } }
  window.addEventListener('keydown', esc, true)
  ;(root.querySelector('.walk-exit') as HTMLButtonElement).addEventListener('click', leave)
  active = { scene, root, leave }
}
