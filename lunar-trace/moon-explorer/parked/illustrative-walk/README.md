# Parked: the illustrative walk at the other Apollo sites

Rewound on request. Nothing here is compiled or served.

- `WalkScene.ts`: a full-screen procedural lunar surface (metres) with the lunar module's descent stage (and the rover at Apollo 15 and 16), the real Sun and Earth directions, walk/run/jump.
- `regional.ts`: reads the regional slope and roughness from the global level-0 height tile.
- `walkMode.ts`: the overlay, the nearest-site lookup and the Esc/Leave handling.

To bring it back: copy this folder to `src/ground/illustrative/`, re-add the `walk-here` bar item and the import in `src/main.ts`, the `.walk-*` rules in `src/ui/lunarTrace.css`, the `walk` icon in `src/ui/tablerIcons.ts`, and the `WalkScene.ts` row in `scripts/ledger.test.mts`.
