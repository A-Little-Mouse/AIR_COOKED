import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../solar/gltf.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATEGORY_LABEL, CRAFT, type Craft, type CraftCategory } from './catalog.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
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

function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

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

/** Scale the model to a unit size, centre it, and frame it. */
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

async function show(craft: Craft) {
  const my = ++token;
  document.querySelectorAll<HTMLButtonElement>('.craft').forEach((b) => b.classList.toggle('selected', b.dataset.id === craft.id));
  $('name').textContent = craft.name;
  $('cat').textContent = CATEGORY_LABEL[craft.category];
  $('desc').textContent = craft.info;
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
    scene.add(current);
    frame(current);
    status.hidden = true;
  } catch (e) {
    if (my === token) status.textContent = 'Could not load this model.';
    console.error(e);
  }
}

// list, grouped by category
const list = $('list');
for (const cat of Object.keys(CATEGORY_LABEL) as CraftCategory[]) {
  const h = document.createElement('h3');
  h.textContent = CATEGORY_LABEL[cat];
  list.appendChild(h);
  for (const craft of CRAFT.filter((x) => x.category === cat)) {
    const b = document.createElement('button');
    b.className = 'craft';
    b.dataset.id = craft.id;
    b.textContent = craft.name;
    b.addEventListener('click', () => show(craft));
    list.appendChild(b);
  }
}

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
void show(CRAFT.find((c) => `#/${c.id}` === location.hash) ?? CRAFT[0]);
