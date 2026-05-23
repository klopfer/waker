// cutsceneMixed — the "pre-world 3" interstitial card; walk across to the
// exit → mixed0. Mirrors legacy cutsceneMixed.mxml.
//
// Music + narration mirror legacy (currentMusic = "cutScene03" →
// bgmCutscene01 music + voCS3 narration). The walk-across leads into the
// mixed world (mixed0).

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import { mixed0 } from './mixed0.js';

export const cutsceneMixed: LevelBuilder = (): LevelConfig => ({
  isCutScene: true,
  bgKey: 'preMixedCutScene',
  groundKey: 'cutScene_collision',
  bgmKey: 'bgmCutscene01',
  voKey: 'voCS3',
  spawn: { x: 20, y: 460 },
  exit: { x: 700, y: 479 },
  orbs: [],
  nextLevel: mixed0,
});
