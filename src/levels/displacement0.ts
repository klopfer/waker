// displacement0 — the tutorial. The original game's first playable level.
//
// All numeric constants come from `legacy/src/levels/displacement0.mxml`
// (the legacy addGraph + setEntrance + setExit calls) plus pngjs
// measurements of `levelTD_ground.png` for ORIGIN_Y. See
// `docs/calibration.md` §7 for the full table + sourcing.

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { displacement1 } from './displacement1.js';

export const displacement0: LevelBuilder = (difficulty): LevelConfig => {
  // Per legacy displacement0.mxml: hard mode adds one stationary spike
  // at (540, 440) — on the painted ground roughly between the orb
  // stand and the exit path. Medium/easy have no spikes.
  const spikes: SpikeConfig[] = [];
  if (difficulty === 3) {
    spikes.push({ x: 540, y: 440 });
  }

  return {
    bgKey: 'bgWorld1_t',
    groundKey: 'levelTD_collision',
    bgmKey: 'bgmWorld1',

    // setEntrance(0, 467) — Flash top-left marker, not the avatar's feet.
    // SPAWN.x=30 puts the avatar above the very-bottom cloud bank;
    // SPAWN.y=0 lets gravity drop the player in.
    spawn: { x: 30, y: 0 },

    // setExit(750, 174). exit.png is 40×40.
    exit: { x: 750, y: 174 },

    orbs: [
      {
        // Origin Y in our port (bottom-anchor): the painted floor at
        // x=300 has topmost-solid y=333 (measured by pngjs sweep).
        origin: { x: 300, y: 333 },
        // Orb Y = ORIGIN.y - cradle.lift = 333 - 12 = 321.
        orb: { x: 300, y: 321 },
        graph: {
          x: 490,
          y: 134,
          width: 200,
          height: 200,
          maxValue: 550,
          // Legacy spec was yOffset=70. Reduced to 55 so the value=0
          // curve sits at world y=289 — high enough that the avatar
          // standing on the orb stand (body top y=298) clears it
          // naturally. See docs/calibration.md §9 v16.
          yOffset: 55,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    sunCentroid: { x: 207, y: 102 },

    spikes,

    nextLevel: displacement1,
  };
};
