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
import { mixed0 } from './levels/mixed0.js';
import { mixed1 } from './levels/mixed1.js';
import { mixed2 } from './levels/mixed2.js';
import { mixed3 } from './levels/mixed3.js';
import { cutsceneDisplacement } from './levels/cutsceneDisplacement.js';
import { cutsceneVelocity } from './levels/cutsceneVelocity.js';
import { cutsceneMixed } from './levels/cutsceneMixed.js';
import { makeDifficultyPicker } from './ui/DifficultyPicker.js';
import { makeLevelPicker } from './ui/LevelPicker.js';
import { makeMuteControls } from './ui/MuteControls.js';
import { makeMainMenu } from './ui/MainMenu.js';
import { makeImageScreen } from './ui/ImageScreen.js';
import { makeDifficultyScreen } from './ui/DifficultyScreen.js';
import { makeVideoOverlay } from './ui/VideoOverlay.js';
import { makePauseMenu } from './ui/PauseMenu.js';
import { makeSplashScreens } from './ui/SplashScreens.js';

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

// Initial visibility of the development chrome: top controls banner + the
// bottom-row mute toggles + level/difficulty pickers. Default OFF since the
// in-game pause menu (Esc) now exposes mute + difficulty in the polished UI.
// Players can re-enable the dev chrome from the pause menu's "Debug UI"
// toggle (useful for level-skip during playtest).
const DEBUG_UI_DEFAULT_VISIBLE = false;

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

  // ── Level manager handles initial load + transitions on win ──
  // No level is started until the player picks "Start" on the menu; the
  // sim loop's levels.tick() is a no-op while no level is loaded.
  const levels = new LevelManager();
  const deps = { app, assets, avatar, audio, input };

  // ── Development chrome (runtime-toggleable from the pause menu) ──
  // Top controls banner + bottom-row mute toggles + level/difficulty
  // pickers. Always mounted, but visibility is gated by debugVisible so
  // the player can toggle it from the in-game pause menu.
  const debugLabel = new Text({
    text:
      'Waker — displacement0 (tutorial): orb pickup + graph drawing\n' +
      'arrows: walk   |   S/shift: sprint   |   space/up: jump   |   D: pick up / drop orb   |   R: restart',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 13, align: 'center' },
  });
  debugLabel.anchor.set(0.5, 0);
  debugLabel.x = STAGE_WIDTH / 2;
  debugLabel.y = 12;
  debugLabel.zIndex = 1000;
  app.stage.addChild(debugLabel);

  const muteCtl = makeMuteControls(audio);
  muteCtl.x = STAGE_WIDTH - muteCtl.width - 8;
  muteCtl.y = STAGE_HEIGHT - 30;
  muteCtl.zIndex = 1000;
  app.stage.addChild(muteCtl);

  const levelPicker = makeLevelPicker(levels, [
    { label: 'D0', builder: displacement0 },
    { label: 'D1', builder: displacement1 },
    { label: 'D2', builder: displacement2 },
    { label: 'D3', builder: displacement3 },
    { label: 'V0', builder: velocity0 },
    { label: 'V1', builder: velocity1 },
    { label: 'V2', builder: velocity2 },
    { label: 'V3', builder: velocity3 },
    { label: 'M0', builder: mixed0 },
    { label: 'M1', builder: mixed1 },
    { label: 'M2', builder: mixed2 },
    { label: 'M3', builder: mixed3 },
    { label: 'CD', builder: cutsceneDisplacement },
    { label: 'CV', builder: cutsceneVelocity },
    { label: 'CM', builder: cutsceneMixed },
  ]);
  levelPicker.x = 8;
  levelPicker.y = STAGE_HEIGHT - 30;
  levelPicker.zIndex = 1000;
  app.stage.addChild(levelPicker);

  const diffPicker = makeDifficultyPicker(levels);
  diffPicker.x = levelPicker.x + levelPicker.width + 12;
  diffPicker.y = STAGE_HEIGHT - 30;
  diffPicker.zIndex = 1000;
  app.stage.addChild(diffPicker);

  let debugVisible = DEBUG_UI_DEFAULT_VISIBLE;
  const applyDebugVisible = (): void => {
    debugLabel.visible = debugVisible;
    muteCtl.visible = debugVisible;
    levelPicker.visible = debugVisible;
    diffPicker.visible = debugVisible;
    levels.setDebugReadoutVisible(debugVisible);
  };
  applyDebugVisible();

  // ── Sim loop ──
  // The pause menu pauses the sim by setting `simPaused` true. While
  // paused, deltaMS is still drained by FixedStep (so unpausing doesn't
  // emit a huge time step), but no tick() is called.
  let simPaused = false;
  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    if (simPaused) return;
    for (let i = 0; i < steps; i++) levels.tick();
  });

  // ── Menu / app flow (HTML overlay) ──
  // boot → main menu → Start → (intro video, first time) → the level chain
  // starting at cutsceneDisplacement. Instructions / Credits / Settings
  // open over the menu; Esc closes whichever screen is open.
  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) throw new Error('#ui-root not found');

  const splash = makeSplashScreens(assets, audio);
  const intro = makeVideoOverlay(assets, 'introCutScene');
  const instructions = makeImageScreen(assets, 'guiInstructionScreen', () => menu.show());
  const credits = makeImageScreen(assets, 'guiCreditsScreen', () => menu.show());
  const settings = makeDifficultyScreen(
    assets,
    audio,
    () => levels.difficulty,
    (d) => void levels.setDifficulty(d),
    () => menu.show(),
  );

  // "Wisp obtained" level-complete animation. Silent (the win sting is
  // played as an SFX inside Level); auto-advances when it ends. Wired as
  // the LevelManager's win presenter so every non-cutscene level shows it
  // before transitioning to the next.
  const levelComplete = makeVideoOverlay(assets, 'levelCompleteClass', {
    muted: true,
    hint: 'click / space to continue ▶',
  });
  levels.winPresenter = (done): void => levelComplete.play(done);

  // Ending cutscene — plays once after mixed3 (the `gameEnds` level)
  // completes. After it ends, the player is returned to the main menu.
  const ending = makeVideoOverlay(assets, 'endingCutSceneClass', {
    hint: 'click / space to continue ▶',
  });
  levels.endingPresenter = (done): void => {
    audio.stopBgm();
    audio.playBgm('bgmEndGame', assets.url('bgmEndGame'));
    ending.play(() => {
      audio.stopBgm();
      done();
      menu.show();
    });
  };

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
        // The story narration begins on the (silent) intro video and keeps
        // playing into the walk-across cutscene, which requests the same
        // 'voCS1' track (de-duped, so it doesn't restart). It is cut when
        // displacement0 begins. The Start click is the gesture that unlocks
        // audio. See cutsceneDisplacement.ts / Level.startAudio().
        audio.playVo('voCS1', assets.url('voCS1'));
        intro.play(startChain);
      }
    },
    onInstructions: () => instructions.show(),
    onSettings: () => settings.show(),
    onCredits: () => credits.show(),
  });

  // ── In-game pause menu (Esc during gameplay) ──
  const pauseMenu = makePauseMenu(audio, {
    onResume: () => {
      pauseMenu.hide();
      simPaused = false;
    },
    onRestart: () => {
      const builder = levels.builder;
      if (!builder) return;
      pauseMenu.hide();
      simPaused = false;
      void levels.advanceTo(builder);
    },
    onQuit: () => {
      pauseMenu.hide();
      simPaused = false;
      audio.stopBgm();
      audio.stopVo();
      levels.quit();
      menu.show();
    },
    getDifficulty: () => levels.difficulty,
    setDifficulty: (d) => void levels.setDifficulty(d),
    getDebugVisible: () => debugVisible,
    setDebugVisible: (v) => {
      debugVisible = v;
      applyDebugVisible();
    },
  });

  // All overlays share #ui-root and toggle `display`. Stack them with
  // explicit z-index instead of relying on DOM order: the menu sits at the
  // base, the sub-screens (instructions/credits/settings) paint on top of
  // it when shown, and videos are above everything except the pause menu
  // (which sits at the top so Esc can interrupt anything).
  menu.el.style.zIndex = '1';
  for (const s of [instructions.el, credits.el, settings.el]) s.style.zIndex = '10';
  intro.el.style.zIndex = '20';
  levelComplete.el.style.zIndex = '20';
  ending.el.style.zIndex = '20';
  pauseMenu.el.style.zIndex = '30';
  // Splash sits on top of everything at boot, then yields to the menu.
  splash.el.style.zIndex = '40';
  for (const el of [
    menu.el,
    instructions.el,
    credits.el,
    settings.el,
    intro.el,
    levelComplete.el,
    ending.el,
    pauseMenu.el,
    splash.el,
  ]) {
    uiRoot.appendChild(el);
  }
  // Boot flow: studio splash (gambit → poof) → main menu.
  splash.play(() => menu.show());

  // Esc behavior depends on context:
  //  - A main-menu sub-screen open → close it (back to main menu).
  //  - A level is loaded AND no menu is open → toggle the pause menu.
  //  - Otherwise → no-op.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (instructions.visible) {
      instructions.hide();
      menu.show();
      return;
    }
    if (credits.visible) {
      credits.hide();
      menu.show();
      return;
    }
    if (settings.visible) {
      settings.hide();
      menu.show();
      return;
    }
    if (pauseMenu.visible) {
      pauseMenu.hide();
      simPaused = false;
      return;
    }
    if (levels.hasLevel) {
      pauseMenu.show();
      simPaused = true;
    }
  });

  console.log('Waker ready: boot → menu → chain.');
}

void main();
