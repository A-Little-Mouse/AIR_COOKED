import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type ExpeditionWorld = 'moon' | 'mars';

type Discovery = {
  id: string;
  world: ExpeditionWorld;
  name: string;
  type: string;
  year: string;
  coordinates: string;
  lastImage: string;
  lastMessage: string;
  status: string;
  model: string;
  lat: number;
  lon: number;
};

const discoveries: Discovery[] = [
  {
    id: 'apollo-11', world: 'moon', name: 'Apollo 11 / Eagle', type: 'Lunar Module descent stage', year: '1969', coordinates: '0.67408° N, 23.47297° E', lastImage: 'https://images-assets.nasa.gov/image/AS11-40-5875/AS11-40-5875~orig.jpg', lastMessage: 'Houston, Tranquility Base here. The Eagle has landed.', status: 'Permanently parked at Tranquility Base', model: '/models/apollo-lunar-module.glb', lat: 0.67408, lon: 23.47297
  },
  {
    id: 'apollo-12', world: 'moon', name: 'Apollo 12 / Intrepid', type: 'Lunar Module descent stage', year: '1969', coordinates: '3.012° S, 23.421° W', lastImage: 'https://images-assets.nasa.gov/image/AS12-46-6798/AS12-46-6798~orig.jpg', lastMessage: 'Okay, Houston. Intrepid is on the surface.', status: 'Permanently parked near Surveyor 3', model: '/models/apollo-lunar-module.glb', lat: -3.012, lon: -23.421
  },
  {
    id: 'apollo-14', world: 'moon', name: 'Apollo 14 / Antares', type: 'Lunar Module descent stage', year: '1971', coordinates: '3.645° S, 17.471° W', lastImage: 'https://images-assets.nasa.gov/image/AS14-66-9306/AS14-66-9306~orig.jpg', lastMessage: 'Antares settled on a seven-degree slope in the Fra Mauro highlands.', status: 'Permanently parked in the Fra Mauro highlands', model: '/models/apollo-lunar-module.glb', lat: -3.645, lon: -17.471
  },
  {
    id: 'apollo-15', world: 'moon', name: 'Apollo 15 / Falcon', type: 'Lunar Module descent stage', year: '1971', coordinates: '26.132° N, 3.634° E', lastImage: 'https://images-assets.nasa.gov/image/AS15-85-11451/AS15-85-11451~orig.jpg', lastMessage: 'Falcon landed beside Hadley Rille, the first Apollo site explored with the Lunar Roving Vehicle.', status: 'Permanently parked at Hadley–Apennine', model: '/models/apollo-lunar-module.glb', lat: 26.132, lon: 3.634
  },
  {
    id: 'apollo-16', world: 'moon', name: 'Apollo 16 / Orion', type: 'Lunar Module descent stage', year: '1972', coordinates: '8.973° S, 15.501° E', lastImage: 'https://images-assets.nasa.gov/image/AS16-115-18549/AS16-115-18549~orig.jpg', lastMessage: 'Orion touched down in the Descartes Highlands on 20 April 1972.', status: 'Permanently parked in the Descartes Highlands', model: '/models/apollo-lunar-module.glb', lat: -8.973, lon: 15.501
  },
  {
    id: 'apollo-17', world: 'moon', name: 'Apollo 17 / Challenger', type: 'Lunar Module descent stage', year: '1972', coordinates: '20.19080° N, 30.77168° E', lastImage: 'https://images-assets.nasa.gov/image/AS17-134-20384/AS17-134-20384~orig.jpg', lastMessage: 'The view is just tremendous. It really is.', status: 'Permanently parked in Taurus-Littrow Valley', model: '/models/apollo-lunar-module.glb', lat: 20.1908, lon: 30.77168
  },
  {
    id: 'viking-1', world: 'mars', name: 'Viking 1', type: 'Mars lander', year: '1976', coordinates: '22.483° N, 47.940° W', lastImage: 'https://assets.science.nasa.gov/content/dam/science/psd/solar/internal_resources/3514/Viking_Lander_Line_Drawing-1.jpeg', lastMessage: 'Surface image received. Chryse Planitia is in view.', status: 'Communication lost on 11 Nov 1982', model: '/models/viking-lander.glb', lat: 22.483, lon: -47.94
  },
  {
    id: 'perseverance', world: 'mars', name: 'Mars 2020 / Perseverance', type: 'Mars rover', year: '2021', coordinates: '18.444° N, 77.450° E', lastImage: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia24096.jpeg', lastMessage: 'Touchdown confirmed. Perseverance is safe on Mars.', status: 'Active mission in Jezero Crater', model: '/models/perseverance-rover.glb', lat: 18.444, lon: 77.45
  }
];

