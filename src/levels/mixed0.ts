// mixed0 — world 3 tutorial. First level to combine BOTH orb types AND
// switch-controlled moving platforms. Numbers from
// `legacy/src/levels/mixed0.mxml`.
//
// Layout (per legacy spawn/exit + addSwitch coords):
//   spawn (200,400) — mid-low area on the painted floor.
//   exit  (380,239) — mid-high.
//   Two switches: one at (20,91) flips two vertical platforms at
//   (310,160) and (470,160), each 20×200; one at (740,91) flips two
//   shorter vertical platforms at (350,200) and (430,200), each 20×80.
//   One static spike at (590,180) (legacy addSpike isMoving=false).
//   Hard adds two horizontal-sweep spikes along y=480, x=100 and x=200,
//   each sweeping 0..777 at speed 13.
//   Orbs (all difficulties): displacement orb origin (370,439) +
//   velocity orb at (370,320). Graph obstacles on the displacement orb:
//   hard=2, medium=1, easy=1.

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';
import { mixed1 } from './mixed1.js';

export const mixed0: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [{ x: 590, y: 180, isMoving: false }];

  if (difficulty === 3) {
    spikes.push({
      x: 100,
      y: 480,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 0,
      turn2: 777,
      speed: 13,
    });
    spikes.push({
      x: 200,
      y: 480,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 0,
      turn2: 777,
      speed: 13,
    });
  }

  // Displacement-orb graph obstacles: hard=2 / medium=1 / easy=1.
  const dObsCount = difficulty === 3 ? 2 : 1;
  spikes.push(
    ...obstaclesForDifficulty(
      { x: 80, y: 99, width: 180, height: 180 },
      /* seed */ 30,
      /* hardCount */ 2,
      dObsCount,
    ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' })),
  );

  return {
    bgKey: 'bgWorld3_1',
    groundKey: 'levelm5_collision',
    bgmKey: 'bgmWorld3',

    spawn: { x: 200, y: 400 },
    exit: { x: 380, y: 239 },

    // Orb 1 — DISPLACEMENT. addGraph(0,0,80,99,330,180,180,40,370,456,0,370,439,…).
    // Orb 2 — VELOCITY.     addGraph(1,0,517,99,14,180,180,40,370,320,0,0,0,0,0).
    orbs: [
      {
        origin: { x: 370, y: 439 },
        orb: { x: 370, y: 427 },
        graph: { x: 80, y: 99, width: 180, height: 180, maxValue: 330, yOffset: 40 },
        cradle: { lift: 12, halfWidth: 18 },
      },
      {
        valueMode: 'velocity',
        origin: { x: 370, y: 320 },
        orb: { x: 370, y: 308 },
        graph: { x: 517, y: 99, width: 180, height: 180, maxValue: 14, yOffset: 40 },
      },
    ],

    // Two switches, each toggling two vertical platforms.
    switches: [
      {
        switch: { x: 20, y: 91 },
        platforms: [
          { x: 310, y: 160, width: 20, height: 200, horizontal: false, upOrLeft: false },
          { x: 470, y: 160, width: 20, height: 200, horizontal: false, upOrLeft: false },
        ],
      },
      {
        switch: { x: 740, y: 91 },
        platforms: [
          { x: 350, y: 200, width: 20, height: 80, horizontal: false, upOrLeft: false },
          { x: 430, y: 200, width: 20, height: 80, horizontal: false, upOrLeft: false },
        ],
      },
    ],

    spikes,

    nextLevel: mixed1,
  };
};
