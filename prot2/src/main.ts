import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mountExpedition } from './expedition';
import './style.css';

type Body = 'moon' | 'mars' | 'deep';

type Mission = {
  id: string;
  year: string;
  name: string;
  title: string;
  label: string;
  modelPath: string;
  modelSource: string;
  landing: string;
  status: string;
  purpose: string;
  significance: string;
  description: string;
  location: string;
  specs: string;
  dateLabel?: string;
  sourceUrl?: string;
};

const missions: Record<Body, Mission[]> = {
  moon: [
    {
      id: 'apollo-11', year: '1969', name: 'Apollo 11', title: 'Apollo Lunar Module', label: 'THE FIRST FOOTPRINT', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '20 Jul 1969', status: 'Permanently parked', purpose: 'Crewed lunar landing', significance: 'The descent stage of Eagle remains at Tranquility Base as a physical marker of the first crewed landing.', description: 'A landing is not an ending. The descent stage of Eagle stayed at Tranquility Base — a machine built to leave, now holding its place as a quiet witness to the first step.', location: 'Tranquility Base · 0.674° N, 23.473° E', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-12', year: '1969', name: 'Apollo 12', title: 'Intrepid descent stage', label: 'PRECISION LANDING', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '19 Nov 1969', status: 'Permanently parked', purpose: 'Precision landing & science', significance: 'Intrepid landed near the Surveyor 3 probe, extending the record of human hardware left on the lunar surface.', description: 'The archive is layered. Near Oceanus Procellarum, Intrepid joined a previous machine — a reminder that every mission arrives at a site already carrying history.', location: 'Oceanus Procellarum · 3.012° S, 23.421° W', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-14', year: '1971', name: 'Apollo 14', title: 'Antares descent stage', label: 'FRA MAURO SAMPLE RUN', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '5 Feb 1971', status: 'Permanently parked', purpose: 'Geology & sample return', significance: 'Antares carried the Apollo 14 crew to the Fra Mauro highlands, where they collected material from the Moon’s ancient impact history.', description: 'The Moon’s surface became a field laboratory. Antares remains as the landing hardware behind one of Apollo’s most geologically important traverses.', location: 'Fra Mauro · 3.645° S, 17.471° W', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-15', year: '1971', name: 'Apollo 15', title: 'Falcon descent stage', label: 'THE FIRST ROVER', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '30 Jul 1971', status: 'Permanently parked', purpose: 'Hadley-Apennine geology', significance: 'Falcon supported the first Apollo mission with the Lunar Roving Vehicle and a longer-range scientific traverse.', description: 'A descent stage became a base camp for wheels. Apollo 15 turned the landing site into a route through mountains, rilles, and deep-time geology.', location: 'Hadley–Apennine · 26.132° N, 3.634° E', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-16', year: '1972', name: 'Apollo 16', title: 'Orion descent stage', label: 'HIGHLANDS GEOLOGY', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '21 Apr 1972', status: 'Permanently parked', purpose: 'Lunar highlands science', significance: 'Orion brought Apollo 16 to the Descartes Highlands to investigate terrain older than most of the lunar maria.', description: 'The hardware stayed, but the geological record traveled home. Orion marks a landing made to read the Moon’s oldest exposed pages.', location: 'Descartes Highlands · 8.973° S, 15.501° E', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-17', year: '1972', name: 'Apollo 17', title: 'Challenger descent stage', label: 'LAST CREWED LANDING', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '11 Dec 1972', status: 'Permanently parked', purpose: 'Geology & surface mobility', significance: 'Challenger is the last crewed lunar lander to touch down, and its descent stage still stands in Taurus-Littrow Valley.', description: 'The last crewed Apollo descent stage is also a time capsule. It sits within a valley where geology, engineering, and the human urge to explore meet in the same frame.', location: 'Taurus-Littrow · 20.190° N, 30.772° E', specs: 'NASA 3D Resources generic Apollo LM model'
    },
    {
      id: 'apollo-saturn-v', year: '1969', name: 'Apollo 11 / Saturn V', title: 'Saturn V launch vehicle', label: 'THE VEHICLE THAT LEFT EARTH', modelPath: '/models/saturn-v.glb', modelSource: 'NASA 3D Resources · Saturn V', landing: '16 Jul 1969', status: 'Retired launch vehicle', purpose: 'Translunar launch', significance: 'Saturn V supplied the energy that carried Apollo hardware and crew from Earth to lunar orbit.', description: 'Before the landing, there was the climb. Saturn V turned a stack of stages into a trajectory toward the Moon and made the archive possible.', location: 'Kennedy Space Center · 28.608° N, 80.604° W', specs: 'Launch vehicle for Apollo crewed lunar flights'
    },
    {
      id: 'apollo-soyuz', year: '1975', name: 'Apollo-Soyuz', title: 'Apollo-Soyuz spacecraft', label: 'THE FIRST HANDSHAKE', modelPath: '/models/apollo-soyuz.glb', modelSource: 'NASA 3D Resources · Apollo Soyuz', landing: '15 Jul 1975', status: 'Historic spacecraft', purpose: 'Orbital rendezvous', significance: 'The Apollo-Soyuz Test Project joined American and Soviet spacecraft in orbit and created a lasting symbol of cooperation.', description: 'Not every Apollo story ends on the Moon. Apollo-Soyuz left behind a different kind of evidence: a docking interface built for two nations to meet.', location: 'Low Earth orbit · 51.8° inclination', specs: 'Joint US–Soviet orbital docking mission'
    }
  ],
  mars: [
    {
      id: 'viking-1', year: '1976', name: 'Viking 1', title: 'Viking Lander', label: 'THE FIRST SOFT TOUCH', modelPath: '/models/viking-lander.glb', modelSource: 'NASA 3D Resources · Viking Lander', landing: '20 Jul 1976', status: 'Silent since 1982', purpose: 'Search for microbial life', significance: 'Viking 1 was the first spacecraft to successfully land on Mars and return long-term surface science.', description: 'The first successful Mars lander became part of the terrain it studied. Its sample arms, cameras, and biology experiments are now a fixed point in Chryse Planitia.', location: 'Chryse Planitia · 22.483° N, 47.94° W', specs: 'Lander + orbiter mission; lander silent since 11 Nov 1982'
    },
    {
      id: 'perseverance', year: '2021', name: 'Mars 2020', title: 'Perseverance Rover', label: 'THE SAMPLE ARCHIVE', modelPath: '/models/perseverance-rover.glb', modelSource: 'NASA 3D Resources · Mars 2020 Perseverance Rover', landing: '18 Feb 2021', status: 'Active mission', purpose: 'Ancient life & sample caching', significance: 'Perseverance is still driving across Jezero Crater, turning the surface into a carefully catalogued archive for future science.', description: 'Not every artifact is abandoned yet. Perseverance is writing its own future archive — leaving sample tubes, wheel tracks, and a route that another mission may one day retrace.', location: 'Jezero Crater · 18.444° N, 77.450° E', specs: 'Landed 18 Feb 2021 · carried the Ingenuity helicopter'
    },
    {
      id: 'ingenuity', year: '2021', name: 'Ingenuity', title: 'Ingenuity Mars Helicopter', label: 'THE FIRST FLIGHT', modelPath: '/models/ingenuity.glb', modelSource: 'NASA 3D Resources · Ingenuity Mars Helicopter', landing: '18 Feb 2021', status: 'Mission completed 25 Jan 2024', purpose: 'First powered flight on another planet', significance: 'Ingenuity flew 72 times, covering about 17 km in roughly 128.8 minutes of flight, far beyond its original plan of no more than five test flights.', description: 'It was built as a short experiment and became a scout. When its flying days ended, the helicopter stayed behind in Jezero Crater, a small machine that proved aircraft can work on another world.', location: 'Jezero Crater', specs: '1.8 kg · 1.2 m rotor span · 72 flights', sourceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/'
    }
  ],
  deep: [
    {
      id: 'pioneer-10', year: '1972', name: 'Pioneer 10', title: 'Pioneer 10', label: 'LEAVING THE SOLAR SYSTEM', modelPath: '/models/pioneer-10.glb', modelSource: 'NASA 3D Resources · Pioneer 10', landing: '2 Mar 1972', dateLabel: 'Launch', status: 'Inert · last signal 23 Jan 2003', purpose: 'Jupiter flyby', significance: 'Pioneer 10 was the first spacecraft placed on a trajectory to escape the solar system and the first to fly past Jupiter.', description: 'Designed for a 21-month mission, it kept going for more than 30 years. Its last signal came from about 7.6 billion miles away, and it carries an aluminum plaque showing a man, a woman and the Sun’s position among 14 pulsars.', location: 'Outbound from the Sun', specs: '258 kg · 11 instruments · Atlas Centaur launch', sourceUrl: 'https://science.nasa.gov/mission/pioneer-10/'
    },
    {
      id: 'near-shoemaker', year: '1996', name: 'NEAR Shoemaker', title: 'NEAR Shoemaker', label: 'THE UNPLANNED LANDING', modelPath: '/models/near-shoemaker.glb', modelSource: 'NASA 3D Resources · NEAR Shoemaker', landing: '17 Feb 1996', dateLabel: 'Launch', status: 'Complete · last contact 28 Feb 2001', purpose: 'Orbit and land on asteroid 433 Eros', significance: 'NEAR was the first spacecraft to orbit an asteroid and the first to land on one, touching down on Eros on 12 Feb 2001.', description: 'It was never designed to land, yet it survived a gentle touchdown at about 6.4 km/h and kept sending data from the surface for roughly two weeks before the cold silenced it.', location: 'Asteroid 433 Eros', specs: '805 kg · first Discovery Program mission', sourceUrl: 'https://science.nasa.gov/mission/near-shoemaker/'
    },
    {
      id: 'dawn', year: '2007', name: 'Dawn', title: 'Dawn', label: 'TWO WORLDS, ONE SPACECRAFT', modelPath: '/models/dawn.glb', modelSource: 'NASA 3D Resources · Dawn', landing: '27 Sep 2007', dateLabel: 'Launch', status: 'Mission page status: Successful', purpose: 'Orbit Vesta and Ceres', significance: 'NASA describes Dawn as its first truly interplanetary spaceship, with extended stays at two different bodies in the main asteroid belt.', description: 'Most missions visit one place. Dawn stayed with a giant asteroid and then a dwarf planet, leaving a record of the asteroid belt written from orbit.', location: 'Main asteroid belt', specs: 'Targets: Vesta and Ceres (mass not stated by NASA page)', sourceUrl: 'https://science.nasa.gov/mission/dawn/'
    }
  ]
};

