# Explore Mars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Mars title page (orange/white, Mars seen from Deimos) and a Mars-only explorer whose list of landers each opens an illustrative ground scene, like the Moon's Apollo 11 view.

**Architecture:** One new "world" concept (`solar` | `mars`) filters which bodies and craft the existing solar explorer loads and lists. Two new three.js scenes (a Mars ground scene, a Deimos-surface scene) sit beside `src/solar/surface.ts`. A new `/mars/` page is the title slide; the explorer is reached with `?world=mars`.

**Tech Stack:** TypeScript, Vite 6 (multi-page), three.js 0.187, React 19 (explorer only), `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-15-explore-mars-design.md`

**Not a git repo:** where a plan normally commits, each task ends with a checkpoint: `npm test && npx tsc -b` run from `lunar-trace/` with no failures.

## Global Constraints

- "View Mars" on the home page becomes **"Explore Mars"**; the Moon button already reads "Explore Moon".
- Explorer in Mars world shows only **Mars, Phobos, Deimos**; the Sun is not a body (no model, label, list entry or orbit line).
- List = Mars, then Viking 1, Viking 2, Sojourner, Spirit, Opportunity, InSight, Ingenuity, then Phobos, Deimos. No Perseverance, no orbiters.
- Landers use their real landing coordinates; ground terrain, rocks and heading are illustrative and the ground view says so in a caption.
- `moon-explorer/` is not modified.
- Styling follows `/moon/`: Space Grotesk + DM Mono, glass panels, "← Lunar Trace" style back link; Mars accent `#ff9a69` (`--accent-rgb: 255, 154, 105`).
- Out of scope: walking on Mars, real Mars terrain, other Apollo sites.

## Review Focus

- Unknown or non-Mars body id in `#/…` with `?world=mars` (e.g. `#/earth`, `#/sun`): start on Mars, never crash. Test in Task 1.
- Clicking landers rapidly in the list: only one ground-view renderer and animation loop exists at a time; the old one is disposed. Checked in Task 4.
- Spirit and Opportunity share one model: the ground scene must clone it, not mutate the cached one. Checked in Task 3.
- WebGL unavailable on the Mars title page or ground view: the page text, buttons and back link still work; error is logged, not thrown. Checked in Tasks 4 and 5.
- `prefers-reduced-motion`: Mars title background does not drift. Checked in Task 5.

---

### Task 1: Worlds (Mars filter) and Viking 2

**Files:**
- Create: `src/solar/world.ts`
- Modify: `src/solar/craft.ts` (add `viking-2` to `CRAFT_BODIES` after `viking-1`)
- Test: `tests/world.test.ts`

**Interfaces:**
- Produces:
  - `type WorldId = 'solar' | 'mars'`
  - `worldFromSearch(search: string): WorldId` — `'?world=mars'` → `'mars'`, anything else → `'solar'`
  - `bodiesOf(world: WorldId): BodyDef[]` — bodies the engine loads (`solar` → `BODIES`; `mars` → `mars, phobos, deimos`)
  - `craftOf(world: WorldId): BodyDef[]` — `solar` → `CRAFT_BODIES`; `mars` → the Mars landers in list order
  - `listOf(world: WorldId): BodyDef[]` — list order (Mars world: mars, its craft, phobos, deimos; solar world: `ALL_BODIES`)
  - `resolveStartId(world: WorldId, hashId: string | null): string` — `hashId` if it is in `listOf(world)`, else `'mars'` for Mars world and `'sun'` for solar

