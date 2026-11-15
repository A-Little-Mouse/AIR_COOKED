import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { latLonDeg, startFrame, walk } from './walk.ts';
import { rigAstronaut, type AstronautRig } from './astronaut.ts';

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
  position: [number, number, number];
};

const discoveries: Discovery[] = [
  {
    id: 'apollo-11', world: 'moon', name: 'Apollo 11 / Eagle', type: 'Lunar Module descent stage', year: '1969', coordinates: '0.67408° N, 23.47297° E', lastImage: 'https://images-assets.nasa.gov/image/AS11-40-5875/AS11-40-5875~orig.jpg', lastMessage: 'Houston, Tranquility Base here. The Eagle has landed.', status: 'Permanently parked at Tranquility Base', model: '/models/apollo-lunar-module.glb', position: [-7, 0, -6]
  },
  {
    id: 'apollo-12', world: 'moon', name: 'Apollo 12 / Intrepid', type: 'Lunar Module descent stage', year: '1969', coordinates: '3.012° S, 23.421° W', lastImage: 'https://images-assets.nasa.gov/image/AS12-46-6798/AS12-46-6798~orig.jpg', lastMessage: 'Okay, Houston. Intrepid is on the surface.', status: 'Permanently parked near Surveyor 3', model: '/models/apollo-lunar-module.glb', position: [8, 0, -8]
  },
  {
    id: 'apollo-17', world: 'moon', name: 'Apollo 17 / Challenger', type: 'Lunar Module descent stage', year: '1972', coordinates: '20.19080° N, 30.77168° E', lastImage: 'https://images-assets.nasa.gov/image/AS17-134-20384/AS17-134-20384~orig.jpg', lastMessage: 'The view is just tremendous. It really is.', status: 'Permanently parked in Taurus-Littrow Valley', model: '/models/apollo-lunar-module.glb', position: [3, 0, 9]
  },
  {
    id: 'viking-1', world: 'mars', name: 'Viking 1', type: 'Mars lander', year: '1976', coordinates: '22.483° N, 47.940° W', lastImage: 'https://assets.science.nasa.gov/content/dam/science/psd/solar/internal_resources/3514/Viking_Lander_Line_Drawing-1.jpeg', lastMessage: 'Surface image received. Chryse Planitia is in view.', status: 'Communication lost on 11 Nov 1982', model: '/models/viking-lander.glb', position: [-5, 0, -7]
  },
  {
    id: 'perseverance', world: 'mars', name: 'Mars 2020 / Perseverance', type: 'Mars rover', year: '2021', coordinates: '18.444° N, 77.450° E', lastImage: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia24096.jpeg', lastMessage: 'Touchdown confirmed. Perseverance is safe on Mars.', status: 'Active mission in Jezero Crater', model: '/models/perseverance-rover.glb', position: [7, 0, 5]
  }
];

/** The mission brief / achievement panels and the objective line are switched off for now: these no-op when absent. */
const setText = (selector: string, text: string) => { const el = document.querySelector(selector); if (el) el.textContent = text; };
const setHtml = (selector: string, html: string) => { const el = document.querySelector(selector); if (el) el.innerHTML = html; };
/** Flip to true to bring back the "Mission brief" and "Achievement list" cards (right side). */
const SHOW_SIDE_PANELS = false;

const keyFor = (world: ExpeditionWorld) => `lunar-trace-discoveries-${world}`;

const SIDE_PANELS = `
          <aside class="game-side" aria-label="Expedition status">
            <section class="game-card"><h2>Mission <span>brief</span></h2><p id="mission-brief">Tranquility Base is scattered with the hardware of the first human landing. Find the three descent stages hidden in the dust.</p><div class="control-hint"><div class="key-row"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span><span>walk the sphere</span></div><div class="key-row"><span class="key">E</span><span>inspect nearby craft</span></div></div><div class="terrain-legend">The astronaut walks on the spherical surface. W faces away, S faces toward you, D faces right, and A faces left.</div></section>
            <section class="game-card"><h2>Achievement <span>list</span></h2><div class="achievement-list" id="achievement-list"></div><div class="discover-count" id="discover-count">0 / 3 artifacts discovered</div></section>
          </aside>
`;