const keyFor = (world: ExpeditionWorld) => `lunar-trace-discoveries-${world}`;

function expeditionShell() {
  return `
    <div class="expedition-shell" id="expedition-shell">
      <nav class="expedition-nav" aria-label="Expedition navigation">
        <a class="brand-lockup" href="/" aria-label="Return to Lunar Trace archive"><span class="brand-mark" aria-hidden="true"></span><span><span class="brand-word">LUNAR TRACE</span><span class="brand-sub"> / SURFACE EXPEDITION</span></span></a>
        <div class="nav-meta"><a href="/">Return to archive</a><span class="nav-status"><i class="status-dot" aria-hidden="true"></i>Suit signal live</span></div>
      </nav>
      <main class="expedition-main">
        <header class="expedition-header">
          <div class="expedition-title"><span class="eyebrow">FIELD SIM / 001</span><h1>Walk the <span>archive.</span></h1><p>You are the explorer. Walk around a living spherical world, keep your boots on the surface, locate the machines that stayed behind, and open the final signal each one sent home.</p></div>
          <div class="expedition-toolbar" role="group" aria-label="Expedition world selection"><button type="button" data-expedition-world="moon" class="active" aria-pressed="true">Moon / Apollo sites</button><button type="button" data-expedition-world="mars" aria-pressed="false">Mars / Chryse & Jezero</button></div>
        </header>
        <div class="expedition-layout">
          <section class="game-window" aria-label="Interactive astronaut expedition">
            <canvas id="expedition-canvas" aria-label="3D spherical expedition map. Use WASD or arrow keys to walk the astronaut around the globe; approach a spacecraft and press E to inspect."></canvas>
            <div class="game-hud" aria-hidden="true"><div class="game-topline"><span><strong id="game-world-label">MOON / TRANQUILITY BASE</strong></span><span id="game-coordinates">LAT 0.0° / LON 0.0°</span></div><div class="game-bottomline"><span id="game-objective">OBJECTIVE: LOCATE 3 SURFACE ARTIFACTS</span><span>WASD / ARROWS TO WALK · E TO INSPECT</span></div><span class="crosshair-game"></span><span class="compass">NAV</span></div>
            <div class="game-popup hidden" id="game-popup" role="dialog" aria-modal="true" aria-labelledby="popup-title"><span class="popup-label">ARCHIVE SIGNAL / RECOVERED</span><div class="popup-grid"><img class="popup-image" id="popup-image" alt="Mission image" /><div><h2 id="popup-title">Apollo 11 / Eagle</h2><p id="popup-description">Last known transmission recovered from the surface archive.</p><div class="popup-facts"><div class="popup-fact"><span>Coordinates</span><strong id="popup-coordinates"></strong></div><div class="popup-fact"><span>Last known status</span><strong id="popup-status"></strong></div></div></div></div><div class="popup-actions"><button type="button" id="close-popup">Return to surface</button></div></div>
            <button class="primary-button hidden" id="interact-button" type="button">Inspect nearby craft <span class="arrow">↗</span></button>
          </section>
          <aside class="game-side" aria-label="Expedition status">
            <section class="game-card"><h2>Mission <span>brief</span></h2><p id="mission-brief">Tranquility Base is scattered with the hardware of the first human landing. Find the three descent stages hidden in the dust.</p><div class="control-hint"><div class="key-row"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span><span>walk the sphere</span></div><div class="key-row"><span class="key">E</span><span>inspect nearby craft</span></div></div><div class="terrain-legend">The astronaut walks on the spherical surface. W faces away, S faces toward you, D faces right, and A faces left.</div></section>
            <section class="game-card"><h2>Achievement <span>list</span></h2><div class="achievement-list" id="achievement-list"></div><div class="discover-count" id="discover-count">0 / 3 artifacts discovered</div></section>
          </aside>
        </div>
      </main>
    </div>`;
}

