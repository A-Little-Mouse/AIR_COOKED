# Explore Mars: design (approved 2026-11-15)

## Intent
Make "View Mars" feel like the Moon experience: a Mars title slide, then a Mars-only explorer with Moon-style controls and a list of the Mars spacecraft, each shown in a ground-level scene like the Moon's Apollo 11 view. Why: the Mars side of Lunar Trace is currently a plain solar-system link.

## Goals
- Home "View Mars" becomes "Explore Mars" and opens `/mars/`.
- Mars title slide: same layout as the Moon's, orange/white theme, background is Mars seen from the surface of Deimos.
- Explore Mars: only Mars, Phobos, Deimos (Sun is light only). Buttons/panels match `/moon/` (back link, glass panels, lime accent).
- List: Viking 1/2, Sojourner, Spirit & Opportunity, InSight, Ingenuity, plus Deimos and Phobos viewpoints. Picking a lander flies to its real-coordinate site on the globe, then drops to an illustrative ground scene (lander model, procedural Mars ground, butterscotch sky, low Sun, short info caption).

## Non-goals / anti-goals
- No walking, no orbiters, no real Mars terrain, no other Apollo sites, no Perseverance (not in the spacecraft list).
- Must not imply the ground is measured: the page says terrain, rocks and heading are illustrative.

## Constraints
- No Mars terrain data in the project; only Mars/Phobos/Deimos models and landers in `public/models`.
- Moon app (`moon-explorer/`, AGPL) stays untouched.

## Approaches
1. **Reuse `src/solar/surface.ts` + solar explorer + Moon styling (chosen).** Cheap, consistent.
2. Copy the Moon renderer: rejected, needs terrain tiles Mars lacks.
3. Standalone Mars page duplicating code: rejected, duplication.

## Decisions (my calls)
- Lives at `/mars/` on the same server, own page and scripts, not inside the Moon app.
- New `deimos-surface` scene for the title background.

## Left to the builder
Lander site coordinates, ground-scene tuning, exact theme colours, how the list is laid out on phones.
