import { RATES, type Snapshot } from '../engine.ts';
import { fmtDateTime } from '../format.ts';

interface Props { snap: Snapshot | null; paused: boolean; onPause: () => void; onRate: (i: number) => void; onNow: () => void }

export default function TimeBar({ snap, paused, onPause, onRate, onNow }: Props) {
  const i = snap?.rateIndex ?? 7;
  const blur = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { fn(); e.currentTarget.blur(); };
  return (
    <footer className="panel time-bar">
      <button className="btn icon" onClick={blur(() => onRate(i - 1))} disabled={i <= 0} title="Slower / reverse">«</button>
      <button className="btn icon" onClick={blur(onPause)} title="Pause / play">{paused ? '▶' : '❚❚'}</button>
      <button className="btn icon" onClick={blur(() => onRate(i + 1))} disabled={i >= RATES.length - 1} title="Faster">»</button>
      <div className="clock">
        <div className="date">{snap ? fmtDateTime(snap.timeMs) : '—'}</div>
        <div className="rate">{paused ? 'Paused' : RATES[i].label}</div>
      </div>
      <button className="btn primary" onClick={blur(onNow)}>Now</button>
    </footer>
  );
}
