// mixed3 — the final gameplay level (legacy `Settings.gameEnds = true`).
// Mixes a velocity orb + a heavily-obstacle-populated displacement orb,
// one switch-controlled platform, and a hard-only horizontal-sweep spike.
// Numbers from `legacy/src/levels/mixed3.mxml`.
//
// Layout:
//   spawn (0,400), exit (700,195).
//   Velocity orb (always present): graph (150,1) 500×500, maxValue=40,
//   yOffset=160, orb (700,460), no origin holder.
//   Displacement orb (always): graph (150,1) 500×500, maxValue=700,
//   yOffset=140, orb (60,457), origin (60,441). Obstacles: hard=6 /
//   medium=4 / easy=3.
//   Switch (60,185) flips a single platform at (640,30) 20×200 (a tall
//   blocker the player must move out of the way).
//   Hard adds a horizontal-sweep spike at (150,480) sweeping 170..620 at
//   speed 9.
//
// `nextLevel` is intentionally UNSET — the legacy chains to `gameending`
// (an ending video + endgame music) which isn't built yet. For now,
// reaching the exit dead-ends (the chain's terminal point).

import { obstaclesForDifficulty } from '../game/GraphObstacles.js';
import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import type { SpikeConfig } from '../game/Spike.js';

export const mixed3: LevelBuilder = (difficulty): LevelConfig => {
  const spikes: SpikeConfig[] = [];

  if (difficulty === 3) {
    spikes.push({
      x: 150,
      y: 480,
      isMoving: true,
      horizontal: true,
      upOrLeft: true,
      turn: 170,
      turn2: 620,
      speed: 9,
    });
  }

  const dObsCount = difficulty === 3 ? 6 : difficulty === 2 ? 4 : 3;
  spikes.push(
    ...obstaclesForDifficulty(
      { x: 150, y: 1, width: 500, height: 500 },
      /* seed */ 34,
      /* hardCount */ 6,
      dObsCount,
    ).map((p): SpikeConfig => ({ x: p.x, y: p.y, style: 'graph' })),
  );

  return {
    bgKey: 'bgWorld3_4',
    groundKey: 'levelm6_collision',
    bgmKey: 'bgmWorld3',

    spawn: { x: 0, y: 400 },
    exit: { x: 700, y: 195 },

    orbs: [
      // Velocity orb (always). addGraph(1,0,150,1,40,500,500,160,700,460,…).
      {
        valueMode: 'velocity',
        origin: { x: 700, y: 460 },
        orb: { x: 700, y: 448 },
        graph: { x: 150, y: 1, width: 500, height: 500, maxValue: 40, yOffset: 160 },
      },
      // Displacement orb (always). addGraph(0,0,150,1,700,500,500,140,60,457,0,60,441,…).
      {
        origin: { x: 60, y: 441 },
        orb: { x: 60, y: 429 },
        graph: { x: 150, y: 1, width: 500, height: 500, maxValue: 700, yOffset: 140 },
        cradle: { lift: 12, halfWidth: 18 },
      },
    ],

    // addSwitch(60,185, 640,30,false,false,20,200) — one tall vertical
    // platform that opens a gap toward the exit.
    switches: [
      {
        switch: { x: 60, y: 185 },
        platforms: [
          { x: 640, y: 30, width: 20, height: 200, horizontal: false, upOrLeft: false },
        ],
      },
    ],

    spikes,

    // nextLevel: gameending — wired once the ending video is built.
  };
};