function expeditionShell() {
  return `
    <div class="expedition-shell" id="expedition-shell">
      <main class="expedition-main">
        <div class="expedition-layout">
          <section class="game-window" aria-label="Interactive astronaut expedition">
            <canvas id="expedition-canvas" aria-label="3D spherical expedition map. Use WASD or arrow keys to walk the astronaut around the globe; approach a spacecraft and press E to inspect."></canvas>
            <div class="game-hud" aria-hidden="true"><div class="game-topline"><span><strong id="game-world-label">MOON / TRANQUILITY BASE</strong></span></div><div class="game-bottomline"><span>WASD / ARROWS TO WALK · E TO INSPECT</span></div><span class="crosshair-game"></span></div>
            <div class="game-popup hidden" id="game-popup" role="dialog" aria-modal="true" aria-labelledby="popup-title"><span class="popup-label">ARCHIVE SIGNAL / RECOVERED</span><div class="popup-grid"><img class="popup-image" id="popup-image" alt="Mission image" /><div><h2 id="popup-title">Apollo 11 / Eagle</h2><p id="popup-description">Last known transmission recovered from the surface archive.</p><div class="popup-facts"><div class="popup-fact"><span>Coordinates</span><strong id="popup-coordinates"></strong></div><div class="popup-fact"><span>Last known status</span><strong id="popup-status"></strong></div></div></div></div><div class="popup-actions"><button type="button" id="close-popup">Return to surface</button></div></div>
            <button class="primary-button hidden" id="interact-button" type="button">Inspect nearby craft <span class="arrow">↗</span></button>
          </section>
          ${SHOW_SIDE_PANELS ? SIDE_PANELS : ''}
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
  /** Player position on the sphere + which way is up the screen (see walk.ts: no latitude/longitude, so no poles to get stuck on). */
  private frame = startFrame();
  private lastTangent = new THREE.Vector3(0, 1, 0);
  private readonly mapRadius = 10;
  private nearby: Discovery | null = null;
  private astronautModel: THREE.Object3D | null = null;
  private astronautRig: AstronautRig | null = null;

  private popupOpen = false;
  private discovered: Record<ExpeditionWorld, string[]> = { moon: [], mars: [] };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .95; // was .72: lighter overall
    this.renderer.shadowMap.enabled = true;
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader.setDRACOLoader(draco);
    // Locked third-person framing: the astronaut is always the visual anchor.
    this.camera.position.set(0, 6.1, 25);
    this.camera.lookAt(0, 1.0, 0);
    this.scene.fog = new THREE.Fog(0x11151a, 20, 100);
    this.setupLights();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.changeWorld(new URLSearchParams(window.location.search).get('world') === 'mars' ? 'mars' : 'moon');
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

  /**
   * The Moon / Mars from the solar-system explorer (public/models/moon.glb: NASA LRO imagery on a 4k texture; mars.glb), scaled
   * to the walkable sphere. Lightened a little: full-white base colour, and the texture is also fed to the emissive channel so
   * surface detail stays readable in shadow. Returns null if the model fails to load (the caller falls back to the original).
   */
  private async loadSolarWorld(url: string, emissive: number): Promise<THREE.Object3D | null> {
    try {
      const gltf = await this.loader.loadAsync(url);
      const world = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(world);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = (this.mapRadius * 2) / (Math.max(size.x, size.y, size.z) || 1);
      world.scale.setScalar(scale);
      world.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      world.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true; object.receiveShadow = true;
        const material = object.material as THREE.MeshStandardMaterial;
        material.color.set(0xffffff);
        material.roughness = .95; material.metalness = 0; material.side = THREE.FrontSide;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 8;
          material.emissiveMap = material.map;
          material.emissive.set(emissive);
        }
        material.needsUpdate = true;
      });
      const group = new THREE.Group();
      group.add(world);
      return group;
    } catch (error) {
      console.warn(`Solar-system world load failed (${url}); using the original`, error);
      return null;
    }
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
      const moon = (await this.loadSolarWorld('/models/moon.glb', 0x707070)) ?? this.makeProceduralMoon();
      if (this.world === world) this.planetRoot.add(moon);
      return;
    }
    const solarMars = await this.loadSolarWorld('/models/mars.glb', 0x4a4a4a);
    if (solarMars) {
      if (this.world === world) this.planetRoot.add(solarMars);
      return;
    }
    try {
      const gltf = await this.loader.loadAsync('/models/stylized-mars.glb');
      if (this.world !== world) return;
      const planet = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(planet);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = (this.mapRadius * 2.04) / (Math.max(size.x, size.y, size.z) || 1);
      planet.scale.setScalar(scale);
      planet.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      planet.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true; object.receiveShadow = true;
        object.geometry.computeVertexNormals();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.flatShading = false;
          material.roughness = Math.max(material.roughness, .72);
          material.needsUpdate = true;
        }
      });
      this.planetRoot.add(planet);
    } catch (error) {
      console.warn('Stylized Mars load failed', error);
      this.planetRoot.add(new THREE.Mesh(new THREE.SphereGeometry(this.mapRadius, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9d4f38, roughness: .92, flatShading: true })));
    }
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

  private mapPosition(discovery: Discovery) {
    const lon = (discovery.position[0] / 12) * .88;
    const lat = (discovery.position[2] / 12) * .72;
    return new THREE.Vector3(
      Math.sin(lon) * Math.cos(lat) * (this.mapRadius + .05),
      Math.sin(lat) * (this.mapRadius + .05),
      Math.cos(lon) * Math.cos(lat) * (this.mapRadius + .05),
    );
  }

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
      // the GLB is a single static mesh: give it a skeleton so the limbs can walk (see astronaut.ts)
      const bodyMesh = this.astronautModel.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;
      this.astronautRig = bodyMesh ? rigAstronaut(bodyMesh) : null;
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
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.48, .018, 8, 32), new THREE.MeshBasicMaterial({ color: discovery.world === 'moon' ? 0xd9ff4f : 0xff9a69, transparent: true, opacity: .82 })); halo.rotation.x = Math.PI / 2; halo.position.y = .04;
    group.add(beacon, halo);
    this.worldSpin.add(group); this.artifacts.set(discovery.id, group);
    try {
      const gltf = await this.loader.loadAsync(discovery.model);
      const craft = gltf.scene; const bounds = new THREE.Box3().setFromObject(craft); const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3()); const scale = 1.55 / (Math.max(size.x, size.y, size.z) || 1);
      craft.scale.setScalar(scale); craft.position.set(-center.x * scale, -center.y * scale + .12, -center.z * scale); craft.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      group.add(craft);
    } catch { const marker = new THREE.Mesh(new THREE.ConeGeometry(.42, .9, 6), new THREE.MeshStandardMaterial({ color: discovery.world === 'moon' ? 0xb9913e : 0xb95c3b, roughness: .8 })); marker.position.y = .45; group.add(marker); }
  }

  changeWorld(world: ExpeditionWorld) {
    this.astronautRig = null; this.world = world; this.popupOpen = false; this.nearby = null; this.artifacts.clear();
    this.frame = startFrame(); this.camera.up.set(0, 1, 0); this.lastTangent.set(0, 1, 0);
    while (this.scene.children.length > 3) this.scene.remove(this.scene.children[this.scene.children.length - 1]);
    this.makeTerrain(world); void this.makeAstronaut();
    discoveries.filter((item) => item.world === world).forEach((item) => void this.addArtifact(item));
    document.body.classList.toggle('expedition-mars', world === 'mars');
    document.querySelectorAll<HTMLButtonElement>('[data-expedition-world]').forEach((button) => { const active = button.dataset.expeditionWorld === world; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    document.querySelector('#game-world-label')!.textContent = world === 'moon' ? 'MOON / TRANQUILITY BASE' : 'MARS / JEZERO CRATER';
    setText('#mission-brief', world === 'moon' ? 'Tranquility Base is scattered with the hardware of the first human landing. Find the three descent stages hidden in the dust.' : 'Jezero Crater is a living archive. Find the Viking lander and Perseverance rover, then read their final and current signals.');
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
    // Screen-space controls: W / S = up / down the screen, D / A = right / left (x = right, y = up).
    let ix = 0, iy = 0;
    if (!this.popupOpen) {
      if (this.keys.has('d') || this.keys.has('arrowright')) ix += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) ix -= 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) iy += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) iy -= 1;
    }
    this.isWalking = ix !== 0 || iy !== 0;
    // Walk along a great circle: works everywhere on the sphere, including straight over the poles (no latitude clamp, no wall).
    const motion = walk(this.frame, ix, iy, (delta * 3.1) / this.mapRadius);
    const normal = this.frame.pos;
    // The astronaut faces opposite to its walking direction in this model's calibrated convention (unchanged from before).
    const tangent = motion ? motion.negate() : this.lastTangent;
    if (motion) {
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
    this.astronautRig?.update(this.walkPhase, this.isWalking, delta);

    // Orbit around the globe's center rather than chasing the player's origin. The camera's up vector follows the player's
    // screen-up direction (instead of world +Y, which is undefined at the poles), eased like the position.
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    const cameraPosition = normal.clone().multiplyScalar(this.mapRadius + 15).addScaledVector(this.frame.up, 3.8);
    this.camera.position.lerp(cameraPosition, .1);
    this.camera.up.lerp(this.frame.up, .1).normalize();
    this.camera.lookAt(cameraTarget);
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
  }

  private inspectNearby() {
    if (!this.nearby || this.popupOpen) return;
    const item = this.nearby; this.popupOpen = true;
    const saved = this.discovered[this.world]; if (!saved.includes(item.id)) { saved.push(item.id); localStorage.setItem(keyFor(this.world), JSON.stringify(saved)); }
    (document.querySelector('#popup-image') as HTMLImageElement).src = item.lastImage;
    document.querySelector('#popup-title')!.textContent = item.name;
    document.querySelector('#popup-description')!.textContent = `${item.lastMessage} This signal is attached to the ${item.type.toLowerCase()} record from ${item.year}.`;
    document.querySelector('#popup-coordinates')!.textContent = item.coordinates;
    document.querySelector('#popup-status')!.textContent = item.status;
    document.querySelector('#game-popup')!.classList.remove('hidden');
    document.querySelector('#interact-button')!.classList.add('hidden');
    this.updateAchievements();
  }

  /** Read-only state for tests/debugging (degrees). */
  debug() { return { world: this.world, ...latLonDeg(this.frame), pos: this.frame.pos.toArray(), up: this.frame.up.toArray(), nearby: this.nearby?.id ?? null, popupOpen: this.popupOpen }; }

  private closePopup() { this.popupOpen = false; document.querySelector('#game-popup')!.classList.add('hidden'); this.checkNearby(); }

  private updateAchievements() {
    for (const world of ['moon', 'mars'] as ExpeditionWorld[]) { try { this.discovered[world] = JSON.parse(localStorage.getItem(keyFor(world)) || '[]'); } catch { this.discovered[world] = []; } }
    const current = discoveries.filter((item) => item.world === this.world); const found = this.discovered[this.world];
    setHtml('#achievement-list', current.map((item) => { const isFound = found.includes(item.id); return `<div class="achievement ${isFound ? 'found' : ''}"><span class="achievement-icon">${isFound ? '✓' : '·'}</span><div><strong>${item.name}</strong><small>${isFound ? 'signal recovered' : 'not yet located'}</small></div></div>`; }).join(''));
    setText('#discover-count', `${found.length} / ${current.length} artifacts discovered`);
  }

  private resize() { const rect = this.canvas.getBoundingClientRect(); const width = Math.max(rect.width, 320); const height = Math.max(rect.height, 420); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
  private animate = () => { this.animationFrame = requestAnimationFrame(this.animate); const delta = Math.min(this.clock.getDelta(), .05); this.updatePlayer(delta); for (const group of this.artifacts.values()) { group.children[1]?.rotation && (group.children[1].rotation.z += delta * .55); if (group.children[0]) group.children[0].position.y = .85 + Math.sin(performance.now() * .002 + group.position.x) * .12; } this.renderer.render(this.scene, this.camera); };
}

export function mountExpedition(root: HTMLElement) {
  root.innerHTML = expeditionShell();
  const game = new ExpeditionGame(document.querySelector<HTMLCanvasElement>('#expedition-canvas')!);
  return game;
}
