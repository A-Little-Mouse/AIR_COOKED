# Source models

Raw NASA / owner-supplied `.glb` files, grouped by kind and named in kebab-case.

| Folder | Files |
|---|---|
| `planets/` | sun, mercury, venus, earth, mars, jupiter, saturn, neptune |
| `moons/` | moon-lro-8k (81 MB, full-res), phobos, deimos |
| `landers-rovers/` | apollo-lunar-module, lunar-roving-vehicle, viking-lander, sojourner-rover, spirit-opportunity-rover, insight-lander, ingenuity-helicopter |
| `probes/` | dawn, near-shoemaker, kepler, apollo-soyuz, agena-target-vehicle |
| `satellites/` | ace, aim, acrimsat-a/b, aqua-a/b/c, aquarius-a/b |

Where each is used in the app (`Relict_Main/public/models/`):
- planets, phobos, deimos, apollo-lunar-module, viking-lander: used directly (explorer, expedition)
- moon: the app uses a lighter 4.5 MB rebuild (`moon.glb`), not `moon-lro-8k`
- everything else: `public/models/craft/<folder>/`, listed in `src/gallery/catalog.ts` and shown at `/gallery.html`
