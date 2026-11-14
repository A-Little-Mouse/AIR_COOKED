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
