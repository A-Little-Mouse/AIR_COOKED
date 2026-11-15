// Dev-only: renders the rigged astronaut at fixed walk phases from the side and the front, so the animation can be checked
// without playing the game. Not part of the build (vite.config.ts lists the real pages only). Open /dev/rig-preview.html.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rigAstronaut } from '../src/expedition/astronaut.ts';

const W = 1600, H = 800;
const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x1a1c22);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xd8e4ee, 0x302a26, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 5, 4); scene.add(sun);

const gltf = await new GLTFLoader().loadAsync('/models/stylized-astronaut.glb');
const model = gltf.scene;
const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
const k = 2.15 / Math.max(size.x, size.y, size.z);
model.scale.setScalar(k); model.position.set(-center.x * k, -center.y * k, -center.z * k);
scene.add(model);
const rig = rigAstronaut(model.getObjectByProperty('isMesh', true) as THREE.Mesh);

const phases = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const views: Array<{ name: string; pos: [number, number, number] }> = [
  { name: 'side (+X = front, to the right)', pos: [0, 0, 4.2] },
  { name: 'front', pos: [4.2, 0, 0] },
];
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
views.forEach((v, row) => phases.forEach((ph, col) => {
  rig.pose(ph);
  const w = W / phases.length, h = H / views.length;
  renderer.setViewport(col * w, H - (row + 1) * h, w, h);
  renderer.setScissor(col * w, H - (row + 1) * h, w, h);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  cam.position.set(...v.pos); cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
}));
(window as unknown as { __previewReady: boolean }).__previewReady = true;