- [ ] **Step 1: Write failing tests in `tests/world.test.ts`.** Names and assertions:
  - `mars world loads only mars, phobos, deimos`: `bodiesOf('mars').map(b => b.id)` deepEquals `['mars','phobos','deimos']`.
  - `mars craft are the six landers plus Viking 2 in list order`: `craftOf('mars').map(c => c.id)` deepEquals `['viking-1','viking-2','sojourner','spirit','opportunity','insight','ingenuity']`.
  - `mars list order`: `listOf('mars').map(b => b.id)` deepEquals `['mars','viking-1','viking-2','sojourner','spirit','opportunity','insight','ingenuity','phobos','deimos']`.
  - `viking 2 is at Utopia Planitia`: its `craft` is `{kind:'surface', latDeg: 48.27, lonDeg: 134.0}` and `parent === 'mars'`.
  - `resolveStartId falls back to mars for unknown or non-mars ids`: `('mars','earth')`, `('mars','sun')`, `('mars',null)`, `('mars','nope')` all `'mars'`; `('mars','viking-1')` is `'viking-1'`; `('solar','sun')` is `'sun'`.
  - `worldFromSearch`: `'?world=mars'`→`'mars'`, `''`→`'solar'`, `'?world=venus'`→`'solar'`.
- [ ] **Step 2: Run** `npm test` → the new file fails (module missing).
- [ ] **Step 3: Implement `world.ts` and the `viking-2` entry** (same `lander(...)` helper and model as `viking-1`; site "Utopia Planitia"; info: landed 3 September 1976, worked until 1980).
- [ ] **Step 4: Run** `npm test` → all pass.
- [ ] **Step 5: Checkpoint** `npm test && npx tsc -b`.

---

### Task 2: Mars-only explorer

**Files:**
- Modify: `src/explorer/engine.ts` (constructor, `start`, `travelTo`, `getSelectedId`, the `'sun'` fallbacks at the `target` assignments), `src/explorer/App.tsx`, `src/explorer/styles.css` (only if panels need Mars-world tweaks)

**Interfaces:**
- Consumes: `WorldId`, `bodiesOf`, `craftOf`, `listOf`, `resolveStartId`, `worldFromSearch` (Task 1).
- Produces: `new SolarEngine(mount, labels, callbacks, world: WorldId = 'solar')`; `Callbacks.onArrive?: (id: string) => void`, called when an eased flight to a body finishes (the place where `updateFlight` sets `this.flight = null`).

- [ ] **Step 1: Engine uses the world.** Replace `BODIES` with `bodiesOf(world)` and `CRAFT_BODIES` with `craftOf(world)` everywhere in `engine.ts` except `orbitLinePoints`/`placeL1` imports. The "fallback target" `byId.get('sun')!` and `getSelectedId`'s `'sun'` become the first loaded body's id. `onProgress` totals use the filtered list. Add the optional `onArrive` call.
- [ ] **Step 2: App reads the world.** `const world = worldFromSearch(location.search)`; start id from `resolveStartId(world, hashPath)`; pass `world` to the engine; list is `listOf(world)`; `<h1>` is "Mars" in Mars world; back link is `← Lunar Trace` to `/mars/`, and the "Spacecraft →" link stays. Mars world sets the `mars-mode` body class always (the existing effect keys on the selected id; make it `world === 'mars' ||` the old test).
- [ ] **Step 2b: Run** `npm test && npx tsc -b` → pass.
- [ ] **Step 3: Verify in the browser.** Run `MOON_DEV_AUTOSTART=0 npm run dev:site`; open `http://localhost:3000/explorer.html?world=mars#/earth` with the Playwright MCP. Expected: lands on Mars (not Earth), list shows exactly the ten Task 1 entries, no Sun glow, no console errors; clicking Deimos and a lander flies there. Open `explorer.html#/earth` (no world): unchanged solar system.
- [ ] **Step 4: Checkpoint.**

---

### Task 3: Mars ground scene

**Files:**
- Create: `src/solar/noise.ts`, `src/solar/marsSurface.ts`
- Modify: `src/solar/surface.ts` (import `rng`, `hash`, `smooth`, `vnoise`, `fbm`, `clamp01`, `sstep` from `noise.ts` instead of defining them)
- Test: `tests/noise.test.ts`, `tests/marsSurface.test.ts`

