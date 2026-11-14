# Lunar Trace source notes

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


## Added diorama assets

- Reference astronaut style: Sketchfab “Stylized Astronaut – Game-Ready” by cloudyette, Free Standard license: https://sketchfab.com/3d-models/stylized-astronaut-game-ready-27056600c2ac49f2827c4c5fc0a82940
- Local generated assets: `public/models/stylized-astronaut.glb` and `public/models/stylized-mars.glb`, generated for this project in a low-poly planetary-diorama style.
- Moon world: a procedural cratered 3D sphere in `src/expedition.ts`; the paid Moon GLB generation was not submitted because the session had insufficient 3D credits.


## Planet texture update

The Moon sphere now uses the local `public/textures/moon-lroc-color-2k.jpg` asset from NASA Scientific Visualization Studio’s CGI Moon Kit. NASA describes this 2048×1024 equirectangular color map as intended for wrapping onto 3D rendering spheres and sourced from Lunar Reconnaissance Orbiter camera data: https://svs.gsfc.nasa.gov/4720/. Mars continues to use the embedded texture materials from `public/models/stylized-mars.glb`.


## Front-page 3D asset update

- Mars texture: NASA Science, “Mars Image Texture,” sourced from Viking imagery processed by USGS and JPL/Caltech planetary maps: https://science.nasa.gov/3d-resources/mars/.
- Satellite: NASA 3D Resources, Active Cavity Irradiance Monitor Satellite (AcrimSAT) GLB from https://github.com/nasa/NASA-3D-Resources.
- Apollo archive additions: NASA 3D Resources Saturn V and Apollo Soyuz GLB models from https://github.com/nasa/NASA-3D-Resources.
- NASA’s Satellite Kit dataset and public satellite assets are documented at https://data.nasa.gov/dataset/nasa-3d-models-satellite-kit.


## Expedition Mars update

The expedition's Mars is now a sphere wrapped in NASA's "Mars Image Texture" (`public/textures/mars-nasa.jpg`, 1440×720; Viking imagery processed by USGS and JPL/Caltech) with the same map reused as a subtle bump map and a thin atmosphere haze: https://science.nasa.gov/3d-resources/mars/. It replaces the generated `stylized-mars.glb`, which is no longer used by the expedition.


## Expedition coordinates (real placement)

Craft in the expedition are placed from real latitude/longitude on maps that are equirectangular and centred on 0° longitude (NASA SVS CGI Moon Kit: https://svs.gsfc.nasa.gov/4720 ; NASA Mars Image Texture).
- Apollo 11, 12, 14, 15, 16, 17: NASA NSSDCA Apollo landing site coordinates (DE421 frame): https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html (Apollo 11 and 12 use the lunar-module values; Apollo 17 matches the LROC value).
- Viking 1: 22.483° N, 47.94° W per NASA's Viking 1 mission page (https://science.nasa.gov/mission/viking-1/). Other sources differ slightly (NSSDC 22.697° N, 48.222° W; HiRISE-measured about 22.27° N, 47.95° W), a difference of about 0.2° to 1° that is imperceptible at game scale.
- Perseverance: Jezero Crater landing site, 18.444° N, 77.450° E. Perseverance is still active, so this is its landing site and not its current position.
- Apollo 14, 15, 16 pop-up photos: NASA JSC image IDs AS14-66-9306, AS15-85-11451, AS16-115-18549. If an image fails to load, the pop-up hides it.
- Ingenuity is not in the expedition: it ended within a few km of Perseverance's landing site, which is the same dot at this scale, and I found no verified numeric coordinates for its final resting place.