const app = document.querySelector<HTMLDivElement>('#app')!;
let activeBody: Body = 'moon';
let activeMission = missions.moon[0];
let viewer: SpacecraftViewer;
let heroPlanetViewer: HeroPlanetViewer;
let heroSatelliteViewer: HeroSatelliteViewer;

function renderShell() {
  app.innerHTML = `
    <div class="page-shell">
      <nav class="site-nav" aria-label="Primary navigation">
        <a class="brand-lockup" href="#top" aria-label="Lunar Trace home">
          <span class="brand-mark" aria-hidden="true"></span>
          <span><span class="brand-word">LUNAR TRACE</span><span class="brand-sub"> / SURFACE ARCHIVE</span></span>
        </a>
        <div class="nav-meta">
          <a href="#archive">Explore archive</a>
          <a href="/expedition">Play expedition</a>
          <span class="nav-status"><i class="status-dot" aria-hidden="true"></i>Signal live</span>
        </div>
      </nav>

      <main id="top">
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <span class="eyebrow">NASA SPACE APPS / 2026</span>
            <h1 id="hero-title">What we <em>leave</em> behind.</h1>
            <p class="hero-lede">Every landing writes a second story. Explore the machines, instruments, tracks, and quiet hardware that remain after the signal fades — from the Moon to Mars.</p>
            <div class="hero-actions">
              <a class="primary-button" href="#archive">Enter the archive <span class="arrow">↘</span></a>
              <a class="ghost-button" href="/expedition">Play surface expedition <span class="arrow">↗</span></a>
              <button class="ghost-button" id="hero-body-toggle" type="button">Switch to Mars <span class="arrow">↗</span></button>
            </div>
            <div class="hero-index" aria-label="Archive summary">
              <div><strong>03</strong>zones logged</div>
              <div><strong>14</strong>NASA 3D models</div>
              <div><strong>∞</strong>stories in the dust</div>
            </div>
          </div>
          <div class="hero-orbit" aria-hidden="true">
            <div class="orbit-label">Live surface index / 001</div>
            <canvas id="hero-planet-canvas" aria-label="Textured 3D Moon or Mars globe"></canvas>
            <canvas id="hero-satellite-canvas" aria-label="NASA satellite 3D model"></canvas>
            <div class="orbit-code"><span id="hero-body-code">LUNA // 01</span>12.4 million km from home<br />archive status: transmitting</div>
          </div>
        </section>

        <section class="archive" id="archive" aria-labelledby="archive-title">
          <div class="section-kicker">
            <h2 id="archive-title">The surface is the <span>archive.</span></h2>
            <p>01 / Select a world · 02 / Select a mission · 03 / Turn the machine</p>
          </div>
          <div class="archive-layout" id="archive-layout">
            <aside class="archive-rail" aria-label="Archive navigation">
              <div>
                <div class="body-toggle" role="group" aria-label="Select celestial body">
                  <button type="button" data-body="moon" class="active" aria-pressed="true">Moon</button>
                  <button type="button" data-body="mars" aria-pressed="false">Mars</button>
                  <button type="button" data-body="deep" aria-pressed="false">Deep space</button>
                </div>
                <div class="rail-note" id="rail-note"><b>Field note / 001</b>Machines don’t disappear when their missions end. Their locations become coordinates in a longer human story.</div>
              </div>
              <div class="mission-list" id="mission-list" aria-label="Mission records"></div>
            </aside>

            <div class="explorer" id="explorer">
              <div class="explorer-topline"><span>Selected record / <strong id="record-id">APOLLO-11</strong></span><span id="record-coordinates">TRNQ BASE / 00.674° N</span></div>
              <div class="viewer-card" id="viewer-card">
                <canvas id="model-canvas" aria-label="Interactive 3D model viewer. Drag to rotate and scroll to zoom."></canvas>
                <div class="viewer-hud" aria-hidden="true">
                  <div class="hud-top-left"><strong id="hud-label">THE FIRST FOOTPRINT</strong><span id="hud-model">APOLLO LUNAR MODULE</span><span class="hud-muted">NASA / GLB ASSET / VERIFIED</span></div>
                  <div class="hud-top-right"><span>FRAME 001 — <span id="hud-body">LUNAR SURFACE</span></span><span class="hud-muted">ROTATE / ZOOM / INSPECT</span></div>
                  <div class="hud-bottom-left"><span id="hud-mission">APOLLO 11 · 1969</span><span class="hud-muted">SURFACE SIGNAL: ARCHIVED</span></div>
                  <span class="crosshair"></span>
                </div>
                <div class="viewer-controls" aria-label="3D model controls">
                  <button class="control-button" id="zoom-out" type="button" aria-label="Zoom out">−</button>
                  <button class="control-button" id="zoom-in" type="button" aria-label="Zoom in">+</button>
                  <button class="control-button" id="reset-view" type="button" aria-label="Reset model view">⌂</button>
                  <button class="control-button" id="auto-rotate" type="button" aria-label="Toggle auto rotate" aria-pressed="false">↻</button>
                  <button class="control-button" id="parts-toggle" type="button" aria-label="Toggle spacecraft part labels" aria-pressed="false">⌖</button>
                </div>
                <div class="part-labels" id="part-labels" aria-live="polite" aria-label="Spacecraft part labels"></div>
              </div>
              <div class="model-source"><span id="model-source-label">Real spacecraft model · NASA 3D Resources</span><a id="model-source-link" href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noreferrer">View source ↗</a></div>
              <article class="story-panel" aria-live="polite">
                <div class="story-panel-grid">
                  <div><span class="story-label" id="story-label">THE FIRST FOOTPRINT</span><h3 id="story-title">Apollo Lunar Module</h3><p id="story-description">A landing is not an ending. The descent stage of Eagle stayed at Tranquility Base — a machine built to leave, now holding its place as a quiet witness to the first step.</p><p class="story-significance"><span>Why it matters</span><strong id="story-significance">The descent stage of Eagle remains at Tranquility Base as a physical marker of the first crewed landing.</strong></p></div>
                  <div class="story-facts">
                    <div class="fact"><span>Landing</span><strong id="fact-landing">20 Jul 1969</strong></div>
                    <div class="fact"><span>Status</span><strong id="fact-status">Permanently parked</strong></div>
                    <div class="fact"><span>Purpose</span><strong id="fact-purpose">Crewed lunar landing</strong></div>
                    <div class="fact"><span>Site</span><strong id="fact-location">Tranquility Base</strong></div>
                    <div class="fact"><span>Key specs</span><strong id="fact-specs"></strong></div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="timeline" id="timeline" aria-labelledby="timeline-title">
          <div class="section-kicker"><h2 id="timeline-title">Fifty-five years of <span>leftovers.</span></h2><p>Every record in the archive, sorted by launch. Select one to open it in the viewer.</p></div>
          <ol class="timeline-list" id="timeline-list"></ol>
        </section>

        <section class="footprint" aria-labelledby="footprint-title">
          <div class="footprint-grid">
            <div><span class="eyebrow">A DIFFERENT KIND OF MISSION LOG</span><h2 id="footprint-title">A footprint is a <span>signal.</span></h2></div>
            <div><p class="footprint-copy">The challenge is not only to remember the landing. It is to notice the residue: hardware that became habitat, experiments that became evidence, and routes that became maps for whoever comes next.</p><div class="signal-list"><div class="signal-row"><span>Moon / 1969—72</span><strong>Descent stages, science packages, rovers, tracks.</strong></div><div class="signal-row"><span>Mars / 1976—now</span><strong>Landers, wheels, drill holes, sample tubes.</strong></div><div class="signal-row"><span>Next / unknown</span><strong>Every artifact is a message for another mission.</strong></div></div></div>
          </div>
        </section>
      </main>

      <footer><div>Built for NASA Space Apps / Discarded Equipment Storytelling</div><div>3D models and mission facts: <a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noreferrer">NASA 3D Resources</a> and <a href="https://science.nasa.gov/missions/" target="_blank" rel="noreferrer">NASA Science</a>. NASA content is used with credit; this project is not endorsed by NASA. Interface concept: Lunar Trace. See <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noreferrer">NASA-3D-Resources</a> for model sources.</div></footer>
    </div>
  `;
}

