import { Application, Container, Graphics, Text } from 'pixi.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { preloadAvatarStates, type LoadedAvatarState } from './game/AvatarSprites.js';
import type { AvatarStateName } from './assets/sprites/avatar/manifest.types.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;
const AVATAR_DISPLAY_WIDTH = 80;
const GROUND_Y = STAGE_HEIGHT - 60;

const GAME_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyD',
  'KeyS',
  'Escape',
] as const;

const PRELOAD_STATES: readonly AvatarStateName[] = [
  'idle-left',
  'idle-right',
  'run-left',
  'run-right',
];

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

  const ground = new Graphics().rect(0, GROUND_Y + 1, STAGE_WIDTH, 4).fill(0x2a3140);
  app.stage.addChild(ground);

  const label = new Text({
    text:
      'Waker — Phase 3 milestone\n' +
      'arrows: walk + face   |   click: beep\n' +
      'simulation: 24 Hz fixed step',
    style: { fill: 0xaaaaaa, fontFamily: 'monospace', fontSize: 14, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 16;
  app.stage.addChild(label);

  const tickReadout = new Text({
    text: 'tick 0   state idle-right',
    style: { fill: 0x66ccff, fontFamily: 'monospace', fontSize: 14 },
  });
  tickReadout.anchor.set(0.5, 1);
  tickReadout.x = STAGE_WIDTH / 2;
  tickReadout.y = STAGE_HEIGHT - 16;
  app.stage.addChild(tickReadout);

  const avatarLayer = new Container();
  app.stage.addChild(avatarLayer);

  const states = await preloadAvatarStates(PRELOAD_STATES);

  let currentName: AvatarStateName = 'idle-right';
  let current: LoadedAvatarState | null = null;
  let avatarX = STAGE_WIDTH / 2;

  const setState = (name: AvatarStateName): void => {
    if (current && currentName === name) return;
    if (current) avatarLayer.removeChild(current.sprite);
    const next = states.get(name);
    if (!next) throw new Error(`state not preloaded: ${name}`);
    next.sprite.anchor.set(0.5, 1);
    next.sprite.width = AVATAR_DISPLAY_WIDTH;
    const aspect = next.meta.frameHeight / next.meta.frameWidth;
    next.sprite.height = AVATAR_DISPLAY_WIDTH * aspect;
    next.sprite.x = avatarX;
    next.sprite.y = GROUND_Y;
    next.clip.gotoAndPlay(0);
    avatarLayer.addChild(next.sprite);
    current = next;
    currentName = name;
  };

  setState('idle-right');

  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const sim = new FixedStep({ hz: SIM_HZ });

  let tickCount = 0;
  const moveSpeed = 4;

  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) {
      tickCount++;

      const left = input.isDown('ArrowLeft');
      const right = input.isDown('ArrowRight');

      let nextState: AvatarStateName = currentName;
      if (right && !left) {
        avatarX = Math.min(STAGE_WIDTH - AVATAR_DISPLAY_WIDTH / 2, avatarX + moveSpeed);
        nextState = 'run-right';
      } else if (left && !right) {
        avatarX = Math.max(AVATAR_DISPLAY_WIDTH / 2, avatarX - moveSpeed);
        nextState = 'run-left';
      } else {
        nextState = currentName.endsWith('-left') ? 'idle-left' : 'idle-right';
      }

      if (nextState !== currentName) setState(nextState);
      if (current) {
        current.sprite.x = avatarX;
        current.clip.update();
      }

      input.endTick();
    }
    tickReadout.text = `tick ${tickCount}   state ${currentName}`;
  });

  let audioCtx: AudioContext | null = null;
  window.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  });

  console.log('Waker Phase 3 milestone ready: avatar wired up.');
}

void main();
