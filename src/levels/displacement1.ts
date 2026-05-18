// displacement1 — second level (first after the tutorial). The legacy
// game's "first real level" with the orb mechanic.
//
// All numeric constants come from `legacy/src/levels/displacement1.mxml`
// plus pngjs measurements of `leveld1_ground.png` for floor heights and
// `leveld1_bg.png` for the sun centroid. See `docs/calibration.md`
// §7 for the displacement0 derivation; this is the same approach.
//
// Layout (from the ground sweep):
//   x=0..50   → topmost-solid y=440 (left entrance ledge)
//   x=100..600 → topmost-solid y=498 (main middle platform)
//   x=700..780 → topmost-solid y=235 (upper-right exit ledge)
// Avatar must climb from the middle platform up to the exit ledge via
// the orb-drawn graph curve. Origin marker sits at (200, 498) on the
// middle platform.
//
// We ship the easy-mode config (Settings.LEVEL_DIFFICULTY == 1 in the
// legacy code). Hard mode adds a horizontally-moving spike at y=480;
// that lands when the difficulty selector wires up in Phase 5.

import type { LevelConfig } from '../game/Level.js';

export const DISPLACEMENT1: LevelConfig = {
  bgKey: 'bgWorld1_1',
  groundKey: 'leveld1_collision',
  bgmKey: 'bgmWorld1',

  // setEntrance(0, 390). The avatar drops in from the upper-left and
  // lands on the left ledge (topmost-solid y=440 at x=0..50). Spawn x
  // matches displacement0's pattern (above the left edge); y=0 lets
  // gravity handle the drop.
  spawn: { x: 30, y: 0 },

  // setExit(740, 195). Top-right of the upper exit ledge (topmost-solid
  // y=235 at x=700..780).
  exit: { x: 740, y: 195 },

  // From super.addGraph(0, 0, 308, 200, 400, 300, 300, 100, 200, 430, 0, 200, 438, 1, 20):
  //   graphX=308, graphY=200, scale(maxValue)=400, width=300, height=300,
  //   offset=100, orbX=200, orbY=430 (Flash top-left), originX=200,
  //   originY=438 (Flash top-left)
  //
  // Origin Y in our port: bottom-anchor; the middle platform's
  // topmost-solid y at x=200 is 498 (measured via pngjs sweep).
  origin: { x: 200, y: 498 },
  // Orb sits in cradle: ORIGIN.y - cradle.lift = 498 - 12 = 486
  orb: { x: 200, y: 486 },

  graph: {
    x: 308,
    y: 200,
    width: 300,
    height: 300,
    maxValue: 400,
    yOffset: 100,
  },

  cradle: {
    lift: 12,
    halfWidth: 18,
  },

  // Sun centroid in `leveld1_bg.png`, measured by pngjs sweep of pure-white
  // pixels in the upper-left quadrant.
  sunCentroid: { x: 118, y: 109 },

  // (omit showHelpPrompts → defaults false; the player has learned D
  // and SPACE in displacement0.)
};
