// velocity0 — first level of world 2 (the velocity world). Introduces
// VELOCITY orbs: the graph plots the avatar's horizontal speed (vx)
// instead of displacement from an origin. The drawn curve solidifies
// into a platform shaped by how the avatar's speed varied over time.
//
// Numbers come from `legacy/src/levels/velocity0.mxml`. Two velocity
// graphs (both difficulties). FIRST PASS — positions are best-guess
// translations of the legacy values + a pngjs band-scan of
// `levelv4_ground.png`; expect calibration iterations like the
// displacement world had.
//
// Layout (band-scan of levelv4_ground.png):
//   x=0:        full left wall (0-599)
//   x=30:       top cap (0-21) + bottom floor (471-599) ← entrance lands
//   x=200-400:  small platforms at y=322 and y=411 + bottom (482-599)
//   x=500-600:  upper platform (149-186) + y=411 + bottom
//   x=660:      platforms at 199, 322, 411 + bottom
//   x=735:      exit-area platforms (51-72, 199-227) + bottom (472-599)
//   x=780:      full right wall (51-599)

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';

export const velocity0: LevelBuilder = (difficulty): LevelConfig => {
  // Per legacy velocity0.mxml: hard mode adds two vertically-moving
  // spikes; medium/easy have none.
  const spikes: SpikeConfig[] = [];
  if (difficulty === 3) {
    // addSpike(640, 177, true, true, true, 640, 757, 4) — horizontal,
    // but turn==x means it barely moves; treat as a slow horizontal sweep.
    spikes.push({
      x: 640,
      y: 177,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 640,
      turn2: 757,
      speed: 4,
    });
    // addSpike(400, 128, true, true, true, 400, 620, 4) — horizontal sweep.
    spikes.push({
      x: 400,
      y: 128,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 400,
      turn2: 620,
      speed: 4,
    });
  }

  // No graph obstacles specified in velocity0.mxml (the trailing
  // addGraph args are all 0). Kept the helper call shape for symmetry
  // with later levels; count 0 → empty.
  const graphObstacles = [
    ...obstaclesForDifficulty({ x: 440, y: 211, width: 200, height: 200 }, 401, 0, 0),
    ...obstaclesForDifficulty({ x: 200, y: 122, width: 200, height: 200 }, 402, 0, 0),
  ].map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' }));
  spikes.push(...graphObstacles);

  return {
    bgKey: 'bgWorld2_1',
    groundKey: 'levelv4_collision',
    bgmKey: 'bgmWorld2',

    // setEntrance(30, 30) — top-left, just below the top cap; gravity
    // drops the avatar onto the bottom floor at y=471.
    spawn: { x: 40, y: 30 },

    // setExit(735, 159).
    exit: { x: 735, y: 159 },

    // Two velocity graphs:
    //   addGraph(1, 0, 440, 211, 80, 200, 200, 20, 30, 440, ...)
    //   addGraph(1, 0, 200, 122, 20, 200, 200, 20, 660, 280, ...)
    // graph args: type=1(velocity), ratio, x, y, scale(=maxValue),
    //   w, h, offset(=yOffset), orbx, orby.
    orbs: [
      {
        valueMode: 'velocity',
        // orb 1 at legacy (30, 440); rests on the bottom floor (top y=471).
        origin: { x: 30, y: 471 },
        orb: { x: 30, y: 459 },
        graph: {
          x: 440,
          y: 211,
          width: 200,
          height: 200,
          maxValue: 80,
          yOffset: 20,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
      {
        valueMode: 'velocity',
        // orb 2 at legacy (660, 280); rests on the x=660 platform (top y=322).
        origin: { x: 660, y: 322 },
        orb: { x: 660, y: 310 },
        graph: {
          x: 200,
          y: 122,
          width: 200,
          height: 200,
          maxValue: 20,
          yOffset: 20,
        },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    // World-2 bg has no distinct sun disc → no sun pulse.

    spikes,

    // nextLevel: velocity1 — wired once velocity1 is built.
  };
};
