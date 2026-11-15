import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGLTFLoader } from '../solar/gltf.ts';
import { dimBrightModel } from '../solar/dim.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATEGORY_LABEL, CRAFT, type Craft, type CraftCategory } from './catalog.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; // keeps white models from turning flat white
renderer.toneMappingExposure = 0.8;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(4, 6, 5);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.15));

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.addEventListener('start', () => (controls.autoRotate = false));

const loader = createGLTFLoader();
let current: THREE.Object3D | null = null;
let token = 0;

// Fits the 3D view to the window.
function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// Frees the graphics memory of a model.
function dispose(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

// Sizes, centres and frames the model for the camera.
function frame(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = 2 / Math.max(size.x, size.y, size.z, 1e-6);
  model.scale.multiplyScalar(s);
  const c = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.position.sub(c);
  camera.position.set(2.4, 1.4, 3.2);
  controls.target.set(0, 0, 0);
  controls.autoRotate = true;
  controls.update();
}

// Shows one spacecraft: loads its model and fills in its details.
async function show(craft: Craft) {
  const my = ++token;
  document.querySelectorAll<HTMLButtonElement>('.craft').forEach((b) => b.classList.toggle('selected', b.dataset.id === craft.id));
  $('name').textContent = craft.name;
  $('cat').textContent = CATEGORY_LABEL[craft.category];
  $('desc').textContent = craft.info;
  const playInfo = $<HTMLButtonElement>('play-info');
  playInfo.hidden = !craft.video;
  playInfo.onclick = () => openVideo(craft);
  history.replaceState(null, '', `#/${craft.id}`);
  const status = $('status');
  status.textContent = 'Loading…';
  status.hidden = false;
  try {
    const gltf = await loader.loadAsync(craft.model, (e) => {
      if (my === token && e.total) status.textContent = `Loading… ${Math.round((e.loaded / e.total) * 100)}%`;
    });
    if (my !== token) return dispose(gltf.scene);
    if (current) { scene.remove(current); dispose(current); }
    current = gltf.scene;
    const dimmed = dimBrightModel(current); // tone down bright models
    if (import.meta.env.DEV) console.debug(`[dim] ${craft.id} ${dimmed.toFixed(2)}`);
    scene.add(current);
    frame(current);
    status.hidden = true;
  } catch (e) {
    if (my === token) status.textContent = 'Could not load this model.';
    console.error(e);
  }
}

// Build the spacecraft list, grouped by type.
const list = $('list');
for (const cat of Object.keys(CATEGORY_LABEL) as CraftCategory[]) {
  const h = document.createElement('h3');
  h.textContent = CATEGORY_LABEL[cat];
  list.appendChild(h);
  for (const craft of CRAFT.filter((x) => x.category === cat)) {
    const row = document.createElement('div');
    row.className = 'craft-row';
    const b = document.createElement('button');
    b.className = 'craft';
    b.dataset.id = craft.id;
    b.textContent = craft.name;
    b.addEventListener('click', () => show(craft));
    row.appendChild(b);
    if (craft.video) { // add a play button if there is a video
      const play = document.createElement('button');
      play.className = 'play';
      play.type = 'button';
      play.title = `Play video: ${craft.name}`;
      play.setAttribute('aria-label', `Play video: ${craft.name}`);
      play.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      play.addEventListener('click', () => { if (current === null || document.querySelector<HTMLElement>('.craft.selected')?.dataset.id !== craft.id) void show(craft); openVideo(craft); });
      row.appendChild(play);
    }
    list.appendChild(row);
  }
}

// Video player controls.
const player = $('player'), video = $<HTMLVideoElement>('player-video');
// Opens the video player and starts the video.
function openVideo(craft: Craft) {
  if (!craft.video) return;
  $('player-title').textContent = craft.name;
  video.src = craft.video;
  player.hidden = false;
  video.play().catch(() => undefined); // if autoplay is blocked, the visitor can press play
  $<HTMLButtonElement>('player-close').focus();
}
// Stops and closes the video player.
function closeVideo() {
  video.pause();
  video.removeAttribute('src');
  video.load();
  player.hidden = true;
}
$('player-close').addEventListener('click', closeVideo);
player.addEventListener('click', (e) => { if (e.target === player) closeVideo(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !player.hidden) closeVideo(); });

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
void show(CRAFT.find((c) => `#/${c.id}` === location.hash) ?? CRAFT[0]);
