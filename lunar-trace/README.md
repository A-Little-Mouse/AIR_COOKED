# Relict

*What we leave behind.* An interactive, true-scale look at the hardware people have left on the Moon, on Mars and in space, built with TypeScript, Vite and three.js.

| Page | What it is |
|---|---|
| `/` | Title slide: Earthrise, then a ground-level view of the Apollo 11 lander at Tranquility Base |
| `/explorer.html` | True-scale solar system (real orbits), with the landers, rovers and satellites we have models of |
| `/?mars` | The home page on its Mars slide (`/mars/` redirects here): Mars from Deimos. **Explore Mars** pulls back and fades in the whole Mars system, preloaded behind it, as the Moon is |
| `/explorer.html?world=mars` | The Mars system (Mars, Phobos, Deimos, the Sun as light): the Moon page's bar (Places, Home = back to the main page, Full view = the fixed whole-Mars camera, Labels, off at first). Each lander opens an illustrative ground scene (`G`; walk with W A S D, `Esc` goes back) |
| `/gallery.html` | Spacecraft gallery: every model in `assets/source-models`, viewable in 3D |
| `/moon/` | **The realistic Moon** (**View Moon**): real terrain and imagery, down to walking on the Apollo 17 landing site |

## Run it

```bash
npm install                 # this app
npm run moon:install        # the Moon app (moon-explorer/), once
npm run dev                 # http://localhost:3000  (the Moon is served from the same server at /moon/)
```

In development the Moon is its production build (`moon-explorer/dist`), kept up to date by `vite build --watch` while `npm run dev` runs: the first run takes about a minute, and after you edit Moon code a rebuild takes 10-20 seconds before a refresh shows it. To go back to the Moon's own dev server (hot reload, on port 5192, proxied at `/moon/`) run `MOON_DEV_MODE=server npm run dev`. `MOON_DEV_AUTOSTART=0` starts no Moon process at all.

`npm run build` builds the site and the Moon together and mounts the Moon at `dist/moon`. `npm run build:site` builds only the site.
The Moon streams its terrain and imagery from a public data mirror at run time (best effort, needs internet; set `MOON_MIRROR` to use another).

On the Moon: **W A S D** walk (Shift runs), **drag** looks around, **Space** jumps (lunar gravity: about 1 m up, 2 seconds in the air), **V** walks or flies, **Esc** goes back up to orbit.
The **To the module** / **To the rover** buttons (archive view, `?archive=1`) take you to either. Apollo 17 is the only site with ground-level data.

