// mixed1 — second mixed level. A single displacement orb, one
// switch-controlled platform pair, and a static spike that blocks part of
// a jump-through gap. Numbers from `legacy/src/levels/mixed1.mxml`.
//
// Layout:
//   spawn (0,410), exit (550,100).
//   Static spike (460,220) — narrows a jump-through gap.
//   Switch (10,410) flips two horizontal platforms at (64,460) and
//   (255,460), each 160×20.
//   Displacement orb: graph (440,160) 360×360, maxValue=140, yOffset=180,
//   origin (479,460), orb (480,476). Graph obstacles: hard=3, medium=1,
//   easy=0.

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { mixed2 } from './mixed2.js';

export const mixed1: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [{ x: 460, y: 220, isMoving: false }];

  const dObsCount = difficulty === 3 ? 3 : difficulty === 2 ? 1 : 0;
  spikes.push(
    ...obstaclesForDifficulty(
      { x: 440, y: 160, width: 360, height: 360 },
      /* seed */ 31,
      /* hardCount */ 3,
      dObsCount,
    ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' })),
  );

  return {
    bgKey: 'bgWorld3_2',
    groundKey: 'levelm3_easy_collision',
    bgmKey: 'bgmWorld3',

    spawn: { x: 0, y: 410 },
    exit: { x: 550, y: 100 },

    // addGraph(0,0,440,160,140,360,360,180,480,476,0,479,460,…).
    orbs: [
      {
        origin: { x: 479, y: 460 },
        orb: { x: 479, y: 448 },
        graph: { x: 440, y: 160, width: 360, height: 360, maxValue: 140, yOffset: 180 },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    // addSwitch(10,410, 64,460,false,false,160,20, 255,460,false,false,160,20).
    switches: [
      {
        switch: { x: 10, y: 410 },
        platforms: [
          { x: 64, y: 460, width: 160, height: 20, horizontal: false, upOrLeft: false },
          { x: 255, y: 460, width: 160, height: 20, horizontal: false, upOrLeft: false },
        ],
      },
    ],

    spikes,

    nextLevel: mixed2,
  };
};