**Interfaces:**
- Produces:
  - `noise.ts`: `rng(seed: number): () => number`, `fbm(x: number, y: number, oct?: number): number` (same behavior as the current private versions)
  - `marsSurface.ts`: `marsHeight(x: number, z: number): number` (metres, deterministic, exactly 0 within 3 m of the origin so the lander stands on a flat pad, |h| < 8 within 300 m); `MARS_SUN_ELEVATION_DEG = 25`; `class MarsSurfaceScene { readonly scene; readonly camera; constructor(); loadLander(loader: GLTFLoader, def: BodyDef): Promise<void>; setCameraPose(t: number): void; dispose(): void }`

- [ ] **Step 1: Write failing tests.** `noise.test.ts`: `rng(1)` twice gives identical first five values, all in [0,1); `fbm` is deterministic and within [0,1]. `marsSurface.test.ts`: `marsHeight(0,0) === 0`, `marsHeight(2.9,0) === 0`, `marsHeight(120,-80)` equals itself on a second call, `Math.abs(marsHeight(x,z)) < 8` over a 30×30 grid out to 300 m.
- [ ] **Step 2: Run** `npm test` → fail.
- [ ] **Step 3: Move the helpers to `noise.ts`, export them, and make `surface.ts` import them.** Run `npm test`; the existing tests still pass.
- [ ] **Step 4: Implement `marsSurface.ts`.** Same structure as `SurfaceScene` (ground mesh from `marsHeight`, instanced rocks, drifting camera at eye height) with Mars look: butterscotch sky (`scene.background` and `scene.fog` in the tan range, horizon lighter), rust-brown regolith, warm sunlight at `MARS_SUN_ELEVATION_DEG`, no craters. `loadLander` loads with `loadBody(def, loader)`, scales by `def.radiusKm * 1000`, rests it on the pad, and **clones** the wrapper first so Spirit/Opportunity's shared model is not changed.
- [ ] **Step 5: Run** `npm test && npx tsc -b` → pass.
- [ ] **Step 6: Checkpoint.** (Visual check happens in Task 4.)

---

### Task 4: Ground view in the explorer

**Files:**
- Create: `src/explorer/components/GroundView.tsx`
- Modify: `src/explorer/App.tsx`, `src/explorer/styles.css`

**Interfaces:**
- Consumes: `MarsSurfaceScene` (Task 3), `Callbacks.onArrive` (Task 2).
- Produces: `GroundView({ def, onClose }: { def: BodyDef; onClose: () => void })`: full-viewport canvas over the explorer, its own renderer and `requestAnimationFrame` loop, a caption (lander name, site, and "Terrain, rocks and heading are illustrative."), and a "← Back to orbit" button. `Esc` calls `onClose`.

- [ ] **Step 1: Implement `GroundView`.** Creates the renderer and scene in an effect and fully disposes them (cancel the frame, `renderer.dispose()`, `scene.dispose()`) in its cleanup; keyed by `def.id` so switching landers rebuilds cleanly. If the renderer throws, log it and call `onClose`.
- [ ] **Step 2: Wire it into `App`.** State `groundId: string | null`. In Mars world, `onArrive(id)` sets `groundId = id` when the arrived body has `craft?.kind === 'surface'`. Add a "Ground view (G)" button (top-right panel, shown when the selected body is a lander) and the `G` key; `Esc` and the back button clear `groundId`. The top-right panel keeps the existing "Controls" button.
- [ ] **Step 3: Verify in the browser** (Playwright): `explorer.html?world=mars`, click Viking 1 → flight, then the ground scene appears with the Viking model on butterscotch ground and the caption; take a screenshot. Press Esc → back to orbit. Click Sojourner, then Spirit, then Opportunity quickly: no console errors, and `document.querySelectorAll('canvas').length` does not grow with each pick. Check Spirit and Opportunity both show a rover.
- [ ] **Step 4: Checkpoint.**

---

### Task 5: Deimos view and the Mars title page

**Files:**
- Create: `src/solar/deimosView.ts`, `mars/index.html`, `src/mars/main.ts`, `src/mars/mars.css`
- Modify: `vite.config.ts` (add `mars: resolve(__dirname, 'mars/index.html')` to `build.rollupOptions.input` and `'mars/index.html'` to `optimizeDeps.entries`), `src/main.ts` (button)
- Test: `tests/deimosView.test.ts`

