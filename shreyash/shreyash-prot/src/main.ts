import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mountExpedition } from './expedition';
import './style.css';

type Body = 'moon' | 'mars';

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
};

const missions: Record<Body, Mission[]> = {
  moon: [
    {
      id: 'apollo-11', year: '1969', name: 'Apollo 11', title: 'Apollo Lunar Module', label: 'THE FIRST FOOTPRINT', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '20 Jul 1969', status: 'Permanently parked', purpose: 'Crewed lunar landing', significance: 'The descent stage of Eagle remains at Tranquility Base as a physical marker of the first crewed landing.', description: 'A landing is not an ending. The descent stage of Eagle stayed at Tranquility Base — a machine built to leave, now holding its place as a quiet witness to the first step.', location: 'Tranquility Base · 0.674° N, 23.473° E'
    },
    {
      id: 'apollo-12', year: '1969', name: 'Apollo 12', title: 'Intrepid descent stage', label: 'PRECISION LANDING', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '19 Nov 1969', status: 'Permanently parked', purpose: 'Precision landing & science', significance: 'Intrepid landed near the Surveyor 3 probe, extending the record of human hardware left on the lunar surface.', description: 'The archive is layered. Near Oceanus Procellarum, Intrepid joined a previous machine — a reminder that every mission arrives at a site already carrying history.', location: 'Oceanus Procellarum · 3.012° S, 23.421° W'
    },
    {
      id: 'apollo-17', year: '1972', name: 'Apollo 17', title: 'Challenger descent stage', label: 'LAST CREWED LANDING', modelPath: '/models/apollo-lunar-module.glb', modelSource: 'NASA 3D Resources · Apollo Lunar Module', landing: '11 Dec 1972', status: 'Permanently parked', purpose: 'Geology & surface mobility', significance: 'Challenger is the last crewed lunar lander to touch down, and its descent stage still stands in Taurus-Littrow Valley.', description: 'The last crewed Apollo descent stage is also a time capsule. It sits within a valley where geology, engineering, and the human urge to explore meet in the same frame.', location: 'Taurus-Littrow · 20.190° N, 30.772° E'
    }
  ],
  mars: [
    {
      id: 'viking-1', year: '1976', name: 'Viking 1', title: 'Viking Lander', label: 'THE FIRST SOFT TOUCH', modelPath: '/models/viking-lander.glb', modelSource: 'NASA 3D Resources · Viking Lander', landing: '20 Jul 1976', status: 'Silent since 1982', purpose: 'Search for microbial life', significance: 'Viking 1 was the first spacecraft to successfully land on Mars and return long-term surface science.', description: 'The first successful Mars lander became part of the terrain it studied. Its sample arms, cameras, and biology experiments are now a fixed point in Chryse Planitia.', location: 'Chryse Planitia · 22.48° N, 47.97° W'
    },
    {
      id: 'perseverance', year: '2021', name: 'Mars 2020', title: 'Perseverance Rover', label: 'THE SAMPLE ARCHIVE', modelPath: '/models/perseverance-rover.glb', modelSource: 'NASA 3D Resources · Mars 2020 Perseverance Rover', landing: '18 Feb 2021', status: 'Active mission', purpose: 'Ancient life & sample caching', significance: 'Perseverance is still driving across Jezero Crater, turning the surface into a carefully catalogued archive for future science.', description: 'Not every artifact is abandoned yet. Perseverance is writing its own future archive — leaving sample tubes, wheel tracks, and a route that another mission may one day retrace.', location: 'Jezero Crater · 18.444° N, 77.450° E'
    }
  ]
};

