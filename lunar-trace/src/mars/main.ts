import '../style.css';
import './mars.css';
import * as THREE from 'three';
import { createGLTFLoader } from '../solar/gltf.ts';
import { DeimosViewScene } from '../solar/deimosView.ts';

const embedded = new URLSearchParams(location.search).has('embed'); // inside the home page, which preloads this page
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="page-shell">
    <main id="top">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <h1 id="hero-title">What we <em>leave</em> behind.</h1>
          <p class="hero-lede">Our legacy in space, the remnant echoes of our expedition still lingers. Discover the inactive equipment and technologies from Mars and Moon alike, long after its final transmission</p>
          <div class="hero-actions">
            <a class="primary-button" id="explore-mars" href="/explorer.html?world=mars#/mars">Explore Mars <span class="arrow">↗</span></a>
            <a class="ghost-button" id="back-home" href="/">View Moon <span class="arrow">↗</span></a>
            <a class="ghost-button" href="/gallery.html">Spacecraft <span class="arrow">↗</span></a>
          </div>
        </div>
      </section>
    </main>
  </div>
`;

/** Mars from Deimos, behind the text. If WebGL or the model fails, the page is just the text and buttons. */
const EXPLORER_URL = '/explorer.html?world=mars#/mars';
let pullStart = -1; // when the Explore Mars pull-back began (ms), or -1
document.getElementById('explore-mars')!.addEventListener('click', (e) => {
  e.preventDefault();
  if (pullStart >= 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { (window.top ?? window).location.href = EXPLORER_URL; return; }
  document.body.classList.add('mars-live'); // the text fades and the camera pulls back from Deimos to show the whole of Mars, as on the Moon
  pullStart = performance.now();
});
document.getElementById('back-home')?.addEventListener('click', (e) => {
  if (!embedded) return;
  e.preventDefault();
  window.parent.postMessage({ type: 'lt-back' }, location.origin);
});

async function startBackground(): Promise<void> {
  const canvas = document.getElementById('mars-bg') as HTMLCanvasElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const view = new DeimosViewScene();
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    view.camera.aspect = w / h;
    view.camera.fov = w / h < 0.9 ? 70 : 50; // narrow phones: a wider view keeps Mars in frame
    view.camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  await view.loadMars(createGLTFLoader());
  renderer.render(view.scene, view.camera);
  canvas.classList.add('ready');
  if (embedded) window.parent.postMessage({ type: 'lt-mars-ready' }, location.origin);
  if (reduced) return;
  const t0 = performance.now();
  const PULL_MS = 1500;
  const loop = () => {
    if (pullStart >= 0) {
      const k = Math.min(1, (performance.now() - pullStart) / PULL_MS);
      view.pull = k * k * (3 - 2 * k);
      if (k >= 1) { (window.top ?? window).location.href = EXPLORER_URL; return; }
    }
    view.setCameraPose((performance.now() - t0) / 1000);
    renderer.render(view.scene, view.camera);
    requestAnimationFrame(loop);
  };
  loop();
}

startBackground().catch((e) => console.error('Mars background failed; showing the page without it', e));
