// cutsceneVelocity — the "pre-world 2" interstitial card; walk across to
// the exit → velocity0. Mirrors legacy cutsceneVelocity.mxml.

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import { velocity0 } from './velocity0.js';

export const cutsceneVelocity: LevelBuilder = (): LevelConfig => ({
  isCutScene: true,
  bgKey: 'preVelocityCutScene',
  groundKey: 'cutScene_collision',
  bgmKey: 'bgmWorld2',
  spawn: { x: 20, y: 460 },
  exit: { x: 700, y: 479 },
  orbs: [],
  nextLevel: velocity0,
});
