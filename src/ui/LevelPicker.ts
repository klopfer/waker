// TEMPORARY testing UI: pinned to the bottom-center of the stage, lets
// the user jump directly to any wired level. Same Pixi-side approach as
// MuteControls (Phase 5 will replace both with the HTML+CSS HUD).
//
// REMOVE this file + its main.ts hookup once the difficulty selector
// and proper menu nav are in place.

import { Container, Graphics, Text } from 'pixi.js';
import type { LevelManager } from '../game/LevelManager.js';
import type { LevelConfig } from '../game/Level.js';

export interface LevelPickerEntry {
  /** Short label shown on the button ("L1", "D0", etc.). */
  label: string;
  cfg: LevelConfig;
}

const BUTTON_W = 36;
const BUTTON_H = 22;
const GAP = 4;
const RADIUS = 4;
const PAD = 4;

const BG_COLOR = 0x000000;
const BG_ALPHA = 0.45;
const BG_ALPHA_HOVER = 0.7;
const TEXT_COLOR = 0xffffff;

function makeButton(label: string, onClick: () => void): Container {
  const c = new Container();
  c.eventMode = 'static';
  c.cursor = 'pointer';

  const bg = new Graphics()
    .roundRect(0, 0, BUTTON_W, BUTTON_H, RADIUS)
    .fill({ color: BG_COLOR, alpha: BG_ALPHA });
  c.addChild(bg);

  const text = new Text({
    text: label,
    style: { fill: TEXT_COLOR, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  });
  text.anchor.set(0.5, 0.5);
  text.x = BUTTON_W / 2;
  text.y = BUTTON_H / 2;
  c.addChild(text);

  c.on('pointerover', () => {
    bg.clear()
      .roundRect(0, 0, BUTTON_W, BUTTON_H, RADIUS)
      .fill({ color: BG_COLOR, alpha: BG_ALPHA_HOVER });
  });
  c.on('pointerout', () => {
    bg.clear()
      .roundRect(0, 0, BUTTON_W, BUTTON_H, RADIUS)
      .fill({ color: BG_COLOR, alpha: BG_ALPHA });
  });
  c.on('pointerdown', () => {
    onClick();
  });

  return c;
}

/**
 * Build a level-picker Container — N buttons in a row, plus a small
 * "DEBUG" label so it's visually obvious this is testing-only UI.
 * Position via the returned container's x/y; the assembly's `.width`
 * reflects the actual rendered width so callers can right-align.
 */
export function makeLevelPicker(
  levels: LevelManager,
  entries: readonly LevelPickerEntry[],
): Container {
  const root = new Container();

  const labelText = new Text({
    text: 'DEBUG:',
    style: { fill: 0xffaa66, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  });
  labelText.anchor.set(0, 0.5);
  labelText.x = 0;
  labelText.y = BUTTON_H / 2;
  root.addChild(labelText);

  let x = labelText.width + PAD * 2;
  for (const entry of entries) {
    const b = makeButton(entry.label, () => {
      void levels.advanceTo(entry.cfg);
    });
    b.x = x;
    root.addChild(b);
    x += BUTTON_W + GAP;
  }

  return root;
}
