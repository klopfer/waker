// cutsceneDisplacement — the "pre-world 1" interstitial card. The avatar
// walks across a flat floor over the title card to the exit, which
// advances to displacement0. Mirrors legacy cutsceneDisplacement.mxml
// (Settings.isItACutScene = true, setBG(preDisplacementCutScene),
// setGround(cutScene_collision), entrance (0,460), exit (700,479)).
//
// The legacy initLvl() sets `soundManager.currentMusic = "cutScene01"` —
// the narrated story track — not the world BGM. We mirror that with the
// `bgmCutscene01` key so the walk-across plays its little story.

import type { LevelBuilder, LevelConfig } from '../game/Level.js';
import { displacement0 } from './displacement0.js';

export const cutsceneDisplacement: LevelBuilder = (): LevelConfig => ({
  isCutScene: true,
  bgKey: 'preDisplacementCutScene',
  groundKey: 'cutScene_collision',
  bgmKey: 'bgmCutscene01',
  spawn: { x: 20, y: 460 },
  exit: { x: 700, y: 479 },
  orbs: [],
  nextLevel: displacement0,
});