class SpacecraftViewer {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private loader = new GLTFLoader();
  private modelGroup = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private autoRotate = false;
  private animationFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .78;
    this.renderer.shadowMap.enabled = true;
    this.scene.add(this.modelGroup);
    this.camera.position.set(3.9, 2.35, 4.1);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .07;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 8.5;
    this.controls.target.set(0, .25, 0);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(dracoLoader);
    this.setupLights();
    this.setupBackdrop();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xbdd6ff, 0x171319, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.PointLight(0xb3ff6e, 5.5, 10);
    rim.position.set(-4, 1.8, -2);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0x7d8dff, 3.8, 12);
    fill.position.set(3, -1, -4);
    this.scene.add(fill);
  }

  private setupBackdrop() {
    const grid = new THREE.GridHelper(18, 18, 0x50565f, 0x252a31);
    grid.position.y = -1.2;
    grid.material.transparent = true;
    grid.material.opacity = .3;
    this.scene.add(grid);
    const stars = new THREE.BufferGeometry();
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - .5) * 22;
      positions[i + 1] = (Math.random() - .2) * 14;
      positions[i + 2] = (Math.random() - .5) * 18;
    }
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xc7d1dc, size: .018, transparent: true, opacity: .55 })));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 320);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  async load(path: string) {
    this.modelGroup.clear();
    this.model = null;
    try {
      const gltf = await this.loader.loadAsync(path);
      this.model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(this.model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.65 / maxSize;
      this.model.scale.setScalar(scale);
      this.model.position.set(-center.x * scale, -center.y * scale + .18, -center.z * scale);
      this.model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          const material = object.material as THREE.MeshStandardMaterial;
        }
      });
      this.modelGroup.add(this.model);
      this.reset();
    } catch (error) {
      console.error('Model load failed', error);
      this.addFallbackModel();
    }
  }

  private addFallbackModel() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, .72, 1.1), new THREE.MeshStandardMaterial({ color: 0xb8b9b2, metalness: .6, roughness: .38 }));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.15, 12), new THREE.MeshStandardMaterial({ color: 0x85877f, metalness: .5 }));
    mast.position.y = .82;
    const group = new THREE.Group();
    group.add(base, mast);
    this.modelGroup.add(group);
  }

  zoom(delta: number) {
    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    this.camera.position.addScaledVector(direction, delta);
    const distance = this.camera.position.distanceTo(this.controls.target);
    if (distance < this.controls.minDistance) this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(this.controls.minDistance));
    if (distance > this.controls.maxDistance) this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(this.controls.maxDistance));
  }

  reset() {
    this.camera.position.set(3.9, 2.35, 4.1);
    this.controls.target.set(0, .25, 0);
    this.controls.update();
    this.modelGroup.rotation.set(0, -.35, 0);
  }

  setAutoRotate(value: boolean) { this.autoRotate = value; }

  private animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    if (this.autoRotate) this.modelGroup.rotation.y += .004;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.renderer.dispose();
    this.controls.dispose();
  }
}

