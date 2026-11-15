import { useState } from 'react';
import type { BodyDef } from '../../solar/bodies.ts';
import TablerIcon from './TablerIcon';


// The bottom bar (Places, Home, Full view, Labels) and the Credits line.
export default function MarsBar({ places, selectedId, labels, onSelect, onHome, onFullView, onLabels }: {
  places: BodyDef[]; selectedId: string; labels: boolean;
  onSelect: (id: string) => void; onHome: () => void; onFullView: () => void; onLabels: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  // Removes focus from a button after it is clicked.
  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur();

  return (
    <>
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
        <button className={open ? 'active' : ''} aria-label="Places" onClick={(e) => { setOpen(!open); blur(e); }}><TablerIcon name="list" /><span>Places</span></button>
        <button aria-label="Back to the main page" onClick={(e) => { onHome(); blur(e); }}><TablerIcon name="home" /><span>Home</span></button>
        <button aria-label="Show the whole of Mars" onClick={(e) => { onFullView(); setOpen(false); blur(e); }}><TablerIcon name="arrowsMaximize" /><span>Full view</span></button>
        <button className={labels ? 'active' : ''} aria-label="Labels" onClick={(e) => { onLabels(!labels); blur(e); }}><TablerIcon name="mapPin" /><span>Labels</span></button>
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
