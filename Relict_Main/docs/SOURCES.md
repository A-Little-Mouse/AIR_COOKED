# Relict source notes

- NASA Space Apps 2026 challenge brief: https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/?tab=details
- NASA 3D Resources hub: https://science.nasa.gov/3d-resources/
- NASA public 3D model repository: https://github.com/nasa/NASA-3D-Resources
- Apollo Lunar Module GLB: https://github.com/nasa/NASA-3D-Resources/blob/master/3D%20Models/Apollo%20Lunar%20Module/Apollo%20Lunar%20Module.glb
- Viking Lander GLB: https://github.com/nasa/NASA-3D-Resources/blob/master/3D%20Models/Viking%20Lander/Viking%20Lander.glb
- Mars 2020 Perseverance Rover GLB: https://github.com/nasa/NASA-3D-Resources/blob/master/3D%20Models/Mars%202020%20Perseverance%20Rover/Mars%202020%20Perseverance%20Rover.glb
- NASA Curiosity / Mars Science Laboratory mission context: https://science.nasa.gov/mission/msl-curiosity/
- NASA Gateway / Moon-to-Mars context: https://www.nasa.gov/mission/gateway/
- NASA Apollo 11 mission page, imagery and mission audio context: https://www.nasa.gov/mission/apollo-11/
- NASA Viking 1 mission page, landing coordinates and last communications context: https://science.nasa.gov/mission/viking-1/
- NASA Perseverance mission page, Jezero Crater context and mission imagery: https://science.nasa.gov/mission/mars-2020-perseverance/

The interface credits NASA’s 3D Resources hub and keeps the model links available in the viewer footer. The models are included as downloaded NASA GLB assets in `public/models/`.


## What the site uses now

- **Mars system** (`/explorer.html?world=mars`, `src/explorer/`, `src/solar/`): Mars, Phobos, Deimos and the Sun (`public/models/mars.glb`, `phobos.glb`, `deimos.glb`, `sun.glb`) and the lander and rover models (`public/models/craft/`, `public/models/viking-lander.glb`, `apollo-lunar-module.glb`), from NASA 3D Resources.
- **Positions:** JPL "Keplerian Elements for Approximate Positions of the Major Planets" (valid 1800-2050) for Mars; the Phobos and Deimos orbits and the IAU pole directions are in `src/solar/bodies.ts`. The landing coordinates are those of the NASA mission pages above.
- **Mars ground scenes** (`src/solar/marsSurface.ts`) are illustrative: procedural terrain and rocks, with the landing sites real.
- **The Moon** is the realistic Moon in `moon-explorer/` (see its `DATA-LICENSES.md`).
- **Spacecraft gallery** (`/gallery.html`): the models in `public/models/craft/` and the videos in `public/videos/`.

## Apollo command and service module (added)

- `assets/modules/apollo-csm.glb`: the exterior of the Apollo command and service module, exported and reduced (Draco, about 54,000 triangles, 0.6 MB) from "Apollo 3D: Command Module and Service Module Block 2" by **mesapilgrim** (Blend Swap, Creative Commons Attribution 3.0; licence text kept in `assets/modules/Apollo 3D Command Module and Service Module  Block 2/BLENDSWAP_LICENSE.txt`). Credit to mesapilgrim is required wherever it is shown. The interior, the tanks and the launch-escape tower were removed. It is a generic Block 2 craft, not Apollo 17's own.
