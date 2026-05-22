// velocity3 — final velocity-world level. The first MIXED-type level: a
// VELOCITY orb (graph plots vx) AND a DISPLACEMENT orb (graph plots
// |x - originX|) in the same level — exercising the per-orb `valueMode`.
//
// Numbers from `legacy/src/levels/velocity3.mxml`. Three-way per-difficulty
// collision swap (hard / medium / easy collision PNGs).
//
// Layout (band-scan of levelv3_ground.png, hard):
//   x=0..490:  bottom floor top y=520 (entrance + velocity orb sit here)
//   x=490:     exit ledge 60–77 (exit rests here, top-left high)
//   x=540..799: high right platform top y≈260 (displacement orb floats
//              above it at y≈200; displacement graph sits top-right)

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { cutsceneMixed } from './cutsceneMixed.js';

export const velocity3: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [];

  if (difficulty === 3) {
    // addSpike(510,480,true,false,true,100,480,8) — vertical sweep y=100..480.
    spikes.push({
      x: 510,
      y: 480,
      isMoving: true,
      horizontal: false,
      upOrLeft: true,
      turn: 100,
      turn2: 480,
      speed: 8,
    });
  }
  if (difficulty >= 2) {
    // addSpike(640,170,false,…) — static spike near the displacement orb.
    spikes.push({ x: 640, y: 170, isMoving: false });
  }
  if (difficulty === 3) {
    // addSpike(705,170,false,…) — second static spike (hard only).
    spikes.push({ x: 705, y: 170, isMoving: false });
  }

  // Velocity-graph obstacles: numberObs 4 (hard) / 2 (medium) / 0 (easy).
  const obsCount = difficulty === 3 ? 4 : difficulty === 2 ? 2 : 0;
  const g1Obstacles = obstaclesForDifficulty(
    { x: 200, y: 200, width: 320, height: 320 },
    /* seed */ 431,
    /* hardCount */ 4,
    obsCount,
  ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' }));
  spikes.push(...g1Obstacles);

  return {
    bgKey: 'bgWorld2_3',
    groundKey:
      difficulty === 3
        ? 'levelv3_collision'
        : difficulty === 2
          ? 'levelv3_collision_medium'
          : 'levelv3_collision_easy',
    bgmKey: 'bgmWorld2',

    // setEntrance(0, 467) — bottom-left; on the bottom floor (top y=520).
    spawn: { x: 20, y: 467 },

    // setExit(490, 19) — high; portal rests on the x=490 ledge (top y=60).
    exit: { x: 490, y: 19 },

    orbs: [
      // Orb 1 — VELOCITY. addGraph(1,0,200,200,21,320,320,55,160,460,…).
      // Rests on the bottom floor (top y=520); no origin holder.
      {
        valueMode: 'velocity',
        origin: { x: 160, y: 520 },
        orb: { x: 160, y: 508 },
        graph: {
          x: 200,
          y: 200,
          width: 320,
          height: 320,
          maxValue: 21,
          yOffset: 55,
        },
      },
      // Orb 2 — DISPLACEMENT. addGraph(0,0,540,30,600,230,230,80,700,193,
      // 0,700,200,…). Origin (700,200), orb floats in a holder there
      // (above the right platform top y=260, like displacement3's orb 2).
      {
        origin: { x: 700, y: 200 },
        orb: { x: 700, y: 188 },
        graph: {
          x: 540,
          y: 30,
          width: 230,
          height: 230,
          maxValue: 600,
          yOffset: 80,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    spikes,

    nextLevel: cutsceneMixed,
  };
};
