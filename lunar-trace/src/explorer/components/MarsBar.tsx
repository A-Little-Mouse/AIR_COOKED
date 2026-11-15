import { useEffect, useState } from 'react';
import type { BodyDef } from '../../solar/bodies.ts';

/** The Moon page's bottom bar (Places, Home, Full view, Labels) and its Credits line, for the Mars explorer. */
export default function MarsBar({ places, selectedId, labels, onSelect, onHome, onLabels }: {
  places: BodyDef[]; selectedId: string; labels: boolean;
  onSelect: (id: string) => void; onHome: () => void; onLabels: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur();

  return (
    <>
      <a className="mars-back" href="/mars/">← Relict</a>
      {open && (
        <div className="panel places" role="dialog" aria-label="Places">
          <ul>
            {places.map((b) => (
              <li key={b.id}>
                <button className={b.id === selectedId ? 'selected' : ''} onClick={(e) => { onSelect(b.id); setOpen(false); blur(e); }}>
                  <strong>{b.name}</strong>
                  <span>{b.facts?.find(([k]) => k === 'Site')?.[1] ?? (b.type === 'moon' ? 'Moon of Mars' : 'The planet')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <nav className="mars-bar" aria-label="Mars controls">
        <button className={open ? 'active' : ''} onClick={(e) => { setOpen(!open); blur(e); }}>Places</button>
        <button onClick={(e) => { onHome(); setOpen(false); blur(e); }}>Home</button>
        <button className={full ? 'active' : ''} onClick={(e) => { toggleFull(); blur(e); }}>Full view</button>
        <button className={labels ? 'active' : ''} onClick={(e) => { onLabels(!labels); blur(e); }}>Labels</button>
      </nav>
      <div className="mars-credit">
        Relict · Mars (<button onClick={(e) => { setCredits(!credits); blur(e); }}>Credits</button>)
      </div>
      {credits && (
        <div className="panel credits">
          <p>Mars, Phobos, Deimos and the lander and rover models: NASA 3D Resources. Landing sites: NASA/JPL mission records.</p>
          <p>Ground scenes and the Deimos surface are illustrative, not measured. Orbits and positions follow JPL elements.</p>
          <button className="btn" onClick={() => setCredits(false)}>Close</button>
        </div>
      )}
    </>
  );
}
