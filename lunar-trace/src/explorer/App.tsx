import { useCallback, useEffect, useRef, useState } from 'react';
import { BODY_BY_ID } from '../solar/bodies.ts';
import { bodiesOf, listOf, resolveStartId, worldFromSearch } from '../solar/world.ts';
import { RATES, REAL_TIME_INDEX, SolarEngine, type Layers, type Snapshot } from './engine.ts';
import BodyList from './components/BodyList';
import InfoCard from './components/InfoCard';
import TimeBar from './components/TimeBar';
import HelpPanel from './components/HelpPanel';
import GroundView from './components/GroundView';
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

  const [progress, setProgress] = useState<[number, number]>([0, bodiesOf(world).length]);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initial.id);
  const [freeFly, setFreeFly] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [layers, setLayersState] = useState<Layers>({ orbits: true, labels: world === 'solar' });
  const [paused, setPaused] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [groundId, setGroundId] = useState<string | null>(null);

  useEffect(() => {
    const engine = new SolarEngine(mountRef.current!, labelsRef.current!, {
      onSelect: (id) => {
        setSelectedId(id);
        const q = window.location.hash.split('?')[1];
        window.history.replaceState(null, '', `#/${id}${q ? `?${q}` : ''}`);
      },
      onFreeFly: (on) => {
        setFreeFly(on);
        setToast(on ? 'Now in free fly camera mode. Press K again to exit this mode.' : null);
      },
      onProgress: (d, t) => setProgress([d, t]),
      onReady: () => setReady(true),
      onSnapshot: setSnap,
      onInteract: () => setHint(false),
      onArrive: (id) => { if (world === 'mars' && BODY_BY_ID.get(id)?.craft?.kind === 'surface') setGroundId(id); },
    }, world);
    engineRef.current = engine;
    engine.setLayers({ orbits: true, labels: world === 'solar' }); // the Mars world opens without labels, like the Moon page
    if (import.meta.env.DEV) (window as unknown as { __solar?: SolarEngine }).__solar = engine; // dev-only hook for tests
    engine.start(initial.id, initial.time, initial.rateIndex).catch((e) => console.error('Failed to start', e));

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

  const travel = useCallback((id: string) => engineRef.current?.travelTo(id), []);
  const setLayers = (l: Layers) => { setLayersState(l); engineRef.current?.setLayers(l); };
  const togglePause = () => { const p = !paused; setPaused(p); engineRef.current?.setPaused(p); };
  const setRate = (i: number) => engineRef.current?.setRateIndex(i);
  const goNow = () => { engineRef.current?.setTime(Date.now()); engineRef.current?.setRateIndex(REAL_TIME_INDEX); };

  // like the title slide: Mars and its moons switch the accent colour to orange
  useEffect(() => {
    const def = BODY_BY_ID.get(selectedId);
    document.body.classList.toggle('mars-mode', world === 'mars' || ['mars', 'phobos', 'deimos'].includes(selectedId) || def?.parent === 'mars');
    return () => document.body.classList.remove('mars-mode');
  }, [selectedId]);

  const selected = BODY_BY_ID.get(selectedId)!;
  const closeGround = useCallback(() => setGroundId(null), []);
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

      {ready && hint && world === 'solar' && (
        <div className="hint">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M9 11V5a1.5 1.5 0 0 1 3 0v5h.5V8.5a1.5 1.5 0 0 1 3 0V11h.5V9.5a1.5 1.5 0 0 1 3 0V16c0 3.5-2.5 6-6 6h-1.5c-2 0-3.2-.8-4.3-2.2L4 15.7a1.4 1.4 0 0 1 2.1-1.8L9 16.5z"/></svg>
          <span>click &amp; drag to rotate</span>
        </div>
      )}

      {groundDef && <GroundView def={groundDef} onClose={closeGround} />}

      {toast && <div className="toast">{toast}</div>}

      {!embed && ready && world === 'mars' && (
        <MarsBar
          places={listOf('mars')} selectedId={selectedId} labels={layers.labels}
          onSelect={travel} onHome={() => engineRef.current?.home()} onLabels={(on) => setLayers({ ...layers, labels: on })}
        />
      )}

      {!embed && ready && world === 'solar' && (
        <>
          <header className="panel top-left">
            <a className="back-link" href="/">← Relict</a>
            <a className="back-link" href="/gallery.html" style={{ marginLeft: 14 }}>Spacecraft →</a>
            <h1>Solar System</h1>
            <BodyList bodies={listOf(world)} selectedId={selectedId} onSelect={travel} />
          </header>
          <InfoCard def={selected} snap={snap} />
          <aside className="panel top-right">
            <label><input type="checkbox" checked={layers.orbits} onChange={(e) => setLayers({ ...layers, orbits: e.target.checked })} /> Orbits</label>
            <label><input type="checkbox" checked={layers.labels} onChange={(e) => setLayers({ ...layers, labels: e.target.checked })} /> Labels</label>
            {canGround && <button className="btn" onClick={(e) => { setGroundId(selectedId); e.currentTarget.blur(); }} title="Ground view (G)">Ground view (G)</button>}
            <button className={`btn${freeFly ? ' active' : ''}`} onClick={(e) => { engineRef.current?.toggleFreeFly(); e.currentTarget.blur(); }} title="Free-fly camera (K)">
              Free fly {freeFly ? 'on' : 'off'}
            </button>
            <button className="btn" onClick={(e) => { setHelpOpen(!helpOpen); e.currentTarget.blur(); }}>Controls</button>
          </aside>
          <TimeBar snap={snap} paused={paused} onPause={togglePause} onRate={setRate} onNow={goNow} />
          {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
        </>
      )}
    </main>
  );
}
