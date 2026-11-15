import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createGLTFLoader } from '../../solar/gltf.ts';
import type { BodyDef } from '../../solar/bodies.ts';
import { MarsSurfaceScene } from '../../solar/marsSurface.ts';

/** An illustrative ground scene for a Mars lander, over the explorer. The page's bar (Places, Home, Full view, Labels) stays on top; Full view or Esc goes back to orbit. */
export default function GroundView({ def, leaving, onClose }: { def: BodyDef; leaving: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0, disposed = false;
    let renderer: THREE.WebGLRenderer;
    let ground: MarsSurfaceScene;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      ground = new MarsSurfaceScene();
    } catch (e) {
      console.error('Ground view needs WebGL', e);
      onClose();
      return;
    }
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      ground.camera.aspect = w / h;
      ground.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    ground.loadLander(createGLTFLoader(), def).catch((e) => console.error(`Failed to load ${def.model}`, e));
    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    let drag: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
    const pm = (e: PointerEvent) => { if (!drag) return; ground.look(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; };
    const pu = () => { drag = null; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu);
    const t0 = performance.now();
    let last = t0;
    const loop = () => {
      if (disposed) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const on = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
      ground.walk(dt, on('w', 'arrowup') - on('s', 'arrowdown'), on('d', 'arrowright') - on('a', 'arrowleft'), keys.has('shift'), keys.has(' '));
      ground.setCameraPose((now - t0) / 1000);
      renderer.render(ground.scene, ground.camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('pointermove', pm); canvas.removeEventListener('pointerup', pu);
      ground.dispose();
      renderer.dispose();
    };
  }, [def, onClose]);

  const site = def.facts?.find(([k]) => k === 'Site')?.[1];
  return (
    <div className={`ground-view${leaving ? ' leaving' : ''}`}>
      <canvas ref={canvasRef} />
      <div className="panel ground-caption">
        <strong>{def.name}</strong>{site ? ` · ${site}` : ''}
        <p>Landing site is real. Terrain, rocks and the lander's heading are illustrative.</p>
        <p className="keys">W A S D walk · Shift run · Space jump · drag to look · Full view or Esc for orbit</p>
      </div>
    </div>
  );
}