class HeroPlanetViewer {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, .1, 20);
  private renderer: THREE.WebGLRenderer;
  private globe: THREE.Mesh;
  private textureLoader = new THREE.TextureLoader();
  private body: Body = 'moon';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera.position.set(0, .15, 4.2);
    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x11141a, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(-3, 3, 4); this.scene.add(key);
    const rim = new THREE.PointLight(0xb4ff6a, 3.5, 8); rim.position.set(2, -1, -3); this.scene.add(rim);
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1.35, 96, 64), new THREE.MeshStandardMaterial({ roughness: .96 }));
    this.scene.add(this.globe);
    this.setBody('moon');
    this.resize(); window.addEventListener('resize', () => this.resize()); this.animate();
  }

  setBody(body: Body) {
    this.body = body;
    const texture = this.textureLoader.load(body === 'moon' ? '/textures/moon-lroc-color-2k.jpg' : '/textures/mars-nasa.jpg');
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const material = this.globe.material as THREE.MeshStandardMaterial;
    material.map = texture; material.color.set(body === 'moon' ? 0xc5c1b7 : 0xb96548); material.needsUpdate = true;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect(); const width = Math.max(rect.width, 220); const height = Math.max(rect.height, 220);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
  }

  private animate = () => { requestAnimationFrame(this.animate); this.globe.rotation.y += this.body === 'moon' ? .0014 : .0018; this.renderer.render(this.scene, this.camera); };
}

