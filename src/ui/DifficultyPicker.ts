// TEMPORARY testing UI: single button next to the level picker that
// cycles through Easy → Medium → Hard → Easy. Clicking reloads the
// current level at the new difficulty so per-difficulty content
// (e.g., hard-mode spikes from displacement*.mxml) becomes visible
// for placement verification.
//
// REMOVE this file + its main.ts hookup once the proper difficulty
// selector lands in the Phase 5 menu UI.

import { Container, Graphics, Text } from 'pixi.js';
import type { LevelManager } from '../game/LevelManager.js';
import type { Difficulty } from '../engine/types.js';

const BUTTON_W = 80;
const BUTTON_H = 22;
const RADIUS = 4;

const BG_COLOR = 0x000000;
const BG_ALPHA = 0.45;
const BG_ALPHA_HOVER = 0.7;
const TEXT_COLOR_EASY = 0x88ff88;
const TEXT_COLOR_MEDIUM = 0xffee66;
const TEXT_COLOR_HARD = 0xff7766;

function labelFor(d: Difficulty): { text: string; color: number } {
  switch (d) {
    case 1:
      return { text: 'EASY', color: TEXT_COLOR_EASY };
    case 2:
      return { text: 'MEDIUM', color: TEXT_COLOR_MEDIUM };
    case 3:
      return { text: 'HARD', color: TEXT_COLOR_HARD };
  }
}

function nextDifficulty(d: Difficulty): Difficulty {
  return (d === 3 ? 1 : ((d + 1) as Difficulty));
}

/**
 * Builds a Pixi Container with a single button labeled with the
 * current difficulty. Clicking cycles to the next difficulty and
 * triggers a level reload via LevelManager.setDifficulty.
 */
export function makeDifficultyPicker(levels: LevelManager): Container {
  const root = new Container();
  root.eventMode = 'static';
  root.cursor = 'pointer';

  const bg = new Graphics();
  root.addChild(bg);

  const text = new Text({
    text: '',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  });
  text.anchor.set(0.5, 0.5);
  text.x = BUTTON_W / 2;
  text.y = BUTTON_H / 2;
  root.addChild(text);

  const render = (alpha: number): void => {
    const { text: label, color } = labelFor(levels.difficulty);
    bg.clear().roundRect(0, 0, BUTTON_W, BUTTON_H, RADIUS).fill({ color: BG_COLOR, alpha });
    text.text = `DIFF: ${label}`;
    text.style.fill = color;
  };
  render(BG_ALPHA);

  root.on('pointerover', () => render(BG_ALPHA_HOVER));
  root.on('pointerout', () => render(BG_ALPHA));
  root.on('pointerdown', () => {
    void (async (): Promise<void> => {
      await levels.setDifficulty(nextDifficulty(levels.difficulty));
      render(BG_ALPHA_HOVER);
    })();
  });

  return root;
}
