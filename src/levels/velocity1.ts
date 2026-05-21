// velocity1 — second level of the velocity world. One VELOCITY orb: the
// graph plots the avatar's horizontal speed (vx). The player picks up the
// orb on the mid platform, runs to build speed, and the solidified curve
// becomes the platform used to reach the high exit.
//
// Numbers come from `legacy/src/levels/velocity1.mxml`.
//
// FIRST in the port to use a PER-DIFFICULTY COLLISION SWAP: hard loads
// `levelv1_collision`; easy/medium load `levelv1_easy_collision` (which
// adds a stepping platform at x≈600 to make reaching the graph easier).
// The LevelBuilder(difficulty) pattern makes this a one-line branch.
//
// Layout (band-scan of both masks; main shared structure):
//   bottom floor:    y≈501 across the full width
//   top cave ceiling: y≈200 band (thick at edges, thin mid)
//   stepping plats:   x≈200 top y=444, x≈300–500 top y=407 (orb sits here),
//                     x≈600 top y=431 (+ easy-only ledge 352–366)
//   exit shelf:       x≈700–799 ceiling block top y=200 (exit rests at 200)
//   hard-only ledge:  x≈0–60 at y≈138–160 (catches the entrance drop)

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';

export const velocity1: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [];

  // Hard only: two fast horizontal spike sweeps spanning the width — one
  // low (y=480, near the bottom floor) sweeping left-first, one high
  // (y=180, near the ceiling) sweeping right-first.
  //   addSpike(100,480,true,true,true ,0,780,10)
  //   addSpike(100,180,true,true,false,0,780,10)
  if (difficulty === 3) {
    spikes.push({
      x: 100,
      y: 480,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 0,
      turn2: 780,
      speed: 10,
    });
    spikes.push({
      x: 100,
      y: 180,
      isMoving: true,
      horizontal: true,
      upOrLeft: false,
      turn: 0,
      turn2: 780,
      speed: 10,
    });
  }

  // Procedural graph obstacles inside the graph rect. Legacy numberObs:
  // hard 2, medium 1, easy 0 (the trailing addGraph args ...,50,2 / ,1 /
  // ,0). Place the hard count once with a fixed seed and slice the first
  // N so medium's single obstacle aligns with hard's first.
  const obsCount = difficulty === 3 ? 2 : difficulty === 2 ? 1 : 0;
  const graphObstacles = obstaclesForDifficulty(
    { x: 340, y: 227, width: 180, height: 180 },
    /* seed */ 411,
    /* hardCount */ 2,
    obsCount,
  ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' }));
  spikes.push(...graphObstacles);

  return {
    bgKey: 'bgWorld2_2',
    // Per-difficulty collision swap (see header). Easy/medium get the
    // version with extra helper platforms.
    groundKey: difficulty === 3 ? 'levelv1_collision' : 'levelv1_easy_collision',
    bgmKey: 'bgmWorld2',

    // setEntrance(0, 90) — top-left; drops onto the hard-only ledge
    // (y=138) or the left ceiling block (y=200) in easy/medium. Inset a
    // little from x=0 so the body isn't jammed into the left wall.
    spawn: { x: 20, y: 90 },

    // setExit(755, 160) — high right, resting on the x≈700–799 ceiling
    // block (top y=200, so the 40-px portal bottom lands at 200).
    exit: { x: 755, y: 160 },

    // addGraph(1, 0, 340, 227, 15, 180, 180, 4, 380, 440, ...)
    //   type=1 (velocity), x=340, y=227, maxValue=15, w=180, h=180,
    //   yOffset=4, orbx=380, orby=440.
    // Velocity orb — no origin holder; rests on the mid platform
    // (top y=407 at x=380; legacy orby=440 falls onto it).
    orbs: [
      {
        valueMode: 'velocity',
        origin: { x: 380, y: 407 },
        orb: { x: 380, y: 405 },
        graph: {
          x: 340,
          y: 227,
          width: 180,
          height: 180,
          maxValue: 15,
          yOffset: 4,
        },
      },
    ],

    spikes,

    // nextLevel: velocity2 — wired once velocity2 is built.
  };
};
