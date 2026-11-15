import { useState } from 'react';
import type { BodyDef } from '../../solar/bodies.ts';
import TablerIcon from './TablerIcon';

/**
 * The Moon page's bottom bar for the Mars system, with the same icons and meanings: Places (the list), Home (back to the main page), Full view (the fixed
 * camera that shows the whole of Mars, from wherever you are zoomed in), Labels (off until you ask); and its Credits line.
 */
export default function MarsBar({ places, selectedId, labels, onSelect, onHome, onFullView, onLabels }: {
  places: BodyDef[]; selectedId: string; labels: boolean;
  onSelect: (id: string) => void; onHome: () => void; onFullView: () => void; onLabels: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur();

  return (
    <>
      <a className="mars-back" href="/" onClick={(e) => { e.preventDefault(); onHome(); }}>← Relict</a>
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
