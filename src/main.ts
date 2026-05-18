// Engine driver. Sets up the Pixi app, shared singletons (assets,
// audio, input, avatar, fixed-step), instantiates the current level,
// and pumps a 24 Hz fixed-step sim loop.
//
// Per-level data lives in `src/levels/*.ts`. The Level class
// (`src/game/Level.ts`) owns all level-specific objects and logic.
// Adding a new level is data-only — change the `import` below and
// nothing in this file moves.

import { Application, Text } from 'pixi.js';
import { AssetLoader } from './engine/AssetLoader.js';
import { Audio } from './engine/Audio.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { Avatar } from './game/Avatar.js';
import { LevelManager } from './game/LevelManager.js';
import { DISPLACEMENT0 } from './levels/displacement0.js';
import { DISPLACEMENT1 } from './levels/displacement1.js';
import { DISPLACEMENT2 } from './levels/displacement2.js';
import { DISPLACEMENT3 } from './levels/displacement3.js';
import { makeLevelPicker } from './ui/LevelPicker.js';
import { makeMuteControls } from './ui/MuteControls.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;
// 0.30 was the initial Phase-3 placeholder; the original Flash game's
// avatar reads visually smaller relative to the 800×600 stage. 0.25
// matches the original screenshot more closely. See docs/calibration.md
// §3.2.
const AVATAR_SCALE = 0.25;

const BGM_VOLUME = 0.4;
const SFX_VOLUME = 0.6;

const GAME_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyD',
  'KeyS',
  'ShiftLeft',
  'ShiftRight',
  'Escape',
] as const;

function fitStageToViewport(): void {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const sx = window.innerWidth / STAGE_WIDTH;
  const sy = window.innerHeight / STAGE_HEIGHT;
  const scale = Math.min(sx, sy);
  stage.style.transform = `scale(${scale})`;
}

async function main(): Promise<void> {
  fitStageToViewport();
  window.addEventListener('resize', fitStageToViewport);

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game canvas not found');

  const app = new Application();
  await app.init({
    canvas,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundColor: 0x111418,
    antialias: true,
  });

  // ── Shared engine singletons ──
  const assets = new AssetLoader();
  const audio = new Audio({ bgmVolume: BGM_VOLUME, sfxVolume: SFX_VOLUME });
  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const avatar = await Avatar.preload(AVATAR_SCALE);
  const sim = new FixedStep({ hz: SIM_HZ });

  // ── Top-of-screen instructions banner (could move into Level if it
  //    starts becoming level-specific, but for now it's a generic
  //    "what are the controls" thing) ──
  const label = new Text({
    text:
      'Waker — displacement0 (tutorial): orb pickup + graph drawing\n' +
      'arrows: walk   |   S/shift: sprint   |   space/up: jump   |   D: pick up / drop orb',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 13, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 12;
  app.stage.addChild(label);

  // ── Level manager handles initial load + transitions on win ──
  const levels = new LevelManager();
  await levels.start(DISPLACEMENT0, { app, assets, avatar, audio, input });

  // ── Mute controls (TEMPORARY Pixi-side UI, see ui/MuteControls.ts) ──
  // Bottom-right corner; clear of the centered debug tick readout below
  // and the graph rect above. Added AFTER LevelManager so the controls
  // draw on top of any level-owned objects in that corner.
  const mute = makeMuteControls(audio);
  mute.x = STAGE_WIDTH - mute.width - 8;
  mute.y = STAGE_HEIGHT - 30;
  app.stage.addChild(mute);

  // ── TEMPORARY level picker (debug only) ──
  // Bottom-LEFT corner so it stays clear of the mute toggles on the
  // right. Remove this + src/ui/LevelPicker.ts once the proper menu /
  // difficulty selector lands in Phase 5.
  const picker = makeLevelPicker(levels, [
    { label: 'D0', cfg: DISPLACEMENT0 },
    { label: 'D1', cfg: DISPLACEMENT1 },
    { label: 'D2', cfg: DISPLACEMENT2 },
    { label: 'D3', cfg: DISPLACEMENT3 },
  ]);
  picker.x = 8;
  picker.y = STAGE_HEIGHT - 30;
  app.stage.addChild(picker);

  // ── Sim loop ──
  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) levels.tick();
  });

  console.log('Waker ready: displacement0 → displacement1 wired up.');
}

void main();
