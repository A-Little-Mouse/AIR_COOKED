# Relict

*What we leave behind.* An interactive look at the hardware people have left on the Moon and Mars, built with TypeScript, Vite and three.js.

| Page | What it is |
|---|---|
| `/` | Home page. The Moon slide, and a Mars slide (`/?mars`) with Mars seen beside Phobos. **Explore Moon** and **Explore Mars** open the live views |
| `/moon/` | The realistic Moon: real terrain and imagery, with walking on the Apollo 17 landing site |
| `/explorer.html?world=mars` | The Mars system. Bottom bar: Places, Home, Full view, Labels. Each lander opens a ground scene you can walk in |
| `/gallery.html` | Spacecraft gallery in 3D, with videos for some craft |

## Run it

```bash
npm install
npm run moon:install    # once, for the Moon app
npm run dev             # http://localhost:3000
```

`npm run build` builds the site and the Moon (mounted at `dist/moon`). `npm run build:site` builds the site only. `npm test` runs the site's tests; `npm run test:moon` runs the Moon's.

The Moon streams its terrain and imagery from a public data mirror, so it needs internet. Set `MOON_MIRROR` to use another one.

**Controls** (Moon and Mars ground views): W A S D walk, Shift runs, Space jumps, drag looks, Esc goes back to orbit.

On Mars the landing sites are real, but the ground, rocks and lander headings are illustrative. There is no Mars terrain data here. On the Moon, only Apollo 17 has ground-level data; its second rover near the module is an addition, since Apollo 17 carried one.

## Layout

```
Relict_Main/
├── src/            home page, Mars explorer, gallery
├── public/         models, videos and fonts
├── moon-explorer/  the realistic Moon (AGPL-3.0-only, see below)
├── scripts/        builds the Moon into dist/
└── docs/           model and data sources
```

## The Moon app

