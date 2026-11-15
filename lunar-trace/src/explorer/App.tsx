import { useCallback, useEffect, useRef, useState } from 'react';
import { BODY_BY_ID } from '../solar/bodies.ts';
import { listOf, resolveStartId, worldFromSearch } from '../solar/world.ts';
import { RATES, SolarEngine, type Layers } from './engine.ts';
import GroundView from './components/GroundView';
import { pickPhobosTime } from '../solar/marsTime.ts';
import MarsBar from './components/MarsBar';

/** Route: #/earth?embed=true&time=2030-01-01T00:00:00Z&rate=3600 (same shape as NASA Eyes). */
function parseHash(): { id: string; embed: boolean; time?: number; rateIndex?: number } {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query);
  const id = resolveStartId(worldFromSearch(window.location.search), BODY_BY_ID.has(path) ? path : null);
  const t = q.get('time') ? Date.parse(q.get('time')!) : NaN;
  const rate = q.get('rate') ? Number(q.get('rate')) : NaN;
  const idx = RATES.findIndex((r) => r.value === rate);
  return { id, embed: q.get('embed') === 'true', time: Number.isNaN(t) ? undefined : t, rateIndex: idx >= 0 ? idx : undefined };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarEngine | null>(null);
  const initial = useRef(parseHash()).current;
  const embed = initial.embed;
  const world = useRef(worldFromSearch(window.location.search)).current;

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initial.id);
  const [layers, setLayersState] = useState<Layers>({ orbits: true, labels: false });
  const [toast, setToast] = useState<string | null>(null);
  const [groundId, setGroundId] = useState<string | null>(null);
  const [groundLeaving, setGroundLeaving] = useState(false);
  // Inside the home page (?bg=1) the Mars system is held with no controls and driven by messages, as the Moon is; the page turns the controls on for "Explore Mars".
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
    engine.setLayers({ orbits: true, labels: false }); // the Mars world opens without labels, like the Moon page
    if (import.meta.env.DEV) (window as unknown as { __solar?: SolarEngine }).__solar = engine; // dev-only hook for tests
    engine.start(initial.id, initial.time ?? (world === 'mars' ? pickPhobosTime(Date.now()) : undefined), initial.rateIndex).catch((e) => console.error('Failed to start', e));

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
        // Held: the camera goes back to the shot off Phobos. Released (Explore Mars): it flies to the Sun side of Mars, whose face is then fully lit.
        if (d.on) engineRef.current?.holdPhobosShot(); else { engineRef.current?.setShift(0); engineRef.current?.travelTo('mars'); }
      }
    };
    window.addEventListener('message', onMsg);
    document.body.classList.toggle('lt-bg', bg);
    return () => window.removeEventListener('message', onMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Home: back to the main page (the page that holds this one, or the page itself when opened on its own). */
  const goHome = useCallback(() => {
    if (window.parent !== window) window.parent.postMessage({ type: 'lt-back' }, window.location.origin);
    else window.location.href = '/?mars';
  }, []);

  const travel = useCallback((id: string) => engineRef.current?.travelTo(id), []);
  const setLayers = (l: Layers) => { setLayersState(l); engineRef.current?.setLayers(l); };

  // like the title slide: Mars and its moons switch the accent colour to orange
  useEffect(() => {
    const def = BODY_BY_ID.get(selectedId);
    document.body.classList.toggle('mars-mode', world === 'mars' || ['mars', 'phobos', 'deimos'].includes(selectedId) || def?.parent === 'mars');
    return () => document.body.classList.remove('mars-mode');
  }, [selectedId]);

  const selected = BODY_BY_ID.get(selectedId)!;
  /** Leave the ground view: it fades out first, then `then` runs (the camera flight starts behind the fade). */
  const leaveGround = useCallback((then?: () => void) => {
    if (!groundId) { then?.(); return; }
    setGroundLeaving(true);
    window.setTimeout(() => { setGroundId(null); setGroundLeaving(false); then?.(); }, 500);
  }, [groundId]);
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
