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
lunar-trace/
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

## Weak devices

With no WebGL2, Data Saver, a slow connection, or little memory or few cores, the home page skips the live Moon and Mars and opens them only when asked. Add `?lite` to any URL to see this mode.