const app = document.querySelector<HTMLDivElement>('#app')!;
let activeBody: Body = 'moon';
let activeMission = missions.moon[0];
let viewer: SpacecraftViewer;

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
              <div><strong>02</strong>worlds logged</div>
              <div><strong>03</strong>featured models</div>
              <div><strong>∞</strong>stories in the dust</div>
            </div>
          </div>
          <div class="hero-orbit" aria-hidden="true">
            <div class="orbit-label">Live surface index / 001</div>
            <div class="planet" id="hero-planet"></div>
            <div class="orbit-satellite"></div>
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
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="footprint" aria-labelledby="footprint-title">
          <div class="footprint-grid">
            <div><span class="eyebrow">A DIFFERENT KIND OF MISSION LOG</span><h2 id="footprint-title">A footprint is a <span>signal.</span></h2></div>
            <div><p class="footprint-copy">The challenge is not only to remember the landing. It is to notice the residue: hardware that became habitat, experiments that became evidence, and routes that became maps for whoever comes next.</p><div class="signal-list"><div class="signal-row"><span>Moon / 1969—72</span><strong>Descent stages, science packages, rovers, tracks.</strong></div><div class="signal-row"><span>Mars / 1976—now</span><strong>Landers, wheels, drill holes, sample tubes.</strong></div><div class="signal-row"><span>Next / unknown</span><strong>Every artifact is a message for another mission.</strong></div></div></div>
          </div>
        </section>
      </main>

      <footer><div>Built for NASA Space Apps / Discarded Equipment Storytelling</div><div>Models: <a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noreferrer">NASA 3D Resources</a> · Interface concept: Lunar Trace</div></footer>
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
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
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
  activeMission = missions[body][body === 'moon' ? 0 : 1];
  document.body.classList.toggle('mars-mode', body === 'mars');
  document.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((button) => {
    const active = button.dataset.body === body;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const planet = document.querySelector<HTMLDivElement>('#hero-planet')!;
  planet.classList.toggle('is-mars', body === 'mars');
  document.querySelector<HTMLButtonElement>('#hero-body-toggle')!.innerHTML = body === 'moon' ? 'Switch to Mars <span class="arrow">↗</span>' : 'Switch to Moon <span class="arrow">↗</span>';
  document.querySelector('#hero-body-code')!.textContent = body === 'moon' ? 'LUNA // 01' : 'MARS // 02';
  document.querySelector('#rail-note')!.innerHTML = body === 'moon' ? '<b>Field note / 001</b>Machines don’t disappear when their missions end. Their locations become coordinates in a longer human story.' : '<b>Field note / 002</b>Mars keeps the long record: landers, wheels, drill holes, sample tubes, and the first routes across another world.';
  updateMissionList();
  setMission(activeMission);
}

function setMission(mission: Mission) {
  activeMission = mission;
  document.querySelector('#record-id')!.textContent = mission.id.toUpperCase();
  document.querySelector('#record-coordinates')!.textContent = mission.location.split(' · ')[0].toUpperCase();
  document.querySelector('#hud-label')!.textContent = mission.label;
  document.querySelector('#hud-model')!.textContent = mission.title.toUpperCase();
  document.querySelector('#hud-body')!.textContent = activeBody === 'moon' ? 'LUNAR SURFACE' : 'MARTIAN SURFACE';
  document.querySelector('#hud-mission')!.textContent = `${mission.name.toUpperCase()} · ${mission.year}`;
  document.querySelector('#story-label')!.textContent = mission.label;
  document.querySelector('#story-title')!.textContent = mission.title;
  document.querySelector('#story-description')!.textContent = mission.description;
  document.querySelector('#story-significance')!.textContent = mission.significance;
  document.querySelector('#fact-landing')!.textContent = mission.landing;
  document.querySelector('#fact-status')!.textContent = mission.status;
  document.querySelector('#fact-purpose')!.textContent = mission.purpose;
  document.querySelector('#fact-location')!.textContent = mission.location.split(' · ')[0];
  document.querySelector('#model-source-label')!.textContent = `Real spacecraft model · ${mission.modelSource}`;
  setPartLabels(mission);
  updateMissionList();
  void viewer.load(mission.modelPath);
}

function setPartLabels(mission: Mission) {
  const labels = mission.title.includes('Perseverance')
    ? [['Mastcam-Z camera', 'right', '27%', '18%'], ['Robotic arm', 'left', '18%', '55%'], ['Wheel / rocker-bogie', 'right', '67%', '68%'], ['Sample caching body', 'left', '21%', '35%']]
    : mission.title.includes('Viking')
      ? [['High-gain antenna', 'right', '68%', '18%'], ['Sampler arm', 'left', '17%', '54%'], ['Lander deck', 'right', '67%', '45%'], ['Footpad', 'left', '23%', '72%']]
      : [['Ascent stage', 'right', '68%', '18%'], ['Thermal blanket', 'left', '18%', '40%'], ['Landing leg', 'right', '70%', '63%'], ['Footpad', 'left', '23%', '76%']];
  const container = document.querySelector<HTMLDivElement>('#part-labels');
  if (!container) return;
  container.innerHTML = labels.map(([label, side, top, horizontal]) => `<span class="part-label ${side === 'left' ? 'left' : 'right'} ${activeBody === 'mars' ? 'mars-part' : ''}" style="top:${top};${side === 'left' ? 'left' : 'right'}:${horizontal}">${label}</span>`).join('');
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
  viewer = new SpacecraftViewer(document.querySelector<HTMLCanvasElement>('#model-canvas')!);
  bindUI();
  setMission(activeMission);
}