`moon-explorer/` is a trimmed copy of [3D Moon](https://github.com/skylumi-labs/3d-moon) by SkyLumi Labs (AGPL-3.0-only). We added walking, jumping, the Apollo 17 rovers, the fast-travel list and the Relict look, and removed its intro, telemetry and extra controls. Credits and notices are kept: `LICENSE`, `NOTICE`, `DATA-LICENSES.md`, `TRADEMARKS.md` and the in-app Credits panel.

## Licences

- AGPL-3.0 requires serving sites to offer the Moon app's source. Put your repository address in the Credits panel's source link (`moon-explorer/src/ui/credits.ts`, the `open-source` row, which still points to the upstream repository).
- The Lunar Roving Vehicle model's origin is not recorded. Confirm its licence before publishing.
- Spacecraft models come from NASA 3D Resources; data and image licences are in `moon-explorer/DATA-LICENSES.md` and `docs/SOURCES.md`.

## Credits

Relict is built on other people's work. The credit lines below are the ones each source asks for. The full terms are in `moon-explorer/DATA-LICENSES.md`, `moon-explorer/public/THIRD-PARTY-NOTICES.txt` and `docs/SOURCES.md`. NASA material is used under the [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); its use does not imply NASA endorsement, and the astronauts pictured (Eugene Cernan, Harrison Schmitt) must not be used to imply endorsement. Relict was made for the [NASA Space Apps Challenge 2026, "NASA's Discarded Equipment Storytelling"](https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/?tab=details).

### The Moon viewer

- Based on [3D Moon](https://github.com/skylumi-labs/3d-moon) by SkyLumi Labs (Corsier Labs, LLC), AGPL-3.0-only. "SkyLumi" and its logo are trademarks of Corsier Labs, LLC; see `moon-explorer/TRADEMARKS.md`.

### Moon imagery and terrain

- **Global Moon maps:** NASA's Scientific Visualization Studio; Ernie Wright; Noah Petro; LRO Camera team / Arizona State University; LOLA ([SVS 4720, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)).
- **Terrain tiles:** Barker et al. (2016) (SLDEM2015); NASA/GSFC/MIT (LOLA); Japan Aerospace Exploration Agency (JAXA), SELENE/Kaguya Terrain Camera; NASA/GSFC/Arizona State University (LROC WAC); Wagner, Speyerer, Robinson and the LROC Team (2015), LROC WAC Global Morphology Mosaic.
- **Polar imagery:** LROC WAC team, NASA/GSFC/Arizona State University; Speyerer, Robinson, Boyd, Wagner and Henriksen (2020), *Exploration of the lunar south pole with LROC data products*, Lunar Surface Science Workshop, Abstract #5132.
- **Kaguya Terrain Camera mosaic:** ISAS/JAXA (modified). We thank the SELENE(KAGUYA) TC team and the SELENE Data Archive.
- **Apollo 11 site:** LROC NAC; NASA/GSFC/Arizona State University.
- **Apollo 17 site (Taurus-Littrow):** LROC NAC; NASA/GSFC/Arizona State University.
- **Apollo 17 landing-site 25 cm tier:** I. Haase, M. Wählisch, P. Gläser, J. Oberst and M. S. Robinson (TU Berlin, DLR), *Earth and Space Science* 6(1), 59-95, 2019 ([doi:10.1029/2018EA000408](https://doi.org/10.1029/2018EA000408)); LROC; NASA/GSFC/Arizona State University; USGS PDS Annex.
- **Place names:** IAU WGPSN, Gazetteer of Planetary Nomenclature (USGS Astrogeology Science Center).

### Apollo 17 mission data

- **Landing path and timeline:** NASA Manned Spacecraft Center, Apollo 17 Mission Report (JSC-07904); Apollo Lunar Surface Journal by Eric M. Jones and Ken Glover. The flight track is this project's transcription, and interpolated intervals are modelled.
- **Surface panoramas:** NASA/JSC. Original flight-film panoramas (JSC2004e52772, JSC2007e045388, JSC2007e045387) assembled by Warren Harold at Johnson Space Center. Retiled to WebP by this project.

### 3D models

- **Apollo Lunar Module:** NASA 3D Resources; model by Michael D. Carbajal.
- **Apollo command and service module:** "Apollo 3D: Command Module and Service Module Block 2" by **mesapilgrim** (Blend Swap), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Exterior only, reduced by this project; a generic Block 2 craft, not Apollo 17's own. Credit to mesapilgrim is required wherever it is shown.
- **Planets, moons (Phobos, Deimos), Sun, landers, rovers, probes and satellites:** [NASA 3D Resources](https://science.nasa.gov/3d-resources/) ([repository](https://github.com/nasa/NASA-3D-Resources)).
- **Lunar Roving Vehicle:** origin not recorded. Confirm the model's source and licence before publishing (see Licences above).
- **Gallery videos** (`public/videos/`): origin not recorded in `docs/SOURCES.md`. Add the source before publishing.

### Earth, stars and Mars

- **Earth maps:** Blue Marble: Reto Stöckli, NASA Earth Observatory (NASA Goddard Space Flight Center); clouds: NASA GSFC image by Reto Stöckli, enhancements by Robert Simmon, MODIS Land, Atmosphere and Ocean groups and MODIS Science Data Support Team; Black Marble: NASA Earth Observatory images by Joshua Stevens, using Suomi NPP VIIRS data from Miguel Román, NASA GSFC; water mask: NASA GIBS / MOD44W (Carroll et al., 2009). Per-file sources are in `moon-explorer/public/earth/credits.json`.
- **Stars:** HYG Database contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) ([HYG](https://codeberg.org/astronexus/hyg)). Share-alike applies to `asteroid-stars.json` and its derivatives, not to the code.
- **Mars system positions:** JPL, "Keplerian Elements for Approximate Positions of the Major Planets" (valid 1800-2050). Phobos and Deimos orbits and IAU pole directions are in `src/solar/bodies.ts`. Landing coordinates come from the NASA mission pages listed in `docs/SOURCES.md` (for example [Viking 1](https://science.nasa.gov/mission/viking-1/) and [Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/)). The Mars ground scenes are illustrative: procedural terrain and rocks, with the landing sites real.

### Software and fonts

- [three.js](https://threejs.org) (MIT), [Astronomy Engine](https://github.com/cosinekitty/astronomy) (MIT), [Draco](https://github.com/google/draco) (Apache-2.0), [Tabler Icons](https://tabler.io/icons) (MIT, outline icons copied), and the Precomputed Atmospheric Scattering transmittance parametrisation (BSD-3-Clause). Full licence texts: `moon-explorer/public/THIRD-PARTY-NOTICES.txt`.
- The site is also built with React, Vite and TypeScript (see `package.json`).
- Fonts: [Space Grotesk](https://github.com/floriankarsten/space-grotesk) and [DM Mono](https://github.com/googlefonts/dm-mono) (Copyright 2020 The DM Mono Project Authors), both under the SIL Open Font License 1.1.

### Trailer (`videos/moon-trailer-30s.mp4`)

- **Picture:** rendered live from the Moon viewer using the data and models credited above. It is not real footage.
- **Audio:** Apollo 17 lunar landing recording, NASA mission audio, recorded at Honeysuckle Creek and preserved by Alan Foster, transferred by Colin Mackellar ([Honeysuckle Creek](https://honeysucklecreek.net/msfn_missions/Apollo_17_mission/hl_apollo_17.html)).
- **Music:** "cinematic space" by Leberch, from Pixabay. The artist name comes from the downloaded file's name (`leberch-cinematic-space-510707.mp3`); confirm the track title and licence on its Pixabay page before publishing.
- **Titles:** set in Space Grotesk and DM Mono.

## Weak devices

With no WebGL2, Data Saver, a slow connection, or little memory or few cores, the home page skips the live Moon and Mars and opens them only when asked. Add `?lite` to any URL to see this mode.
