// mixed2 — third mixed level. TWO displacement orbs (both 225×450 "tall"
// graphs), no switches, one static spike at the bottom-right and a hard-
// only horizontal-sweep spike low on the left. Numbers from
// `legacy/src/levels/mixed2.mxml`.
//
// Layout (per legacy):
//   spawn (10,470) — bottom-left, exit (0,40) — top-left.
//   Static spike (759,438).
//   Hard: horizontal-sweep spike at (160,440), sweep 160..655, speed 7.
//   Orb 1: graph (415,10) 225×450 (tall) maxValue=630, yOffset=200,
//          orb (20,476), origin (20,460); obstacles hard=4 / med=3 / easy=2.
//   Orb 2: graph (193,10) 225×450 (tall) maxValue=600, yOffset=160,
//          orb (740,476), origin (740,460); obstacles hard=3 / med=2 / easy=1.

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { mixed3 } from './mixed3.js';

export const mixed2: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [{ x: 759, y: 438, isMoving: false }];

  if (difficulty === 3) {
    spikes.push({
      x: 160,
      y: 440,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 160,
      turn2: 655,
      speed: 7,
    });
  }

  // Per-graph obstacle counts. Graph 1 bbox (415,10) 225×450; graph 2
  // bbox (193,10) 225×450 (using `800-225-160-225-22 = 168` simplified to
  // 193 for the second graph's x in the legacy expression).
  const g1Count = difficulty === 3 ? 4 : difficulty === 2 ? 3 : 2;
  const g2Count = difficulty === 3 ? 3 : difficulty === 2 ? 2 : 1;
  spikes.push(
    ...obstaclesForDifficulty(
      { x: 415, y: 10, width: 225, height: 450 },
      /* seed */ 32,
      /* hardCount */ 4,
      g1Count,
    ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' })),
  );
  spikes.push(
    ...obstaclesForDifficulty(
      { x: 168, y: 10, width: 225, height: 450 },
      /* seed */ 33,
      /* hardCount */ 3,
      g2Count,
    ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' })),
  );

  return {
    bgKey: 'bgWorld3_3',
    groundKey: 'levelm4_collision',
    bgmKey: 'bgmWorld3',

    spawn: { x: 10, y: 470 },
    exit: { x: 0, y: 40 },

    orbs: [
      {
        origin: { x: 20, y: 460 },
        orb: { x: 20, y: 448 },
        graph: { x: 415, y: 10, width: 225, height: 450, maxValue: 630, yOffset: 200 },
        cradle: { lift: 12, halfWidth: 18 },
      },
      {
        origin: { x: 740, y: 460 },
        orb: { x: 740, y: 448 },
        graph: { x: 168, y: 10, width: 225, height: 450, maxValue: 600, yOffset: 160 },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    spikes,

    nextLevel: mixed3,
  };
};
