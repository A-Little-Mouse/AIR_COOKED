import * as Astronomy from 'astronomy-engine'
import type { Ephemeris } from './ephemeris'
import { keptMorning, nextMorning, sunElevationDeg } from './sunMorning'
import { PATCH_SITES } from './moon/patch/sites'
import { MOMENTS, type Moment } from './moments'

/**
 * Hotspots: the places a visitor can fly to from Home (MOON-UX-REDESIGN.md, section 3.2). Each is a Moment (a date, a camera, a
 * caption) so it plays through the same machinery as the archive's tours (main.ts playMoment), plus the point on the Moon its pin
 * is drawn at. The archive's moments (moments.ts) stay as they were, behind ?archive=1.
 *
 * Captions are drafts for the owner's review and went through the no-ai-slop brief: one title, one sentence, no claim the
 * picture does not carry. Apollo 17 ends at eye level beside the fixed module (main.ts landingView('eye')).
 */
export interface Hotspot extends Moment {
  /** Where the pin is drawn on the Moon (selenographic degrees, east positive), for the ephemeris of the moment it is shown at. */
  pin(e: Ephemeris): { lon: number; lat: number }
  /** The distance the pin's own view is at, Moon radii: a camera this close and near to the pin fades it out (the view is already there). */
  viewDist: number
  /** False: listed in the Hotspots sheet only, with no pin drawn on the Moon (a view, not a place on it: From Earth). */
  pinned?: boolean
}

export { sunElevationDeg, nextMorning }

/** The next time the far side is fully lit (new Moon). */
export function nextNewMoon(from = new Date()): Date {
  const t = Astronomy.SearchMoonPhase(0, from, 40)
  return t ? t.date : from
}

const A11 = PATCH_SITES.a11, A17 = PATCH_SITES.a17
const fromMoment = (id: string): Moment => {
  const m = MOMENTS.find((x) => x.id === id)
  if (!m) throw new Error(`No moment ${id}`)
  return m
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'pin-earth', label: 'View from Earth', title: 'View from Earth',
    caption: 'The Moon as it looks from the Earth right now.',
    watch: '', time: () => new Date(), camera: { at: 'earth' }, look: 'moon', live: true, dwellS: 9,
    pin: (e) => ({ lon: e.subEarth.lon, lat: e.subEarth.lat }), viewDist: 12, pinned: false,
  },
  {
    ...fromMoment('apollo11'), id: 'pin-apollo11', label: 'Apollo 11 landing zone', title: 'Apollo 11 landing zone', camera: { at: 'siteView' }, dwellS: 12,
    caption: 'Tranquility Base on the 2011 orbiter photograph. The lander’s shadow is about five pixels wide.',
    pin: () => ({ lon: A11.lon, lat: A11.lat }), viewDist: 1.001,
  },
  ...[
    { n: '12', place: 'Ocean of Storms', lon: -23.42, lat: -3.01, caption: 'Landed in 1969, a few hundred metres from Surveyor 3.' },
    { n: '14', place: 'Fra Mauro', lon: -17.47, lat: -3.65, caption: 'Landed in 1971 in the Fra Mauro highlands.' },
    { n: '15', place: 'Hadley–Apennine', lon: 3.63, lat: 26.13, caption: 'Landed in 1971, the first mission to drive a Lunar Roving Vehicle.' },
    { n: '16', place: 'Descartes Highlands', lon: 15.50, lat: -8.97, caption: 'Landed in 1972 in the Descartes Highlands, with a rover.' },
  ].map((a): Hotspot => ({
    // Relict: the other Apollo landing sites, as a flight over the site (the 59 m terrain; the ground view exists only at Apollo 17).
    id: `pin-apollo${a.n}`, label: `Apollo ${a.n}`, title: `Apollo ${a.n}: ${a.place}`, caption: a.caption, watch: '',
    time: () => keptMorning(`apollo${a.n}`, () => nextMorning(a.lon, a.lat, 15)),
    camera: { at: 'fly', lon: a.lon, lat: a.lat, dist: 1.06, pitch: 45 }, look: 'moon', dwellS: 10, needsTiles: true,
    pin: () => ({ lon: a.lon, lat: a.lat }), viewDist: 1.06,
  })),
  {
    // The module stands fixed beside the ground view (no landing, no settle, no plume): the old 'Beside the LM' moment, quickened.
    ...fromMoment('land-lm-eye'), id: 'pin-apollo17', label: 'Apollo 17', title: 'Apollo 17', fixed: true, camera: { at: 'siteView' }, dwellS: 12,
    caption: 'Challenger in the Taurus-Littrow valley, on the 2011 photograph. The module is NASA’s model at the measured spot.',
    pin: () => ({ lon: A17.lon, lat: A17.lat }), viewDist: 1.001,
  },
  {
    // The same site as pin-apollo17, ending at eye level: the list's "Eye level" sub-view when the ground view is not already open.
    ...fromMoment('land-lm-eye'), id: 'pin-apollo17-eye', label: 'Apollo 17 at eye level', title: 'Apollo 17, eye level', fixed: true, camera: { at: 'siteView' }, dwellS: 12,
    caption: 'Eye level beside Challenger, on the 2011 photograph. The module is NASA’s model at the measured spot.',
    pin: () => ({ lon: A17.lon, lat: A17.lat }), viewDist: 1.001, pinned: false,
  },
]
