import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonElongationCos, pickHeroTime } from '../src/solar/heroTime.ts';

const DAY = 86_400_000;

test('pickHeroTime returns a time within 20 days when the Moon is within 60 degrees of the Sun', () => {
  for (let d = 0; d < 400; d += 7) {
    const from = Date.UTC(2026, 0, 1) + d * DAY;
    const t = pickHeroTime(from);
    assert.ok(t >= from && t - from <= 20 * DAY, `start +${d}d: moved ${(t - from) / DAY} d`);
    assert.ok(moonElongationCos(t) >= 0.5, `start +${d}d: cos elongation ${moonElongationCos(t)}`);
  }
});

test('pickHeroTime keeps the start time when it is already a good one', () => {
  for (let d = 0; d < 400; d += 3) {
    const from = Date.UTC(2026, 0, 1) + d * DAY;
    if (moonElongationCos(from) >= 0.5) assert.equal(pickHeroTime(from), from);
  }
});

test('the Moon alternates new <-> full about every 14.8 days', () => {
  // the Moon's orbit is tilted ~5 deg, so it never reaches exactly 0 / 180 deg elongation: use the extremes within a window
  const t0 = Date.UTC(2026, 0, 1);
  let best = -2, newMoon = t0;
  for (let h = 0; h < 30 * 24; h++) { const t = t0 + h * 3_600_000; const c = moonElongationCos(t); if (c > best) { best = c; newMoon = t; } }
  assert.ok(best > 0.99, `closest approach to the Sun: cos=${best}`);
  let worst = 2;
  for (let h = -24; h <= 24; h++) worst = Math.min(worst, moonElongationCos(newMoon + 14.77 * DAY + h * 3_600_000));
  assert.ok(worst < -0.98, `full Moon ~14.8 d later: cos=${worst}`);
});
