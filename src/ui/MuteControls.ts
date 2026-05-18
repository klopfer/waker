// Two small clickable toggles pinned wherever the caller wants on the
// stage. Mute / unmute BGM and SFX independently. Reads current state
// directly from `audio.config` so the visual stays in sync with the
// source of truth even if mute is toggled elsewhere.
//
// TEMPORARY: lives in Pixi for now because the rest of the in-game UI
// (instructions banner, prompts, win overlay) is also Pixi. Phase 5
// replaces this with an HTML+CSS overlay per CLAUDE.md (`UI layer = plain
// HTML+CSS over the canvas`). When that happens, delete this file and
// wire the same Audio methods from the HTML side.

import { Container, Graphics, Text } from 'pixi.js';
import type { Audio } from '../engine/Audio.js';

const TOGGLE_W = 78;
const TOGGLE_H = 22;
const GAP = 6;
const RADIUS = 4;
const PAD = 4;

const BG_COLOR = 0x000000;
const BG_ALPHA = 0.45;
const BG_ALPHA_HOVER = 0.65;
const TEXT_COLOR = 0xffffff;
const ACTIVE_ALPHA = 1;
const MUTED_ALPHA = 0.45;
const STRIKE_COLOR = 0xff5a5a;
const STRIKE_WIDTH = 2;

function makeToggle(label: string, isMuted: () => boolean, toggle: () => void): Container {
  const c = new Container();
  c.eventMode = 'static';
  c.cursor = 'pointer';

  const bg = new Graphics()
    .roundRect(0, 0, TOGGLE_W, TOGGLE_H, RADIUS)
    .fill({ color: BG_COLOR, alpha: BG_ALPHA });
  c.addChild(bg);

  const text = new Text({
    text: label,
    style: { fill: TEXT_COLOR, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  });
  text.anchor.set(0.5, 0.5);
  text.x = TOGGLE_W / 2;
  text.y = TOGGLE_H / 2;
  c.addChild(text);

  const strike = new Graphics()
    .moveTo(PAD, TOGGLE_H - PAD)
    .lineTo(TOGGLE_W - PAD, PAD)
    .stroke({ color: STRIKE_COLOR, width: STRIKE_WIDTH });
  c.addChild(strike);

  const sync = (): void => {
    const m = isMuted();
    text.alpha = m ? MUTED_ALPHA : ACTIVE_ALPHA;
    strike.visible = m;
  };
  sync();

  c.on('pointerover', () => {
    bg.clear()
      .roundRect(0, 0, TOGGLE_W, TOGGLE_H, RADIUS)
      .fill({ color: BG_COLOR, alpha: BG_ALPHA_HOVER });
  });
  c.on('pointerout', () => {
    bg.clear()
      .roundRect(0, 0, TOGGLE_W, TOGGLE_H, RADIUS)
      .fill({ color: BG_COLOR, alpha: BG_ALPHA });
  });
  c.on('pointerdown', () => {
    toggle();
    sync();
  });

  return c;
}

/**
 * Build a Pixi Container with two mute toggles ("MUSIC" and "SFX"). The
 * returned container's `x`/`y` is the top-left of the assembly; the
 * caller positions it wherever it wants on the stage.
 */
export function makeMuteControls(audio: Audio): Container {
  const root = new Container();
  const music = makeToggle(
    '♪ MUSIC',
    () => audio.config.bgmMute,
    () => audio.setBgmMute(!audio.config.bgmMute),
  );
  music.x = 0;
  root.addChild(music);
  const sfx = makeToggle(
    '♪ SFX',
    () => audio.config.sfxMute,
    () => audio.setSfxMute(!audio.config.sfxMute),
  );
  sfx.x = TOGGLE_W + GAP;
  root.addChild(sfx);
  return root;
}
