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
import { displacement0 } from './levels/displacement0.js';
import { displacement1 } from './levels/displacement1.js';
import { displacement2 } from './levels/displacement2.js';
import { displacement3 } from './levels/displacement3.js';
import { velocity0 } from './levels/velocity0.js';
import { velocity1 } from './levels/velocity1.js';
import { velocity2 } from './levels/velocity2.js';
import { velocity3 } from './levels/velocity3.js';
import { cutsceneDisplacement } from './levels/cutsceneDisplacement.js';
import { cutsceneVelocity } from './levels/cutsceneVelocity.js';
import { cutsceneMixed } from './levels/cutsceneMixed.js';
import { makeDifficultyPicker } from './ui/DifficultyPicker.js';
import { makeLevelPicker } from './ui/LevelPicker.js';
import { makeMuteControls } from './ui/MuteControls.js';
import { makeMainMenu } from './ui/MainMenu.js';
import { makeImageScreen } from './ui/ImageScreen.js';
import { makeDifficultyScreen } from './ui/DifficultyScreen.js';
import { makeIntroVideo } from './ui/IntroVideo.js';

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
  'KeyR',
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
  // Sort stage children by zIndex on each render so the persistent
  // chrome (instructions banner, mute toggles, level picker, diff
  // picker) stays on top of level-owned objects added later by
  // Level.load(). Without this, switching levels via the debug
  // picker would re-add the new level's bg AFTER the chrome,
  // hiding the buttons behind it.
  app.stage.sortableChildren = true;

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
      'arrows: walk   |   S/shift: sprint   |   space/up: jump   |   D: pick up / drop orb   |   R: restart',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 13, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 12;
  label.zIndex = 1000;
  app.stage.addChild(label);

  // ── Level manager handles initial load + transitions on win ──
  // No level is started until the player picks "Start" on the menu; the
  // sim loop's levels.tick() is a no-op while no level is loaded.
  const levels = new LevelManager();
  const deps = { app, assets, avatar, audio, input };

  // ── Mute controls (TEMPORARY Pixi-side UI, see ui/MuteControls.ts) ──
  // Bottom-right corner; clear of the centered debug tick readout below
  // and the graph rect above. Added AFTER LevelManager so the controls
  // draw on top of any level-owned objects in that corner.
  const mute = makeMuteControls(audio);
  mute.x = STAGE_WIDTH - mute.width - 8;
  mute.y = STAGE_HEIGHT - 30;
  mute.zIndex = 1000;
  app.stage.addChild(mute);

  // ── TEMPORARY level picker (debug only) ──
  // Bottom-LEFT corner so it stays clear of the mute toggles on the
  // right. Remove this + src/ui/LevelPicker.ts once the proper menu /
  // difficulty selector lands in Phase 5.
  const picker = makeLevelPicker(levels, [
    { label: 'D0', builder: displacement0 },
    { label: 'D1', builder: displacement1 },
    { label: 'D2', builder: displacement2 },
    { label: 'D3', builder: displacement3 },
    { label: 'V0', builder: velocity0 },
    { label: 'V1', builder: velocity1 },
    { label: 'V2', builder: velocity2 },
    { label: 'V3', builder: velocity3 },
    { label: 'CD', builder: cutsceneDisplacement },
    { label: 'CV', builder: cutsceneVelocity },
    { label: 'CM', builder: cutsceneMixed },
  ]);
  picker.x = 8;
  picker.y = STAGE_HEIGHT - 30;
  picker.zIndex = 1000;
  app.stage.addChild(picker);

  // ── TEMPORARY difficulty picker (debug only) ──
  // Single button that cycles EASY → MEDIUM → HARD → EASY and reloads
  // the current level at the new difficulty (so per-difficulty content
  // like hard-mode spikes becomes visible for placement verification).
  // To the right of the level picker.
  const diffPicker = makeDifficultyPicker(levels);
  diffPicker.x = picker.x + picker.width + 12;
  diffPicker.y = STAGE_HEIGHT - 30;
  diffPicker.zIndex = 1000;
  app.stage.addChild(diffPicker);

  // ── Sim loop ──
  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) levels.tick();
  });

  // ── Menu / app flow (HTML overlay) ──
  // boot → main menu → Start → (intro video, first time) → the level chain
  // starting at cutsceneDisplacement. Instructions / Credits / Settings
  // open over the menu; Esc closes whichever screen is open.
  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) throw new Error('#ui-root not found');

  const intro = makeIntroVideo(assets);
  const instructions = makeImageScreen(assets, 'guiInstructionScreen', () => menu.show());
  const credits = makeImageScreen(assets, 'guiCreditsScreen', () => menu.show());
  const settings = makeDifficultyScreen(
    assets,
    () => levels.difficulty,
    (d) => void levels.setDifficulty(d),
    () => menu.show(),
  );

  let introSeen = false;
  const startChain = (): void => {
    void levels.start(cutsceneDisplacement, deps, levels.difficulty);
  };

  const menu = makeMainMenu(assets, {
    onPlay: () => {
      menu.hide();
      if (introSeen) {
        startChain();
      } else {
        introSeen = true;
        intro.play(startChain);
      }
    },
    onInstructions: () => instructions.show(),
    onSettings: () => settings.show(),
    onCredits: () => credits.show(),
  });

  // All overlays share #ui-root and toggle `display`. Stack them with
  // explicit z-index instead of relying on DOM order: the menu sits at the
  // base, the sub-screens (instructions/credits/settings) paint on top of
  // it when shown, and the intro video is above everything.
  menu.el.style.zIndex = '1';
  for (const s of [instructions.el, credits.el, settings.el]) s.style.zIndex = '10';
  intro.el.style.zIndex = '20';
  for (const el of [menu.el, instructions.el, credits.el, settings.el, intro.el]) {
    uiRoot.appendChild(el);
  }
  menu.show();

  // Esc closes whichever menu screen is open.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (instructions.visible) {
      instructions.hide();
      menu.show();
    } else if (credits.visible) {
      credits.hide();
      menu.show();
    } else if (settings.visible) {
      settings.hide();
      menu.show();
    }
  });

  console.log('Waker ready: boot → menu → chain.');
}

void main();
