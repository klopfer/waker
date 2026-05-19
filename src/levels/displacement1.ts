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

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
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

  // Per legacy addGraph(..., difficulty, 20): graph-rect obstacle
  // count matches the difficulty value (easy=1, medium=2, hard=3).
  // Placed once at the hard count (3) so easy/medium/hard all use
  // the SAME first N positions — easy d1 = medium's top, hard d1 =
  // medium's two + a third below. Per-slot nudges:
  //   slot 0 (top):    +20 down (one spike-width)
  //   slot 1 (middle): -40 up (two spike-widths), -30 left
  //                    (playtest 2026-05-19: raw position was in a
  //                    too-narrow gap on medium/hard, shift left)
  //   slot 2 (bottom): no nudge (only present on hard)
  const graphObstacles = obstaclesForDifficulty(
    { x: 308, y: 200, width: 300, height: 300 },
    /* seed */ 1,
    /* hardCount */ 3,
    /* count */ difficulty,
    /* yOffsetsPerSlot */ [20, -40, 0],
    /* xOffsetsPerSlot */ [0, -30, 0],
  ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' }));
  spikes.push(...graphObstacles);

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
