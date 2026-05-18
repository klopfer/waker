// displacement3 — the legacy game's fourth (and final-of-world-1)
// displacement level. The original has `super.nextLvl = 'cutsceneVelocity'`
// after it; we don't have cutscenes wired yet, so SPACE on the win
// overlay loops back to displacement0 for now (a clean "you finished
// world 1" restart). Real cutscene wiring lands in step F.
//
// Numbers come from `legacy/src/levels/displacement3.mxml` easy mode
// (the else branch — no spike, two addGraph calls).
//
// Layout (from a pngjs band-scan of `leveld3_ground.png`):
//   x=0..400, y=500-599     → bottom cloud bank (origin 2 here at x=280)
//   x=400..600, y=319-365   → middle floating island (origin 1 here at x=500 has higher band too)
//   x=500..780, y=140-198   → upper-right mountain top (where the exit is)
//
// Origin 1 (x=500): legacy_originY=441 → port_y=501. At x=500 the
// bottom cloud bank top is y=500, so origin 1 sits on the bottom
// cloud right next to the floating island.
// Origin 2 (x=280): legacy_originY=260 → port_y=320. At x=280 there
// is NO solid floor anywhere near y=320 (only the bottom cloud at
// y=500). The origin marker is deliberately floating in mid-air —
// the puzzle is to use orb 1's drawn curve to step up to it.

import type { LevelConfig } from '../game/Level.js';

export const DISPLACEMENT3: LevelConfig = {
  bgKey: 'bgWorld1_3',
  groundKey: 'leveld3_collision',
  bgmKey: 'bgmWorld1',

  // setEntrance(0, 450) — spawn from above, fall onto bottom cloud
  // bank (topmost-solid y=500 at x=0..400).
  spawn: { x: 30, y: 0 },

  // setExit(740, 100) — on the upper-right mountain, exit niched
  // above the mountain top at y=140.
  exit: { x: 740, y: 100 },

  // First addGraph (easy mode):
  //   addGraph(0, 0, 100, 320, 400, 180, 180, 90, 500, 457, 0, 500, 441, 0, 0)
  // → graph(100, 320), maxValue=400, w/h=180, offset=90.
  // Second addGraph (easy mode):
  //   addGraph(0, 0, 320, 140, 300, 180, 180, 90, 280, 276, 0, 280, 260)
  // → graph(320, 140), maxValue=300, w/h=180, offset=90.
  orbs: [
    {
      origin: { x: 500, y: 500 },
      orb: { x: 500, y: 488 },
      graph: {
        x: 100,
        y: 320,
        width: 180,
        height: 180,
        maxValue: 400,
        yOffset: 90,
      },
      cradle: { lift: 12, halfWidth: 18 },
    },
    {
      // Floating origin/orb in mid-air at the legacy-specified position.
      // No solid floor at x=280, y=320 — player reaches it by walking up
      // orb 1's drawn curve. The cradle holds the orb in place at start.
      origin: { x: 280, y: 320 },
      orb: { x: 280, y: 308 },
      graph: {
        x: 320,
        y: 140,
        width: 180,
        height: 180,
        maxValue: 300,
        yOffset: 90,
      },
      cradle: { lift: 12, halfWidth: 18 },
    },
  ],

  sunCentroid: { x: 64, y: 209 },

  // Legacy next is `cutsceneVelocity` — that machinery (step F) isn't
  // here yet. Leaving nextLevel unset means SPACE on the win overlay
  // restarts displacement3, which is the right placeholder until
  // cutscenes + the velocity levels land.
};
