import { useCallback, useEffect, useRef, useState } from 'react';
import { BODY_BY_ID } from '../solar/bodies.ts';
import { listOf, resolveStartId, worldFromSearch } from '../solar/world.ts';
import { SolarEngine, type Layers } from './engine.ts';
import GroundView from './components/GroundView';
import { pickPhobosTime } from '../solar/marsTime.ts';
import MarsBar from './components/MarsBar';

// Reads the web address to see which body to start on.
function parseHash(): { id: string; embed: boolean } {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query);
  const id = resolveStartId(worldFromSearch(window.location.search), BODY_BY_ID.has(path) ? path : null);
  return { id, embed: q.get('embed') === 'true' };
}

// The Mars explorer page: the 3D view, the bottom bar, and the lander ground view.
export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarEngine | null>(null);
  const initial = useRef(parseHash()).current;
  const embed = initial.embed;
  const world = useRef(worldFromSearch(window.location.search)).current;

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initial.id);
  const [layers, setLayersState] = useState<Layers>({ labels: false });
  const [toast, setToast] = useState<string | null>(null);
  const [groundId, setGroundId] = useState<string | null>(null);
  const [groundLeaving, setGroundLeaving] = useState(false);
  // On the home page (?bg=1) Mars sits in the background with no controls until Explore Mars.
  const bgStart = useRef(new URLSearchParams(window.location.search).get('bg') === '1').current;
  const [bg, setBg] = useState(bgStart);

  useEffect(() => {
    const engine = new SolarEngine(mountRef.current!, labelsRef.current!, {
      onSelect: (id) => {
        setSelectedId(id);
        const q = window.location.hash.split('?')[1];
        window.history.replaceState(null, '', `#/${id}${q ? `?${q}` : ''}`);
      },
      onFreeFly: (on) => {
        setToast(on ? 'Now in free fly camera mode. Press K again to exit this mode.' : null);
      },
      onReady: () => { setReady(true); if (bgStart) engineRef.current?.holdPhobosShot(true); if (window.parent !== window) window.parent.postMessage({ type: 'lt-ready' }, window.location.origin); },
      onArrive: (id) => { if (world === 'mars' && BODY_BY_ID.get(id)?.craft?.kind === 'surface') setGroundId(id); },
    }, world);
    engineRef.current = engine;
    engine.setLayers({ labels: false }); // labels start off, like the Moon page
    if (import.meta.env.DEV) (window as unknown as { __solar?: SolarEngine }).__solar = engine; // for testing only
    engine.start(initial.id, pickPhobosTime(Date.now())).catch((e) => console.error('Failed to start', e));

    const onHash = () => {
      const h = parseHash();
      if (h.id !== engine.getSelectedId()) engine.travelTo(h.id);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      engine.dispose();
      engineRef.current = null;
    };
  }, [initial]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; on?: boolean } | null;
      if (d?.type === 'lt-bg') { setBg(!!d.on); setGroundId(null); document.body.classList.toggle('lt-bg', !!d.on); 
        // Background on: return to the Phobos shot. Background off: fly to the sunlit side of Mars.
        if (d.on) engineRef.current?.holdPhobosShot(); else { engineRef.current?.setShift(0); engineRef.current?.travelTo('mars'); }
      }
    };
    window.addEventListener('message', onMsg);
    document.body.classList.toggle('lt-bg', bg);
    return () => window.removeEventListener('message', onMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Goes back to the home page.
  const goHome = useCallback(() => {
    if (window.parent !== window) window.parent.postMessage({ type: 'lt-back' }, window.location.origin);
    else window.location.href = '/?mars';
  }, []);

  // Flies to a body.
  const travel = useCallback((id: string) => engineRef.current?.travelTo(id), []);
  // Turns the labels on or off.
  const setLayers = (l: Layers) => { setLayersState(l); engineRef.current?.setLayers(l); };

  // Use the orange Mars colour.
  useEffect(() => {
    const def = BODY_BY_ID.get(selectedId);
    document.body.classList.toggle('mars-mode', world === 'mars' || ['mars', 'phobos', 'deimos'].includes(selectedId) || def?.parent === 'mars');
    return () => document.body.classList.remove('mars-mode');
  }, [selectedId]);

  const selected = BODY_BY_ID.get(selectedId)!;
  // Fades out the ground view, then runs the next step.
  const leaveGround = useCallback((then?: () => void) => {
    if (!groundId) { then?.(); return; }
    setGroundLeaving(true);
    window.setTimeout(() => { setGroundId(null); setGroundLeaving(false); then?.(); }, 500);
  }, [groundId]);
  // Closes the ground view.
  const closeGround = useCallback(() => leaveGround(), [leaveGround]);
  const groundDef = groundId ? BODY_BY_ID.get(groundId) ?? null : null;
  const canGround = world === 'mars' && selected.craft?.kind === 'surface';
  useEffect(() => {
    if (!canGround) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'g' && !(e.target instanceof HTMLInputElement)) setGroundId(selectedId); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canGround, selectedId]);

  return (
    <main className={`app${embed ? ' embed' : ''}${ready ? ' ready' : ''}${world === 'mars' ? ' world-mars' : ''}`}>
      <div ref={mountRef} className="viewport" />
      <div ref={labelsRef} className="labels" />

      {groundDef && <GroundView def={groundDef} leaving={groundLeaving} onClose={closeGround} />}

      {toast && <div className="toast">{toast}</div>}

      {!embed && !bg && ready && (
        <MarsBar
          places={listOf('mars')} selectedId={selectedId} labels={layers.labels}
          onSelect={(id) => leaveGround(() => travel(id))} onHome={goHome} onFullView={() => leaveGround(() => engineRef.current?.home())} onLabels={(on) => setLayers({ ...layers, labels: on })}
        />
      )}
    </main>
  );
}
