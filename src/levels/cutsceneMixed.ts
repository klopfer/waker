// cutsceneMixed — the "pre-world 3" interstitial card; walk across to the
// exit → mixed0. Mirrors legacy cutsceneMixed.mxml.
//
// nextLevel is UNSET until the mixed world (mixed0–3) is built — for now
// reaching the exit just restarts this card (a clean "end of what's
// built" placeholder). bgmKey is bgmWorld2 as a placeholder (no world-3
// BGM wired yet).

import type { LevelBuilder, LevelConfig } from '../game/Level.js';

export const cutsceneMixed: LevelBuilder = (): LevelConfig => ({
  isCutScene: true,
  bgKey: 'preMixedCutScene',
  groundKey: 'cutScene_collision',
  bgmKey: 'bgmWorld2',
  spawn: { x: 20, y: 460 },
  exit: { x: 700, y: 479 },
  orbs: [],
  // nextLevel: mixed0 — wired once the mixed world is built.
});