**Interfaces:**
- Produces in `deimosView.ts`:
  - `DEIMOS_ORBIT_KM = 23_463.2`, `DEIMOS_MEAN_RADIUS_KM = 6.2`
  - `angularRadiusDeg(radiusKm: number, distKm: number): number`
  - `marsElevationDeg(observerAngleDeg: number): number` — elevation of Mars' centre for an observer on Deimos at that angle from the sub-Mars point: `atan2(d·cosθ − R, d·sinθ)` with `d = DEIMOS_ORBIT_KM`, `R = DEIMOS_MEAN_RADIUS_KM`
  - `class DeimosViewScene { readonly scene; readonly camera; constructor(); loadMars(loader: GLTFLoader): Promise<void>; setCameraPose(t: number): void; dispose(): void }`

- [ ] **Step 1: Write failing tests.** `angularRadiusDeg(3396.2, 23463.2)` within 0.05 of 8.32; `marsElevationDeg(0)` is 90 (±1e-9); `marsElevationDeg(90)` is slightly negative (between −0.1 and 0); `marsElevationDeg(55)` between 30 and 40.
- [ ] **Step 2: Run** `npm test` → fail.
- [ ] **Step 3: Implement `deimosView.ts`.** Observer at 55° from the sub-Mars point, 2 m above a small dark-brown, noise-roughened Deimos surface (a sphere of the mean radius), camera looking at Mars; Mars (`/models/mars.glb` via `loadBody`) placed at `DEIMOS_ORBIT_KM` so its apparent size is true (`angularRadiusDeg`), lit as a gibbous phase; black sky, no stars. `setCameraPose(t)` drifts the view slightly.
- [ ] **Step 4: Title page.** `mars/index.html` mirrors `index.html` (title "Mars — Lunar Trace"). `src/mars/main.ts` imports `../style.css` and `./mars.css`, adds `mars-mode` to `body`, renders the same hero layout as `src/main.ts` with a full-screen canvas behind it: headline "What we **leave** behind.", a Mars-specific lede, and buttons "Explore Mars ↗" (`/explorer.html?world=mars#/mars`), "← Lunar Trace" (`/`), "Spacecraft ↗" (`/gallery.html`). It runs `DeimosViewScene` on a `WebGLRenderer`; with `prefers-reduced-motion` it renders one frame and does not call `setCameraPose` after that; if the renderer or model load fails it logs and the text and buttons still work. `mars.css` sets the orange accent and a warm dark background (`--accent: #ff9a69`, `--accent-rgb: 255, 154, 105`), white text.
- [ ] **Step 5: Home page.** In `src/main.ts` the "View Mars" link becomes `<a class="ghost-button world-button" href="/mars/">Explore Mars <span class="arrow">↗</span></a>`.
- [ ] **Step 6: Verify in the browser** (Playwright): `/mars/` shows Mars large over a dark Deimos horizon with the orange theme; "Explore Mars" opens the Mars explorer; home page button reads "Explore Mars" and goes to `/mars/`. Emulate a phone width (390 px): text and buttons do not overlap or scroll sideways. With reduced motion emulated, the view does not move.
- [ ] **Step 7: Run** `npm test && npx tsc -b && npm run build:site` → pass, and `dist/mars/index.html` exists.

---

### Task 6: Docs and final check

**Files:**
- Modify: `README.md` (pages table: add `/mars/` and `/explorer.html?world=mars`; "View Mars" → "Explore Mars"; one line that Mars ground scenes are illustrative)

- [ ] **Step 1: Update the README as above.**
- [ ] **Step 2: Full check:** `npm test && npx tsc -b && npm run build:site` → all pass.
- [ ] **Step 3: Walk the whole flow once in the browser** (home → Explore Mars → list → a lander ground view → Esc → back to `/mars/` → `/`) and report anything that did not work.
