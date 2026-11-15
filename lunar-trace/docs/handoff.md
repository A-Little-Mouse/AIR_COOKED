# Handoff — Lunar Trace / "Retrieval" game

Paste this file's path into a new session ("read lunar-trace/docs/handoff.md and continue") to pick up where we left off.

---

## 1. Where everything is

| What | Path |
|---|---|
| **Working project** (Vite 6 + TypeScript, three.js 0.187, vanilla TS pages, React only in the explorer) | `/home/bacpac/Documents/nasa-3d-space/lunar-trace` |
| Owner's original Lunar Trace project — **never modified** | `/home/bacpac/Documents/Bootstrap Import Setup/shreyash/shreyash-prot` |
| Owner's raw planet/moon models (source of `public/models/*`) | `/home/bacpac/Documents/nasa-3d-space/assets/source-models` |
| (Older standalone explorer app — removed; its code lives on in `src/explorer` + `src/solar`) | — |

### Pages in the working project
- **`index.html` + `src/main.ts`** — title slide: one centred glass panel with the headline *"What we leave behind."*, the paragraph, and three buttons:
  **Explore** → `/explorer.html#/earth`, **View Moon** → `/expedition.html`, **View Mars** → `/expedition.html?world=mars`.
  Background: `src/solar/hero.ts` — true-scale "Earthrise" (camera above the Moon's far side, Earth beyond the limb). Start date is moved to a good lighting time by `src/solar/heroTime.ts`.
- **`explorer.html` + `src/explorer/`** (React) — true-scale solar-system explorer with NASA Eyes navigation: orbit mode (drag / A-D / Q-E / wheel / W-S / Z-C roll / Shift ×5 / X ×0.05), **K** = free fly, click a body/label/list item to fly there, time controls, labels, orbit lines, info card. Styled like the title slide (Space Grotesk + DM Mono, lime accent, orange for Mars and its moons). "← Lunar Trace" link goes back.
- **`expedition.html` + `src/expedition/`** — playable astronaut walking on a sphere (Moon, or Mars with `?world=mars`):
  - `expedition.ts` — the game (taken from the owner's project, then changed: full-page scene; no header, top bar, LAT/LON, radar/compass, objective line; side panels hidden behind `SHOW_SIDE_PANELS = false`). Walk with WASD/arrows, **E** inspects a nearby craft (popup), discoveries saved in `localStorage`.
  - `walk.ts` — great-circle walking (no latitude/longitude → no wall at the poles).
  - `astronaut.ts` + `rigWeights.ts` — the astronaut GLB is a single static mesh; it is rigged here (5 bones: root at feet, hips, shoulders) with a procedural walk cycle. Model axes: **+X = front**, arms point along **±Z**, +Y up.
- **`src/solar/`** — shared: `bodies.ts` (body data), `ephemeris.ts` (real positions: JPL Keplerian elements 1800–2050, Moon mean elements, Phobos/Deimos; IAU poles; Moon tidally locked), `loadBody.ts` (GLB loading/normalising, Sun material + corona).
- **`tests/`** — 17 Node tests (`ephemeris` is tested in the older app; here: hero time picker, walking on the sphere, rig weights and walk cycle).
- **`dev/rig-preview.html`** — dev-only page rendering the astronaut at fixed walk phases (not in the build).
- **`public/models/`** — sun, mercury, venus, earth, moon (light 4.5 MB version), mars, phobos, deimos, jupiter, saturn, neptune, apollo-lunar-module, viking-lander, perseverance-rover, stylized-astronaut, stylized-mars. `public/textures/moon-lroc-color-2k.jpg`. About 81 MB total.

### Commands (run inside `lunar-trace/`)
- `npm run dev -- --port 3001` — use **3001**; the owner's original project dev server uses 3000.
- `npm test` — 17 tests.
- `npm run build` — `tsc -b && vite build` (3 pages: index, explorer, expedition).

---

## 2. Decisions already made (do not re-ask)

- **Audience:** ages **10–18**; must work on **phones and laptops**; **English only** for now; **sound later**.
- **Game concept — "Retrieval"** (combines three ideas: Caretaker + Mission-Control puzzle + Mystery):
  You run a recovery programme. Pick an abandoned spacecraft (on the Moon, Mars, or in orbit), launch a **strong/heavy launcher** carrying a stack of craft (transfer tug, lander with a **grabber arm**, return capsule), travel (journeys **shortened but long enough to manage oxygen, power, fuel and heat**), grab the target from orbit or the surface, bring it **back to Earth's surface**, where it goes into a **museum**. Each recovered craft unlocks its **last message** and a small **"what happened to it" mystery**.
- **Realism:** **arcade**, simplified orbits (not a simulator). Two modes: **Explorer** (easy, auto-docking, no fail) and **Mission** (manual, tighter resources).
- **Where it lives:** add a **Play** button on the title slide for the game; **Explore** stays as the free sandbox explorer.
- **Models:** use NASA's free models from **https://science.nasa.gov/3d-resources/** (GitHub mirror `nasa/NASA-3D-Resources`, "free and without copyright"). The owner **approved downloading them**. Anything missing: build it (stylised, from primitives) or ask the owner if they have one.
- Earlier preferences that still hold: no stars in backgrounds; keep the lighter 4.5 MB Moon (the owner rejected the 81 MB original); Sun "stylised but nicer", static (no animated shader).

---

## 3. Next steps

### Step 1 — download and vet the NASA models (NOT done yet; both attempts were interrupted)
URL pattern: `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/<Folder>/<File>.glb`

**Player craft**
| Folder | File | Size |
|---|---|---|
| Saturn V | `Saturn V.glb` (heavy launcher) | 0.9 MB |
| Mobile Launcher | `Mobile Launcher (assembled).glb` (launch pad) | 0.2 MB |
| ESAS Crew Module | `ESAS Crew Module.glb` (Orion-like capsule) | <0.1 MB |
| Apollo Soyuz | `Apollo Soyuz.glb` | 1.0 MB |
| Gemini | `Gemini.glb` | 1.4 MB |
| Agena Target Vehicle | `Agena Target Vehicle.glb` (tug / transfer stage) | 1.2 MB |
| Space Shuttle Remote Manipulator System (Canadarm) | same name `.glb` (grabber arm) | 0.3 MB |
| Firefly | `Firefly.glb` (possibly a lander — check) | 0.3 MB |

**Targets to rescue:** Apollo Lunar Module (0.7), Viking Lander (1.8), Mars Exploration Rover - Opportunity (MER-B) (<0.1), Lunar Atmosphere and Dust Environment Explorer (LADEE) (0.2), Skylab (0.1), Explorer Jupiter-C Rocket (0.1), Clementine (3.0), Mars Global Surveyor (`Mars Global Surveyor.glb`, 1.9), Pioneer 10 (2.0), Voyager Probe (A) (0.3), Deep Space 1 (0.9), NEAR Shoemaker (0.7), Stardust (`Stardust.glb`, 3.8), Galileo (0.2), Magellan (3.2). Sizes in MB; total ≈ 25 MB.

**Skip:** Gateway (66 MB), Space Exploration Vehicle (22 MB), Space Launch System Block 1 (no `.glb`, only `.7z`).

Process: each download into its own new folder → check the file starts with `glTF` and the size matches → look at each one rendered → copy the good ones to `public/models/nasa/` → list each source in `SOURCES.md`. Check facts (status, location) before writing any mission text.

### Step 2 — first playable slice (write a short design and get the owner's approval first)
One full loop: **Earth → Moon → Apollo 11 lander → home**
1. Mission Control screen (pick target, launch, stack)
2. Launch sequence (Saturn V on the pad)
3. Compressed trip with oxygen / power / fuel / heat gauges
4. Land, walk out (reuse the expedition walking + rig), attach with the grabber arm
5. Return, re-entry, capsule lands in the target zone
6. Museum entry with the recovered last message
7. Save progress in `localStorage`; touch joystick + buttons for phones

Later slices: orbital retrieval (docking), Mars, launch-window puzzle using `ephemeris.ts`.

---

## 4. Gotchas
- three.js strips `.` from GLB node names (`Saturn.001` → `Saturn001`); use `THREE.PropertyBinding.sanitizeNodeName`.
- Mercury/Earth GLBs use `KHR_materials_pbrSpecularGlossiness` (three ignores it) — `loadBody.ts` rebuilds the material from the diffuse texture.
- The Sun GLB's texture is an **emissive** map (base colour is black).
- Visual testing: Playwright can't find Chrome. Use the flatpak Chrome: `flatpak run com.google.Chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --remote-debugging-port=9333 --user-data-dir=$HOME/Downloads/cdp-profile about:blank` and drive it with a small Chrome DevTools Protocol script (Node 22 has `WebSocket`). The scratchpad helpers were wiped — recreate them. Delete screenshots and `~/Downloads/cdp-profile` afterwards.
- Never `pkill -f` with a pattern that also appears in your own command line (it kills your own shell).
- Dev-only debug hooks: `window.__expedition` (has `debug()`), `window.__solar` (explorer).
- Open items: the expedition page has no back link (only the browser's Back); popup images load from NASA's servers; the explorer starts on Earth.

---

## 5. The story so far (how the project got here)

**Part 1 — the first solar system.** Started from three models (Sun, Mercury, Venus) in `3d models/` and built a React + TypeScript + three.js solar system with true orbital-distance ratios and a lit Sun. Over many rounds: removed the stars, made the Sun more realistic (glow, then a crisp halo), slowed the orbits; tried a WASD free camera (rewound), then added Earth, the Moon (shrunk from 81 MB to 4.5 MB by rebuilding the mesh with a 4k texture), real axial tilts and orbit inclinations, Mars with Phobos and Deimos, Jupiter, Saturn (rings fixed), and Neptune. Added a HUD (pause, player speed, click-to-travel), a free camera (left-drag look + WASD), tried a true-scale mode and the owner's own size table, then removed realistic scaling.

**Part 2 — NASA Eyes rebuild.** Cleared everything except `3d models/`, studied NASA's *Eyes on the Solar System* (read its published code for the exact controls), and rebuilt the explorer the way Eyes works: true sizes and distances in km, real planet positions from JPL elements, Eyes' orbit/free-fly navigation and smoothing, labels, time controls, info cards, embed URLs. Fixed the Sun (its texture was emissive) and Saturn's size, made the Moon tidally locked, and gave the Sun limb darkening, a warm gold-white colour and a streamered corona. Looked into extracting models from websites and found licensed Earth/Uranus/Venus options. A "recreate all of Eyes" request was set aside.

**Part 3 — Lunar Trace.** The owner brought in their NASA Space Apps project *Lunar Trace*. A copy became `lunar-trace/`: its title slide was placed over the solar system (Earthrise background), then step by step: Explore opens the explorer; the buttons became View Moon / View Mars; the top bar, "NASA Space Apps" text, footer, stat boards and the LUNA // 01 block were removed; everything was put into one vertically centred glass panel; the explorer was restyled to match. View Moon and View Mars now open the playable surface expedition from the original project, changed to use the solar-system Moon and Mars (lightened), a full-page scene, and no header, LAT/LON, radar, objective or side panels. Trying the 81 MB original Moon was reverted. The invisible wall at the poles was fixed with great-circle walking, and the static astronaut was rigged and given a walk cycle.

**Part 4 — the game.** Goal: attract kids and teens (10–18) to play and learn. After proposing ideas, the owner chose to combine them into **"Retrieval"** (section 2) and approved downloading NASA's free models. That download is the next thing to do (section 3, step 1).
