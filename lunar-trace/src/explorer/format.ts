import { AU_KM } from '../solar/ephemeris.ts';

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Distance with sensible units: km, million km, AU. */
export function fmtDistance(km: number): string {
  if (km >= 0.1 * AU_KM) return `${(km / AU_KM).toFixed(3)} AU`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} million km`;
  if (km >= 100) return `${fmtInt(km)} km`;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
}

export function fmtHours(h: number): string {
  const a = Math.abs(h);
  const sign = h < 0 ? 'retrograde · ' : '';
  if (a >= 48) return `${sign}${(a / 24).toFixed(1)} days`;
  return `${sign}${a.toFixed(2)} hours`;
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/** Light travel time from the Sun. */
export function fmtLightTime(km: number): string {
  const s = km / 299_792.458;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 5400) return `${(s / 60).toFixed(1)} min`;
  return `${(s / 3600).toFixed(2)} h`;
}
