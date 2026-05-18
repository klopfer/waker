// displacement2 — the legacy game's third displacement level. Adds the
// "two orbs at once" puzzle and a goal in a top-left niche above a high
// shelf the player can't pass through directly.
//
// Numbers come from `legacy/src/levels/displacement2.mxml` easy mode
// (Settings.LEVEL_DIFFICULTY == 1; the else branch). The two addGraph
// calls give the level its two origin/orb/graph bundles.
//
// Layout (from a pngjs band-scan of `leveld2_collision.png`):
//   x=0..200, y=99-135   → top shelf (exit niched above it at y=60)
//   x=0..30,  y=440-465  → small left ledge (entrance lands here)
//   x=240..500, y=279-308 → middle cloud
//   x=500..600, y=380    → narrow right-of-middle cloud
//   x=620..780, y=329    → right cloud (origin 2 sits here)
//   x=0..800,  y=500-599 → bottom cloud bank (origin 1 sits here at x=160)
//
// Spawn note: the entranceY=390 (legacy) is mid-air, which gravity
// catches on the left ledge at y=440. Spawning at y=0 would land on the
// TOP shelf at y=100 — wrong floor (and the exit at (0, 60) would
// trigger immediately!). Spawn at y=200 instead so we fall PAST the top
// shelf and land on the left ledge as the legacy designer intended.

import type { LevelConfig } from '../game/Level.js';
import { DISPLACEMENT3 } from './displacement3.js';

export const DISPLACEMENT2: LevelConfig = {
  bgKey: 'bgWorld1_2',
  groundKey: 'leveld2_collision',
  bgmKey: 'bgmWorld1',

  spawn: { x: 30, y: 200 },
  exit: { x: 0, y: 60 },

  // First addGraph (easy mode):
  //   addGraph(0, 0, 240, 340, 600, 160, 160, 40, 160, 457, 0, 160, 440, 0, 0)
  // → graph(240, 340), maxValue=600, w/h=160, offset=40,
  //   orb(160, 457 Flash), origin(160, 440 Flash). Legacy_y + 60 →
  //   port origin y=500 (bottom cloud bank at x=160).
  //
  // Second addGraph (easy mode):
  //   addGraph(0, 0, 223, 60, 500, 220, 220, 80, 740, 286, 0, 740, 269, 0, 0)
  // → graph(223, 60), maxValue=500, w/h=220, offset=80,
  //   orb(740, 286 Flash), origin(740, 269 Flash). Legacy_y + 60 →
  //   port origin y=329 (right cloud top at x=740).
  orbs: [
    {
      origin: { x: 160, y: 500 },
      orb: { x: 160, y: 488 },
      graph: {
        x: 240,
        y: 340,
        width: 160,
        height: 160,
        maxValue: 600,
        yOffset: 40,
      },
      cradle: { lift: 12, halfWidth: 18 },
    },
    {
      origin: { x: 740, y: 329 },
      orb: { x: 740, y: 317 },
      graph: {
        x: 223,
        y: 60,
        width: 220,
        height: 220,
        maxValue: 500,
        yOffset: 80,
      },
      cradle: { lift: 12, halfWidth: 18 },
    },
  ],

  sunCentroid: { x: 170, y: 88 },

  nextLevel: DISPLACEMENT3,
};
