// displacement3 — the legacy game's fourth (and final-of-world-1)
// displacement level. The original has `super.nextLvl = 'cutsceneVelocity'`
// after it; we don't have cutscenes wired yet, so SPACE on the win
// overlay loops back / restarts for now (a clean "you finished
// world 1" placeholder). Real cutscene wiring lands in step F.
//
// Numbers come from `legacy/src/levels/displacement3.mxml`.
//
// Layout (from a pngjs band-scan of `leveld3_ground.png`):
//   x=0..400, y=500-599     → bottom cloud bank (origin 2 here at x=280)
//   x=400..600, y=319-365   → middle floating island
//   x=500..780, y=140-198   → upper-right mountain top (where the exit is)
//
// Origin 1 (x=500): legacy_originY=441 → port_y=501. At x=500 the
// bottom cloud bank top is y=500, so origin 1 sits on the bottom
// cloud right next to the floating island.
// Origin 2 (x=280): legacy_originY=260 → port_y=320. At x=280 there
// is NO solid floor anywhere near y=320 (only the bottom cloud at
// y=500). The origin marker is deliberately floating in mid-air —
// the puzzle is to use orb 1's drawn curve to step up to it.

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';

export const displacement3: LevelBuilder = (difficulty): LevelConfig => {
  // Per legacy displacement3.mxml: hard mode adds two moving spikes.
  // Medium adds the first one only. Easy has none.
  const spikes: SpikeConfig[] = [];
  if (difficulty >= 2) {
    // Vertical spike at x=600, oscillating y=10..120 at speed 6/7 (legacy:
    // medium uses 7, hard uses 6; we use 6 as a midpoint).
    spikes.push({
      x: 600,
      y: 0,
      isMoving: true,
      horizontal: false,
      upOrLeft: true,
      turn: 10,
      turn2: difficulty === 3 ? 120 : 110,
      speed: difficulty === 3 ? 6 : 7,
    });
  }
  if (difficulty === 3) {
    // Hard-only: horizontal spike at y=120, oscillating x=500..777, speed 6.
    spikes.push({
      x: 600,
      y: 120,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 500,
      turn2: 777,
      speed: 6,
    });
  }

  return {
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
    // Second addGraph (easy mode):
    //   addGraph(0, 0, 320, 140, 300, 180, 180, 90, 280, 276, 0, 280, 260)
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
          // Legacy spec was yOffset=90. Tuned to 75 — middle ground
          // between "too lenient" (60: trap never fires) and "barely
          // solvable" (90: orb-2 jump is exact-timing-only). With
          // SIDE_TOP_MARGIN=10 + isWallAt overlap rule (v18), the
          // trap range is V<~95. See docs/calibration.md §9 v17–v18.
          yOffset: 75,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
      {
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

    spikes,

    // Legacy next is `cutsceneVelocity` — that machinery (step F) isn't
    // here yet. Leaving nextLevel unset means SPACE on the win overlay
    // restarts displacement3.
  };
};
