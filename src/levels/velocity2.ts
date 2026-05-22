// velocity2 — third level of the velocity world. One large VELOCITY orb:
// the graph fills most of the screen (480×480) and the avatar runs the
// bottom floor building speed, then uses the solidified curve to climb to
// the high-right exit.
//
// Numbers from `legacy/src/levels/velocity2.mxml`.
//
// NOTE: legacy addGraph carries DEADZONE args (rectangles where graph
// obstacles must not be placed) — our `obstaclesForDifficulty` doesn't
// model deadzones yet, so for now we place the obstacle count without
// them. First-pass; expect calibration (and possibly a deadzone feature).
//
// Layout (band-scan of leveltv_collision.png):
//   x=0:    left staircase ledges 91 / 212 / 332 + bottom floor top 455
//   x=80:   stepped ledges + floor top 472
//   x=160+: bottom floor band ~491–520 across the middle
//   x=700+: right staircase ledges (106,158,226,281,347,401) + floor 478
//   x=760:  exit-area ledges (94–116 ← exit rests here, 149,214,334) + 457

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { velocity3 } from './velocity3.js';

export const velocity2: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [];

  // Vertical spike gauntlet (full-height sweeps y=7..465). Hard: a row at
  // x=160,250,340,420,510,615 + one horizontal sweep. Medium: two of them.
  const vSweepXs = difficulty === 3 ? [160, 250, 340, 420, 510, 615] : difficulty === 2 ? [250, 510] : [];
  for (const x of vSweepXs) {
    spikes.push({
      x,
      y: 465,
      isMoving: true,
      horizontal: false,
      upOrLeft: true,
      turn: 7,
      turn2: 465,
      speed: 10,
    });
  }
  if (difficulty === 3) {
    // addSpike(160,465,true,true,true,160,615,6) — horizontal sweep.
    spikes.push({
      x: 160,
      y: 465,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 160,
      turn2: 615,
      speed: 6,
    });
  }

  // Graph obstacles: legacy numberObs 5 (hard) / 2 (medium) / 0 (easy).
  // (Deadzones not modelled yet — see header.)
  const obsCount = difficulty === 3 ? 5 : difficulty === 2 ? 2 : 0;
  const graphObstacles = obstaclesForDifficulty(
    { x: 160, y: 11, width: 480, height: 480 },
    /* seed */ 421,
    /* hardCount */ 5,
    obsCount,
  ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' }));
  spikes.push(...graphObstacles);

  return {
    bgKey: 'bgWorld2_t',
    groundKey: 'leveltv_collision',
    bgmKey: 'bgmWorld2',

    // setEntrance(0, 40) — top-left; drops onto the left staircase.
    spawn: { x: 20, y: 40 },

    // setExit(760, 53) — high right; 40-px portal rests on the x≈760
    // ledge (top y≈94).
    exit: { x: 760, y: 53 },

    // addGraph(1, 0, 160, 11, 22, 480, 480, 60, 0, 420, …) — one big
    // velocity graph. Orb at legacy (0,420) → rests on the bottom-left
    // floor (top ≈ 455); inset from x=0.
    orbs: [
      {
        valueMode: 'velocity',
        origin: { x: 20, y: 455 },
        orb: { x: 20, y: 443 },
        graph: {
          x: 160,
          y: 11,
          width: 480,
          height: 480,
          maxValue: 22,
          yOffset: 60,
        },
      },
    ],

    spikes,

    nextLevel: velocity3,
  };
};
