// displacement0 — the tutorial. The original game's first playable level.
//
// All numeric constants come from `legacy/src/levels/displacement0.mxml`
// (the legacy addGraph + setEntrance + setExit calls) plus pngjs
// measurements of `levelTD_ground.png` for ORIGIN_Y. See
// `docs/calibration.md` §7 for the full table + sourcing.

import type { LevelConfig } from '../game/Level.js';

export const DISPLACEMENT0: LevelConfig = {
  bgKey: 'bgWorld1_t',
  groundKey: 'levelTD_collision',
  bgmKey: 'bgmWorld1',

  // setEntrance(0, 467) — Flash top-left marker, not the avatar's feet.
  // SPAWN.x=30 puts the avatar above the very-bottom cloud bank (topmost-
  // solid y=520 at x=0..50); SPAWN.y=0 lets gravity drop the player in.
  spawn: { x: 30, y: 0 },

  // setExit(750, 174). exit.png is 40×40; explicit w/h omitted, defaults
  // in Level constructor.
  exit: { x: 750, y: 174 },

  // From super.addGraph(0, 0, 800-110-200, 134, 550, 200, 200, 70, 300, 290, 0, 300, 273, 0, 0):
  //   graphX=490, graphY=134, scale(maxValue)=550, width=200, height=200,
  //   offset=70, orbX=300, orbY=290 (Flash top-left), originX=300, originY=273 (Flash top-left)
  //
  // Origin Y in our port (bottom-anchor, anchor (0.5, 1)): the painted
  // floor at x=300 has topmost-solid y=333 (measured by pngjs sweep of
  // levelTD_ground.png). The origin sits with its bottom on the floor.
  //
  // Orb Y in our port: ORIGIN.y - cradle.lift = 333 - 12 = 321 — the
  // top of the cradle shelf.
  origin: { x: 300, y: 333 },
  orb: { x: 300, y: 321 },

  graph: {
    x: 490,
    y: 134,
    width: 200,
    height: 200,
    maxValue: 550,
    yOffset: 70,
  },

  // Cradle: a thin orb-only horizontal shelf that holds the orb 12 px
  // above the painted floor at level start. See docs/calibration.md §6.1.
  cradle: {
    lift: 12,
    halfWidth: 18,
  },

  // Painted-sun centroid in `levelTD_bg.png`, measured by a pngjs sweep
  // of pure-white pixels in the upper-left region.
  sunCentroid: { x: 207, y: 102 },

  // displacement0's bg has D / ↑ / SPACEBAR / flag glyphs baked in, so
  // skip the runtime procedural prompts to avoid stacking.
  hasHelpPromptsInBg: true,

  // Spikes are present in the legacy file only on hard difficulty (see
  // legacy/src/levels/displacement0.mxml line 35). Faithful port of that
  // line plus one moving spike to exercise both code paths.
  //
  // Difficulty selection isn't wired yet (Phase 5), so these always show
  // up. Easy to remove once we wire the difficulty selector.
  spikes: [
    // Hard-mode stationary spike from legacy displacement0.mxml:
    //   addSpike(540, 440, false, true, true, 500, 400, 0)
    // Sits between the orb stand and the exit path; player has to drop
    // their drawn-curve platform AROUND it (or jump over it).
    { x: 540, y: 440 },
    // Smoke test for moving spikes: horizontal sweep in the bottom-left
    // floor area (y=540 is below the bottom cloud bank), so it doesn't
    // collide with the player's intended path. Easy to remove.
    {
      x: 100,
      y: 555,
      isMoving: true,
      horizontal: true,
      upOrLeft: false,
      turn: 60,
      turn2: 220,
      speed: 3,
    },
  ],
};
