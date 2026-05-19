// displacement1 — second level (first after the tutorial). The legacy
// game's "first real level" with the orb mechanic.
//
// All numeric constants come from `legacy/src/levels/displacement1.mxml`
// plus pngjs measurements of `leveld1_ground.png` for floor heights and
// `leveld1_bg.png` for the sun centroid. See `docs/calibration.md`
// §7 for the displacement0 derivation; this is the same approach.
//
// Layout (from the ground sweep):
//   x=0..50   → topmost-solid y=440 (left entrance ledge)
//   x=100..600 → topmost-solid y=498 (main middle platform)
//   x=700..780 → topmost-solid y=235 (upper-right exit ledge)

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { displacement2 } from './displacement2.js';

export const displacement1: LevelBuilder = (difficulty): LevelConfig => {
  // Per legacy displacement1.mxml: hard mode adds a horizontally-moving
  // spike across the middle platform at y=480.
  const spikes: SpikeConfig[] = [];
  if (difficulty === 3) {
    spikes.push({
      x: 500,
      y: 480,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 0,
      turn2: 780,
      speed: 7,
    });
  }

  return {
    bgKey: 'bgWorld1_1',
    groundKey: 'leveld1_collision',
    bgmKey: 'bgmWorld1',

    // setEntrance(0, 390). Avatar drops from upper-left, lands on the
    // left ledge (topmost-solid y=440 at x=0..50).
    spawn: { x: 30, y: 0 },

    // setExit(740, 195). Top-right of the upper exit ledge.
    exit: { x: 740, y: 195 },

    // From super.addGraph(0, 0, 308, 200, 400, 300, 300, 100, 200, 430, 0, 200, 438, 1, 20):
    //   graphX=308, graphY=200, maxValue=400, w/h=300, yOffset=100,
    //   orbX=200, origin=200 (Flash y=438 → port y=498).
    orbs: [
      {
        origin: { x: 200, y: 498 },
        orb: { x: 200, y: 486 },
        graph: {
          x: 308,
          y: 200,
          width: 300,
          height: 300,
          maxValue: 400,
          yOffset: 100,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    sunCentroid: { x: 118, y: 109 },

    spikes,

    nextLevel: displacement2,
  };
};