On Mars the landing sites are real, but the ground scenes (terrain, rocks, the lander's heading) and the Deimos surface are illustrative: there is no Mars terrain data here, unlike the Apollo 17 Moon.

## Layout

```
lunar-trace/
├── src/                the site: title slide, solar-system explorer, gallery
├── public/             models (optimised) and textures for the site
├── moon-explorer/      the realistic Moon: a trimmed copy of 3D Moon (see below), AGPL-3.0-only
│   └── parked/         code we took out of the build for now (the walking astronaut)
├── scripts/            build-moon.mjs: builds the Moon and mounts it in dist/
├── docs/               hand-off notes and model sources
└── ../assets/source-models/   raw .glb models, grouped by kind
```

## What is taken from `moon-explorer` (3D Moon)

`moon-explorer/` is a copy of **[3D Moon](https://github.com/skylumi-labs/3d-moon)** by SkyLumi Labs (AGPL-3.0-only). Everything below is theirs, unchanged unless the next section says otherwise.

**Code** (`moon-explorer/src`)
- The Moon renderer: a full-screen ray-cast Moon (`moon/`, `glsl/`, `post/`), its shaders and tiled terrain/imagery streaming with level of detail.
- Terrain-aware lighting and shadows from the real Sun (`lighting/`, `sun/`, `sky/`, `ephemeris.ts`, with [Astronomy Engine](https://github.com/cosinekitty/astronomy)).
- The camera rig, fly and zoom controls (`camera/`), the Apollo 11 and Apollo 17 site patches (`moon/patch/`), and the Apollo 17 **ground view** with the lunar module (`ground/`).
- The Apollo 17 descent flight (`descent/`, using `data/apollo17/descent-track.json`), feature labels (`labels/`) and the bar, navigator, pins, captions and credits UI (`ui/`, `hud.ts`).

**Data and models**
- `shared-assets/`: the 4K Moon colour and height maps (NASA SVS CGI Moon Kit) and the star list (off by default).
- `data/apollo17/`: Apollo 17 control points, traverses and rover/boot tracks (Haase et al. 2019, LROC NAC).
- `public/lm/apollo-lunar-module.glb`: NASA's Apollo Lunar Module model. `public/earth/`: Earth maps for the sky (NASA Blue Marble, Black Marble). `public/panorama/`: Apollo 17 surface panoramas (NASA/JSC). `public/draco/`: Draco decoder.
- **Streamed at run time, not stored here:** terrain and imagery tiles (NASA LRO LOLA, SLDEM2015, LROC WAC, JAXA SELENE Terrain Camera) and the Apollo 11 and 17 close-up patches (LROC NAC, Haase et al.), from the project's public mirror.

## What we changed or added

- **Walking camera:** first-person walking at eye height, run, and a lunar **jump** (`ground/GroundCamera.ts`, `ground/groundControls.ts`).
- **Apollo 17 rover** at Station 1 (a measured rover stop), drawn over the ground (`ground/actors/ActorLayer.ts`, `public/actors/lunar-roving-vehicle.glb`, shrunk from 31.6 MB to 1.45 MB; loaded only within 400 m). Its heading is a guess.
- **Relict look:** Space Grotesk and DM Mono, the lime accent and glass panels (`ui/lunarTrace.css`), a "← Relict" link, our title, favicon and manifest.
- **Parked:** the walk at the other Apollo sites (an illustrative surface) is in `moon-explorer/parked/illustrative-walk/`, out of the build.
- **Fast travel list:** the bar's list is only the Apollo sites and Earthrise; the card pictures are renders of our own models (`public/thumbs/`, made by `dev/thumbs.html`). The timeline slider is off. A globe button finds the Earth.
- **Light by default:** Battery quality preset, one pixel per CSS pixel unless `?dpr=`, no star field unless `?stars=1`.
- **Parked, not deleted:** the walking astronaut with a lunar lope and foot dust, in `moon-explorer/parked/astronaut/` (its README says how to bring it back).

## What we removed or switched off

- The loading screen, title splash and flyby (`LUNAR_TRACE_INTRO = false` in `main.ts`; the loading line is hidden), the first-visit hotspot hints, the date/time control, the "More" menu, the distance/altitude readout and the zoom tape.
- Upstream's audit rig, CI workflows, contributor and security documents, lint config, and the analytics/telemetry credit. No telemetry is sent: no keys are configured, so its code never runs.
- The unused fonts (Jost, Share Tech Mono) and the SkyLumi branding in the page chrome.

## Credits we kept, and why

Removed credits are only those for things we no longer ship or use (analytics, two fonts, error-tracking libraries). We **kept**:

- **The Credits panel** (the "Credits" link at the bottom left of the Moon), listing only the sources in use: the Moon maps, LRO/SLDEM2015/LROC tiles, JAXA Terrain Camera detail ("ISAS/JAXA (modified)" is required by their data policy), Apollo 11 and 17 site data, Haase et al. (the 2019 paper asks to be cited), Apollo 17 panoramas and mission record, the lunar module and Earth maps, the feature-name gazetteer, Astronomy Engine, the star catalogue (CC BY-SA 4.0, still shipped), and the modelled-light note.
- **A source link** in that panel and the AGPL notice. AGPL-3.0 requires a site that serves a modified copy to offer its source to its users.
- `moon-explorer/LICENSE`, `NOTICE`, `DATA-LICENSES.md`, `TRADEMARKS.md` and `public/THIRD-PARTY-NOTICES.txt`. "SkyLumi" stays in the data credit lines because they say who processed the data.

## Licences and open items

- `moon-explorer/` is **AGPL-3.0-only** (3D Moon plus our changes). If you serve the site, publish `moon-explorer/`'s source and put its address in the Credits panel's source link (`moon-explorer/src/ui/credits.ts`, the `open-source` row, which currently points to the upstream repository). The rest of Relict is a separate app in the same folder tree.
- The **Lunar Roving Vehicle model**'s origin is not recorded; confirm its licence before publishing. The lunar module, Earth maps and panoramas are NASA media (credit requested).
- Data licences are in `moon-explorer/DATA-LICENSES.md`.
