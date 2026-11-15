import * as THREE from 'three';
import { createGLTFLoader } from '../solar/gltf.ts';
import { DeimosViewScene } from '../solar/deimosView.ts';

/** Mars from the surface of Deimos, on the home page's Mars slide. The scene is built once (hidden) and only renders while it is shown. */
export interface MarsHero {
  /** Resolves when Mars has loaded and the first frame is drawn. */
  ready: Promise<void>;
  show(): void;
  hide(): void;
  /** The camera pulls back from Deimos to show the whole of Mars (as on the Moon); resolves when it has. */
  pullBack(ms: number): Promise<void>;
  /** Back to standing on Deimos (call while the canvas is hidden). */
  reset(): void;
}

export function createMarsHero(canvas: HTMLCanvasElement): MarsHero {
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

  let shown = false, raf = 0, pullStart = -1, pullMs = 1, pullDone: (() => void) | null = null;
  const t0 = performance.now();
  const draw = () => {
    if (pullStart >= 0) {
      const k = Math.min(1, (performance.now() - pullStart) / pullMs);
      view.pull = k * k * (3 - 2 * k);
      if (k >= 1) { pullStart = -1; pullDone?.(); pullDone = null; }
    }
    view.setCameraPose(reduced ? 0 : (performance.now() - t0) / 1000);
    renderer.render(view.scene, view.camera);
  };
  const loop = () => { if (!shown) return; draw(); raf = requestAnimationFrame(loop); };

  const ready = view.loadMars(createGLTFLoader()).then(() => { draw(); });
  return {
    ready,
    show() { if (shown) return; shown = true; resize(); loop(); },
    hide() { shown = false; cancelAnimationFrame(raf); },
    pullBack(ms) {
      if (reduced) { view.pull = 1; draw(); return Promise.resolve(); }
      pullMs = ms; pullStart = performance.now();
      return new Promise((res) => { pullDone = res; });
    },
    reset() { view.pull = 0; pullStart = -1; },
  };
}