class HeroSatelliteViewer {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
  private renderer: THREE.WebGLRenderer;
  private group = new THREE.Group();
  private loader = new GLTFLoader();
  private satellite = new THREE.Group();
  private orbitPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.camera.position.set(0, .2, 4.2); this.scene.add(new THREE.HemisphereLight(0xdce7ff, 0x13151c, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 4, 4); this.scene.add(key); this.scene.add(this.group);
    this.load(); this.resize(); window.addEventListener('resize', () => this.resize()); this.animate();
  }

  private async load() {
    try {
      const gltf = await this.loader.loadAsync('/models/nasa-acrimsat.glb');
      const model = gltf.scene; const bounds = new THREE.Box3().setFromObject(model); const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.15 / (Math.max(size.x, size.y, size.z) || 1); model.scale.setScalar(scale); model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      model.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      this.satellite.add(model); this.group.add(this.satellite);
    } catch (error) { console.warn('Satellite load failed', error); }
  }

  private resize() { const rect = this.canvas.getBoundingClientRect(); const width = Math.max(rect.width, 80); const height = Math.max(rect.height, 80); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
  private animate = () => { requestAnimationFrame(this.animate); this.orbitPhase += .012; this.group.position.set(Math.cos(this.orbitPhase) * .08, Math.sin(this.orbitPhase * .7) * .08, 0); this.satellite.rotation.y += .008; this.satellite.rotation.z = Math.sin(this.orbitPhase) * .12; this.renderer.render(this.scene, this.camera); };
}

function updateMissionList() {
  const list = document.querySelector<HTMLDivElement>('#mission-list')!;
  list.innerHTML = missions[activeBody].map((mission) => `<button type="button" class="${mission.id === activeMission.id ? 'active' : ''}" data-mission="${mission.id}" aria-pressed="${mission.id === activeMission.id}"><span class="mission-year">${mission.year}</span><span class="mission-name">${mission.name}</span></button>`).join('');
  list.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach((button) => button.addEventListener('click', () => {
    const selected = missions[activeBody].find((mission) => mission.id === button.dataset.mission);
    if (selected) setMission(selected);
  }));
}

function setBody(body: Body) {
  activeBody = body;
  activeMission = missions[body][body === 'mars' ? 1 : 0];
  document.body.classList.toggle('mars-mode', body === 'mars');
  document.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((button) => {
    const active = button.dataset.body === body;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector<HTMLCanvasElement>('#hero-planet-canvas')?.classList.toggle('is-mars', body === 'mars');
  if (body !== 'deep') heroPlanetViewer?.setBody(body);
  document.querySelector<HTMLButtonElement>('#hero-body-toggle')!.innerHTML = body === 'moon' ? 'Switch to Mars <span class="arrow">↗</span>' : 'Switch to Moon <span class="arrow">↗</span>';
  if (body !== 'deep') document.querySelector('#hero-body-code')!.textContent = body === 'moon' ? 'LUNA // 01' : 'MARS // 02';
  document.querySelector('#rail-note')!.innerHTML = body === 'deep' ? '<b>Field note / 003</b>Some machines never land. Pioneer, NEAR and Dawn left their marks as trajectories, orbits and one unplanned touchdown.' : body === 'moon' ? '<b>Field note / 001</b>Machines don’t disappear when their missions end. Their locations become coordinates in a longer human story.' : '<b>Field note / 002</b>Mars keeps the long record: landers, wheels, drill holes, sample tubes, and the first routes across another world.';
  updateMissionList();
  setMission(activeMission);
}

function setMission(mission: Mission) {
  activeMission = mission;
  document.querySelector('#record-id')!.textContent = mission.id.toUpperCase();
  document.querySelector('#record-coordinates')!.textContent = mission.location.split(' · ')[0].toUpperCase();
  document.querySelector('#hud-label')!.textContent = mission.label;
  document.querySelector('#hud-model')!.textContent = mission.title.toUpperCase();
  document.querySelector('#hud-body')!.textContent = activeBody === 'moon' ? 'LUNAR SURFACE' : activeBody === 'mars' ? 'MARTIAN SURFACE' : 'DEEP SPACE';
  document.querySelector('#hud-mission')!.textContent = `${mission.name.toUpperCase()} · ${mission.year}`;
  document.querySelector('#story-label')!.textContent = mission.label;
  document.querySelector('#story-title')!.textContent = mission.title;
  document.querySelector('#story-description')!.textContent = mission.description;
  document.querySelector('#story-significance')!.textContent = mission.significance;
  document.querySelector('#fact-landing')!.textContent = mission.landing;
  const dateLabel = document.querySelector('#fact-landing')!.previousElementSibling; if (dateLabel) dateLabel.textContent = mission.dateLabel ?? 'Landing';
  document.querySelector('#fact-specs')!.textContent = mission.specs;
  document.querySelector('#fact-status')!.textContent = mission.status;
  document.querySelector('#fact-purpose')!.textContent = mission.purpose;
  document.querySelector('#fact-location')!.textContent = mission.location.split(' · ')[0];
  document.querySelector('#model-source-label')!.textContent = `Real spacecraft model · ${mission.modelSource}`;
  const link = document.querySelector<HTMLAnchorElement>('#model-source-link'); if (link) { link.href = mission.sourceUrl ?? 'https://github.com/nasa/NASA-3D-Resources'; link.textContent = mission.sourceUrl ? 'Mission page ↗' : 'View source ↗'; }
  setPartLabels(mission);
  updateMissionList();
  void viewer.load(mission.modelPath);
}

function setPartLabels(mission: Mission) {
  const unmapped = ['ingenuity', 'pioneer-10', 'near-shoemaker', 'dawn'];
  const labels = unmapped.includes(mission.id) ? [] : mission.title.includes('Perseverance')
    ? [['Mastcam-Z camera', 'right', '27%', '18%'], ['Robotic arm', 'left', '18%', '55%'], ['Wheel / rocker-bogie', 'right', '67%', '68%'], ['Sample caching body', 'left', '21%', '35%']]
    : mission.title.includes('Viking')
      ? [['High-gain antenna', 'right', '68%', '18%'], ['Sampler arm', 'left', '17%', '54%'], ['Lander deck', 'right', '67%', '45%'], ['Footpad', 'left', '23%', '72%']]
      : mission.title.includes('Saturn V')
        ? [['Command module', 'right', '68%', '18%'], ['Second stage', 'left', '18%', '40%'], ['First stage', 'right', '70%', '63%'], ['Engine cluster', 'left', '23%', '76%']]
        : mission.title.includes('Apollo-Soyuz')
          ? [['Docking module', 'right', '68%', '18%'], ['Apollo module', 'left', '18%', '40%'], ['Solar array', 'right', '70%', '63%'], ['Service module', 'left', '23%', '76%']]
          : [['Ascent stage', 'right', '68%', '18%'], ['Thermal blanket', 'left', '18%', '40%'], ['Landing leg', 'right', '70%', '63%'], ['Footpad', 'left', '23%', '76%']];
  const container = document.querySelector<HTMLDivElement>('#part-labels');
  if (!container) return;
  container.innerHTML = labels.map(([label, side, top, horizontal]) => `<span class="part-label ${side === 'left' ? 'left' : 'right'} ${activeBody === 'mars' ? 'mars-part' : ''}" style="top:${top};${side === 'left' ? 'left' : 'right'}:${horizontal}">${label}</span>`).join('');
}

function renderTimeline() {
  const all = (Object.keys(missions) as Body[]).flatMap((body) => missions[body].map((mission) => ({ body, mission })));
  const launchYear = (item: { mission: Mission }) => Number(item.mission.year);
  all.sort((a, b) => launchYear(a) - launchYear(b));
  const zone: Record<Body, string> = { moon: 'Moon', mars: 'Mars', deep: 'Deep space' };
  const list = document.querySelector<HTMLOListElement>('#timeline-list');
  if (!list) return;
  list.innerHTML = all.map(({ body, mission }) => `<li><button type="button" data-timeline-body="${body}" data-timeline-mission="${mission.id}"><span class="mission-year">${mission.year}</span><span class="mission-name">${mission.name}</span><span class="timeline-zone">${zone[body]}</span></button></li>`).join('');
  list.querySelectorAll<HTMLButtonElement>('[data-timeline-mission]').forEach((button) => button.addEventListener('click', () => {
    const body = button.dataset.timelineBody as Body;
    if (body !== activeBody) setBody(body);
    const selected = missions[body].find((mission) => mission.id === button.dataset.timelineMission);
    if (selected) setMission(selected);
    document.querySelector('#archive')?.scrollIntoView({ behavior: 'smooth' });
  }));
}

function bindUI() {
  document.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((button) => button.addEventListener('click', () => setBody(button.dataset.body as Body)));
  document.querySelector<HTMLButtonElement>('#hero-body-toggle')!.addEventListener('click', () => setBody(activeBody === 'moon' ? 'mars' : 'moon'));
  document.querySelector<HTMLButtonElement>('#zoom-in')!.addEventListener('click', () => viewer.zoom(-.45));
  document.querySelector<HTMLButtonElement>('#zoom-out')!.addEventListener('click', () => viewer.zoom(.45));
  document.querySelector<HTMLButtonElement>('#reset-view')!.addEventListener('click', () => viewer.reset());
  document.querySelector<HTMLButtonElement>('#auto-rotate')!.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('active', active);
    viewer.setAutoRotate(active);
  });
  document.querySelector<HTMLButtonElement>('#parts-toggle')!.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('active', active);
    document.querySelector('#part-labels')?.classList.toggle('is-visible', active);
  });
}

if (window.location.pathname === '/expedition') {
  mountExpedition(app);
} else {
  renderShell();
  heroPlanetViewer = new HeroPlanetViewer(document.querySelector<HTMLCanvasElement>('#hero-planet-canvas')!);
  heroSatelliteViewer = new HeroSatelliteViewer(document.querySelector<HTMLCanvasElement>('#hero-satellite-canvas')!);
  viewer = new SpacecraftViewer(document.querySelector<HTMLCanvasElement>('#model-canvas')!);
  bindUI();
  renderTimeline();
  setMission(activeMission);
}
