# Relict
built by 18 Air Fryers group

*What we left behind.* An interactive 3D look at the hardware people have left on the Moon and Mars, made for the NASA Space Apps Challenge 2026 ("NASA's Discarded Equipment: Storytelling").


## Honest notes

- Only Apollo 17 has ground-level data on the Moon. The second rover near the module is an addition (Apollo 17 carried one).
- On Mars the landing sites are real, but the ground, rocks and lander headings are illustrative. There is no Mars terrain data here.

## Credits

### NASA and agency data

- NASA SVS CGI Moon Kit (LROC WAC colour, LOLA elevation): https://svs.gsfc.nasa.gov/4720/
- LROC NAC terrain and mosaics (Apollo 11 and 17 sites), NASA/GSFC/Arizona State University: https://quickmap.lroc.asu.edu/
- Apollo 17 flight-film panoramas (NASA/JSC) and the Apollo Lunar Surface Journal: https://www.nasa.gov/history/alsj-and-afj/
- Apollo 17 Mission Report (JSC-07904): https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19730015117.pdf
- NASA Blue Marble and Black Marble (Earth maps): https://earthobservatory.nasa.gov/features/BlueMarble
- NASA 3D Resources (Apollo Lunar Module by Michael D. Carbajal, and other NASA models): https://github.com/nasa/NASA-3D-Resources
- JPL approximate planet positions: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JAXA SELENE (Kaguya) Terrain Camera, ISAS/JAXA (modified): https://darts.isas.jaxa.jp/planet/pdap/selene/
- Haase et al. (2019), Apollo 17 landing-site package, TU Berlin/DLR with USGS PDS Annex
- IAU Gazetteer of Planetary Nomenclature (USGS): https://planetarynames.wr.usgs.gov/

Full terms, versions and credit lines for every dataset are in [`Relict_Main/moon-explorer/DATA-LICENSES.md`](Relict_Main/moon-explorer/DATA-LICENSES.md). NASA material is used with credit, and no NASA logo or insignia implies endorsement.

### 3D models by others

| Model | Author | Licence | Source |
|---|---|---|---|
| Lunar Roving Vehicle (modified: recompressed) | Deutsches Museum Digital | CC BY-SA 4.0 | https://sketchfab.com/3d-models/mondfahrzeug-lunar-rover-acb3f8645a69493cb211a62b40d66aab |
| InSight lander | Cybertron B-127 | CC BY 4.0 | https://sketchfab.com/3d-models/insight-lander-61343184899f4f04b4ef9e2b7b5f5c58 |
| Sojourner rover | Dan (danthemodeler) | CC BY 4.0 | https://sketchfab.com/3d-models/mars-sojourner-rover-model-8b3810e7cd804bd6b0009520c67984c6 |
| Dawn | uperesito | CC BY 4.0 | https://sketchfab.com/3d-models/dawn-5fb75fb420604866889c85633ff25bf6 |
| NEAR Shoemaker (non-commercial use only) | NASA | CC BY-NC 4.0 | https://sketchfab.com/3d-models/near-satellite-hUZJyxkL45sN62mJb3FlL4lQCvU |
| Apollo Command and Service Module (exterior, reduced) | mesapilgrim (Blend Swap) | CC BY 3.0 | https://creativecommons.org/licenses/by/3.0/ |
| Earth (source model in `assets/`) | Akshat | CC BY 4.0 | https://sketchfab.com/3d-models/earth-41fc80d85dfd480281f21b74b2de2faa |
| Mercury (source model in `assets/`) | Mieke Roth | CC BY 4.0 | https://sketchfab.com/3d-models/mercury-0930a4f0405243f6a9f93a4da79c66b6 |
| Neptune (source model in `assets/`) | SebastianSosnowski | CC BY 4.0 | https://sketchfab.com/3d-models/neptune-fe05e06a265d4a8f9285d34c933878ee |
| Apollo 11 Command Module (source model in `assets/`) | The Smithsonian Institution | CC0 | https://sketchfab.com/3d-models/apollo-11-command-module-combined-372bb6781922471cada4e0a9bd5c61fb |

Other models in `assets/` are free models from the internet, and many appear to be from NASA 3D Resources.

### Software and other data

- Moon viewer based on **3D Moon** by SkyLumi Labs (AGPL-3.0): https://github.com/skylumi-labs/3d-moon
- three.js, Astronomy Engine (Don Cross, MIT), Draco and other open-source software: see [`Relict_Main/moon-explorer/public/THIRD-PARTY-NOTICES.txt`](Relict_Main/moon-explorer/public/THIRD-PARTY-NOTICES.txt)
- HYG star database (CC BY-SA 4.0): https://codeberg.org/astronexus/hyg

## AI assistance

Parts of this project's code were written, refactored and debugged with the help of an AI coding assistant (Claude Code by Anthropic). This includes renaming and restructuring, the walking and jumping movement, the rover's ground shadow, performance work and cleanup. The project's concept, design and content direction are the team's own.
