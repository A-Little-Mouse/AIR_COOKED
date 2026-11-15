import { useState } from 'react';
import type { BodyDef } from '../../solar/bodies.ts';

export default function BodyList({ bodies, selectedId, onSelect }: { bodies: BodyDef[]; selectedId: string; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const shown = bodies.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="body-list">
      <input
        type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bodies"
        onKeyDown={(e) => { if (e.key === 'Enter' && shown[0]) { onSelect(shown[0].id); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
      />
      <ul>
        {shown.map((b) => (
          <li key={b.id}>
            <button className={`item${b.type !== 'planet' && b.type !== 'star' ? ' sub' : ''}${b.craft ? ' craft' : ''}${b.id === selectedId ? ' selected' : ''}`} onClick={(e) => { onSelect(b.id); e.currentTarget.blur(); }}>
              {b.name}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="empty">No match</li>}
      </ul>
    </div>
  );
}