class ExpeditionGame {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(54, 1, .1, 300);
  private renderer: THREE.WebGLRenderer;
  private loader = new GLTFLoader();
  private textureLoader = new THREE.TextureLoader();
  private astronaut = new THREE.Group();
  private artifacts = new Map<string, THREE.Group>();
  private world: ExpeditionWorld = 'moon';
  private keys = new Set<string>();
  private clock = new THREE.Clock();
  private animationFrame = 0;
  private terrain!: THREE.Mesh;
  private worldSpin = new THREE.Group();
  private planetRoot = new THREE.Group();
  private walkPhase = 0;
  private isWalking = false;
  private playerLongitude = 0;
  private playerLatitude = 0;
  private lastTangent = new THREE.Vector3(0, 1, 0);
  private readonly mapRadius = 11;
  private nearby: Discovery | null = null;
  private astronautModel: THREE.Object3D | null = null;

  private popupOpen = false;
  private discovered: Record<ExpeditionWorld, string[]> = { moon: [], mars: [] };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .72;
    this.renderer.shadowMap.enabled = true;
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(draco);
    // Locked third-person framing: the astronaut is always the visual anchor.
    this.camera.position.set(0, 6.1, 25);
    this.camera.lookAt(0, 1.0, 0);
    this.scene.fog = new THREE.Fog(0x11151a, 20, 100);
    this.setupLights();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.changeWorld('moon');
    this.animate();
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xd8e4ee, 0x211b18, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 3.1);
    sun.position.set(-13, 23, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
    this.scene.add(sun);
    const redRim = new THREE.PointLight(0xff9668, 2.2, 32);
    redRim.position.set(10, 5, -12);
    this.scene.add(redRim);
  }

  private makeTerrain(world: ExpeditionWorld) {
    // The entire planetary map lives under one pivot. Input rotates this pivot,
    // making the astronaut appear to walk while the character remains camera-fixed.
    this.worldSpin = new THREE.Group();
    this.scene.add(this.worldSpin);
    this.worldSpin.rotation.set(0, 0, 0);
    this.makePlanetDiorama(world);
  }

  private makeProceduralMoon() {
    const group = new THREE.Group();
    const moonGeometry = new THREE.SphereGeometry(this.mapRadius, 96, 64);
    const moonTexture = this.textureLoader.load('/textures/moon-lroc-color-2k.jpg');
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.anisotropy = 4;
    const moon = new THREE.Mesh(moonGeometry, new THREE.MeshStandardMaterial({ map: moonTexture, color: 0xc3c0b5, roughness: .98, flatShading: false }));
    moon.castShadow = true; moon.receiveShadow = true; group.add(moon);
    return group;
  }

  private async makePlanetDiorama(world: ExpeditionWorld) {
    this.planetRoot = new THREE.Group();
    this.worldSpin.add(this.planetRoot);
    if (world === 'moon') {
      this.planetRoot.add(this.makeProceduralMoon());
      return;
    }
    this.planetRoot.add(this.makeRealisticMars());
  }

  private makeRealisticMars() {
    // NASA Mars image texture (Viking imagery, USGS/JPL-Caltech) wrapped on a sphere,
    // with the same map reused as a gentle bump map for surface relief, plus a thin dusty atmosphere.
    const group = new THREE.Group();
    const texture = this.textureLoader.load('/textures/mars-nasa.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(this.mapRadius, 128, 96),
      new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 1.4, color: 0xd9a58a, roughness: .96, metalness: 0 })
    );
    mars.castShadow = true; mars.receiveShadow = true; group.add(mars);
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(this.mapRadius * 1.018, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0xe39a6e, transparent: true, opacity: .13, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(haze);
    return group;
  }

  private addOrbitLines(world: ExpeditionWorld) {
    for (const tilt of [.42, -.55]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(this.mapRadius + .08, .012, 4, 96), new THREE.MeshBasicMaterial({ color: world === 'moon' ? 0xd9ff4f : 0xff9a69, transparent: true, opacity: .22 }));
      ring.rotation.set(tilt, .3, .18); this.worldSpin.add(ring);
    }
  }

  private addDustParticles(world: ExpeditionWorld) {
    const geometry = new THREE.BufferGeometry(); const points = new Float32Array(520 * 3);
    for (let i = 0; i < points.length; i += 3) { points[i] = (Math.random() - .5) * 62; points[i + 1] = (Math.random() - .5) * 32; points[i + 2] = (Math.random() - .5) * 62; }
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: world === 'moon' ? 0xc4c0aa : 0xd17d5a, size: .035, transparent: true, opacity: .42 })));
  }

  // Real placement: both NASA maps are equirectangular and centred on 0° longitude, so a feature at
  // (lat, lon) sits where the sphere's UV maps it. The game's walking frame is rotated +90° in longitude.
  private gamePoint(latDeg: number, lonDeg: number, radius: number) {
    const lat = THREE.MathUtils.degToRad(latDeg); const lon = THREE.MathUtils.degToRad(lonDeg) + Math.PI / 2;
    return new THREE.Vector3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)).multiplyScalar(radius);
  }

  private mapPosition(discovery: Discovery) { return this.gamePoint(discovery.lat, discovery.lon, this.mapRadius + .05); }

  private async makeAstronaut() {
    this.astronaut = new THREE.Group();
    this.astronaut.position.set(0, 0, this.mapRadius + 1.02);
    this.astronaut.castShadow = true;
    this.scene.add(this.astronaut);
    try {
      const gltf = await this.loader.loadAsync('/models/stylized-astronaut.glb');
      this.astronautModel = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(this.astronautModel);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 2.15 / (Math.max(size.y, size.x, size.z) || 1);
      this.astronautModel.scale.setScalar(scale);
      this.astronautModel.position.set(-center.x * scale, -center.y * scale + .02, -center.z * scale);
      // The generated GLB presents its visible front opposite the controller's
      // initial tangent. Use the calibrated -90° local yaw so the visor/chest
      // follows travel and the backpack points behind the astronaut.
      this.astronautModel.rotation.y = -Math.PI / 2;
      this.astronautModel.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      this.astronaut.add(this.astronautModel);
    } catch (error) {
      console.warn('Stylized astronaut load failed', error);
      const suit = new THREE.MeshStandardMaterial({ color: 0xd7d7cf, roughness: .7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .58, 5, 10), suit); body.position.y = 1.1;
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0x242c32, metalness: .25, roughness: .55 })); helmet.position.y = 1.65;
      this.astronaut.add(body, helmet);
    }
  }

  private async addArtifact(discovery: Discovery) {
    const group = new THREE.Group();
    group.position.copy(this.mapPosition(discovery));
    group.userData.discoveryId = discovery.id;
    const normal = group.position.clone().normalize();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.6, 8), new THREE.MeshBasicMaterial({ color: discovery.world === 'moon' ? 0xd9ff4f : 0xff9a69, transparent: true, opacity: .72 })); beacon.position.y = .85;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.4, .018, 8, 32), new THREE.MeshBasicMaterial({ color: discovery.world === 'moon' ? 0xd9ff4f : 0xff9a69, transparent: true, opacity: .82 })); halo.rotation.x = Math.PI / 2; halo.position.y = .04;
    group.add(beacon, halo);
    this.worldSpin.add(group); this.artifacts.set(discovery.id, group);
    try {
      const gltf = await this.loader.loadAsync(discovery.model);
      const craft = gltf.scene; const bounds = new THREE.Box3().setFromObject(craft); const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3()); const scale = 1.05 / (Math.max(size.x, size.y, size.z) || 1);
      craft.scale.setScalar(scale); craft.position.set(-center.x * scale, -center.y * scale + .12, -center.z * scale); craft.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      group.add(craft);
    } catch { const marker = new THREE.Mesh(new THREE.ConeGeometry(.42, .9, 6), new THREE.MeshStandardMaterial({ color: discovery.world === 'moon' ? 0xb9913e : 0xb95c3b, roughness: .8 })); marker.position.y = .45; group.add(marker); }
  }

  changeWorld(world: ExpeditionWorld) {
    this.world = world; this.popupOpen = false; this.nearby = null; this.artifacts.clear();
    const start = world === 'moon' ? { lat: 0, lon: 0 } : { lat: 20, lon: 15 };
    this.playerLatitude = THREE.MathUtils.degToRad(start.lat); this.playerLongitude = THREE.MathUtils.degToRad(start.lon) + Math.PI / 2; this.lastTangent.set(0, 1, 0);
    while (this.scene.children.length > 3) this.scene.remove(this.scene.children[this.scene.children.length - 1]);
    this.makeTerrain(world); void this.makeAstronaut();
    discoveries.filter((item) => item.world === world).forEach((item) => void this.addArtifact(item));
    document.body.classList.toggle('expedition-mars', world === 'mars');
    document.querySelectorAll<HTMLButtonElement>('[data-expedition-world]').forEach((button) => { const active = button.dataset.expeditionWorld === world; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    document.querySelector('#game-world-label')!.textContent = world === 'moon' ? 'MOON / NEAR SIDE · APOLLO SITES' : 'MARS / CHRYSE PLANITIA & JEZERO';
    document.querySelector('#mission-brief')!.textContent = world === 'moon' ? 'Every Apollo descent stage here sits at its real latitude and longitude on NASA’s lunar map. Find Eagle, Intrepid, Antares, Falcon, Orion and Challenger.' : 'Viking 1 rests on Chryse Planitia and Perseverance explores Jezero Crater, each at its real coordinates on NASA’s Mars map. Walk to both and read their signals.';
    document.querySelector('#game-objective')!.textContent = `OBJECTIVE: LOCATE ${discoveries.filter((item) => item.world === world).length} SURFACE ARTIFACTS`;
    this.updateAchievements();
  }

  private bindInput() {
    window.addEventListener('keydown', (event) => { this.keys.add(event.key.toLowerCase()); if (event.key.toLowerCase() === 'e') this.inspectNearby(); if (event.key === 'Escape') this.closePopup(); });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    document.querySelectorAll<HTMLButtonElement>('[data-expedition-world]').forEach((button) => button.addEventListener('click', () => this.changeWorld(button.dataset.expeditionWorld as ExpeditionWorld)));
    document.querySelector<HTMLButtonElement>('#close-popup')!.addEventListener('click', () => this.closePopup());
    document.querySelector<HTMLButtonElement>('#interact-button')!.addEventListener('click', () => this.inspectNearby());
  }

  private updatePlayer(delta: number) {
    const input = new THREE.Vector2();
    if (!this.popupOpen) {
      // Screen-space controls: W/S are forward/back and D/A are right/left.
      // The spherical tangent basis is opposite to the visual compass, so the
      // signs are intentionally inverted here before heading is calculated.
      if (this.keys.has('d') || this.keys.has('arrowright')) input.x -= 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) input.x += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) input.y -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) input.y += 1;
    }
    this.isWalking = input.lengthSq() > 0;
    const normal = new THREE.Vector3(
      Math.sin(this.playerLongitude) * Math.cos(this.playerLatitude),
      Math.sin(this.playerLatitude),
      Math.cos(this.playerLongitude) * Math.cos(this.playerLatitude),
    );
    const east = new THREE.Vector3(Math.cos(this.playerLongitude), 0, -Math.sin(this.playerLongitude));
    const north = new THREE.Vector3(
      -Math.sin(this.playerLatitude) * Math.sin(this.playerLongitude),
      Math.cos(this.playerLatitude),
      -Math.sin(this.playerLatitude) * Math.cos(this.playerLongitude),
    );
    const tangent = east.clone().multiplyScalar(input.x).add(north.clone().multiplyScalar(input.y));
    if (this.isWalking) {
      tangent.normalize();
      const distance = delta * 3.1;
      // Keep the calibrated heading input above, but reverse the position
      // integration so the globe movement follows the astronaut's visible face.
      this.playerLongitude -= (input.x * distance) / (this.mapRadius * Math.max(Math.cos(this.playerLatitude), .18));
      this.playerLatitude = THREE.MathUtils.clamp(this.playerLatitude - (input.y * distance) / this.mapRadius, -1.45, 1.45);
      this.lastTangent.copy(tangent);
      this.walkPhase += delta * 10;
    } else {
      this.walkPhase += delta * 2.2;
    }
    const bob = this.isWalking ? Math.abs(Math.sin(this.walkPhase)) * .08 : Math.sin(this.walkPhase) * .018;
    const playerPosition = normal.clone().multiplyScalar(this.mapRadius + 1.02 + bob);
    this.astronaut.position.copy(playerPosition);
    const facing = this.isWalking ? tangent : this.lastTangent;
    const right = facing.clone().cross(normal).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, normal, facing.clone().negate());
    this.astronaut.quaternion.setFromRotationMatrix(basis);
    if (this.astronautModel) { this.astronautModel.rotation.z = this.isWalking ? Math.sin(this.walkPhase) * .025 : 0; }

    // Orbit around the globe's center rather than chasing the player's origin.
    // This keeps the whole sphere readable while the astronaut stays on the near surface.
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    const cameraPosition = normal.clone().multiplyScalar(this.mapRadius + 15).add(new THREE.Vector3(0, 3.8, 0));
    this.camera.position.lerp(cameraPosition, .1);
    this.camera.lookAt(cameraTarget);
    const lonRaw = THREE.MathUtils.radToDeg(this.playerLongitude) - 90;
    const lon = ((lonRaw + 540) % 360) - 180;
    const lat = THREE.MathUtils.radToDeg(this.playerLatitude);
    document.querySelector('#game-coordinates')!.textContent = `LAT ${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'} / LON ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
    this.checkNearby();
  }

  private checkNearby() {
    let closest: Discovery | null = null; let distance = Infinity;
    const astronautPosition = this.astronaut.getWorldPosition(new THREE.Vector3());
    for (const item of discoveries.filter((entry) => entry.world === this.world)) {
      const group = this.artifacts.get(item.id); if (!group) continue;
      const artifactPosition = group.getWorldPosition(new THREE.Vector3());
      const itemDistance = astronautPosition.distanceTo(artifactPosition);
      if (itemDistance < distance) { distance = itemDistance; closest = item; }
    }
    this.nearby = distance < 2.65 ? closest : null;
    const button = document.querySelector<HTMLButtonElement>('#interact-button');
    if (button) { button.classList.toggle('hidden', !this.nearby || this.popupOpen); if (this.nearby) button.innerHTML = `Inspect ${this.nearby.name} <span class="arrow">↗</span>`; }
    document.querySelector('#game-objective')!.textContent = this.nearby ? `SIGNAL LOCK: ${this.nearby.name.toUpperCase()} · PRESS E TO INSPECT` : `OBJECTIVE: WALK THE SPHERE TO LOCATE ${discoveries.filter((item) => item.world === this.world).length} ARTIFACTS`;
  }

  private inspectNearby() {
    if (!this.nearby || this.popupOpen) return;
    const item = this.nearby; this.popupOpen = true;
    const saved = this.discovered[this.world]; if (!saved.includes(item.id)) { saved.push(item.id); localStorage.setItem(keyFor(this.world), JSON.stringify(saved)); }
    const popupImage = document.querySelector('#popup-image') as HTMLImageElement;
    popupImage.onerror = () => { popupImage.style.visibility = 'hidden'; }; popupImage.style.visibility = 'visible'; popupImage.src = item.lastImage;
    document.querySelector('#popup-title')!.textContent = item.name;
    document.querySelector('#popup-description')!.textContent = `${item.lastMessage} This signal is attached to the ${item.type.toLowerCase()} record from ${item.year}.`;
    document.querySelector('#popup-coordinates')!.textContent = item.coordinates;
    document.querySelector('#popup-status')!.textContent = item.status;
    document.querySelector('#game-popup')!.classList.remove('hidden');
    document.querySelector('#interact-button')!.classList.add('hidden');
    this.updateAchievements();
  }

  private closePopup() { this.popupOpen = false; document.querySelector('#game-popup')!.classList.add('hidden'); this.checkNearby(); }

  private updateAchievements() {
    for (const world of ['moon', 'mars'] as ExpeditionWorld[]) { try { this.discovered[world] = JSON.parse(localStorage.getItem(keyFor(world)) || '[]'); } catch { this.discovered[world] = []; } }
    const current = discoveries.filter((item) => item.world === this.world); const found = this.discovered[this.world];
    document.querySelector('#achievement-list')!.innerHTML = current.map((item) => { const isFound = found.includes(item.id); return `<div class="achievement ${isFound ? 'found' : ''}"><span class="achievement-icon">${isFound ? '✓' : '·'}</span><div><strong>${item.name}</strong><small>${isFound ? 'signal recovered' : 'not yet located'}</small></div></div>`; }).join('');
    document.querySelector('#discover-count')!.textContent = `${found.length} / ${current.length} artifacts discovered`;
  }

  private resize() { const rect = this.canvas.getBoundingClientRect(); const width = Math.max(rect.width, 320); const height = Math.max(rect.height, 420); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
  private animate = () => { this.animationFrame = requestAnimationFrame(this.animate); const delta = Math.min(this.clock.getDelta(), .05); this.updatePlayer(delta); for (const group of this.artifacts.values()) { group.children[1]?.rotation && (group.children[1].rotation.z += delta * .55); if (group.children[0]) group.children[0].position.y = .85 + Math.sin(performance.now() * .002 + group.position.x) * .12; } this.renderer.render(this.scene, this.camera); };
}

export function mountExpedition(root: HTMLElement) {
  root.innerHTML = expeditionShell();
  const game = new ExpeditionGame(document.querySelector<HTMLCanvasElement>('#expedition-canvas')!);
  return game;
}
