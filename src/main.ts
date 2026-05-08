import { Application, Graphics, Text } from 'pixi.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { Avatar } from './game/Avatar.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;
const AVATAR_SCALE = 0.3;
const GROUND_Y = STAGE_HEIGHT - 60;

// Speed constants ported from legacy/src/movements.mxml. Kept verbatim because
// they were tuned against a 24 Hz simulation tick (which we preserve).
const WALK_SPEED = 6; // matches WALKINGSPEED = 4 * 1.5 gameSpeed
const RUN_SPEED = 12; // matches MAXRUNSPEED = 8 * 1.5

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

  const ground = new Graphics().rect(0, GROUND_Y + 1, STAGE_WIDTH, 4).fill(0x2a3140);
  app.stage.addChild(ground);

  const label = new Text({
    text:
      'Waker — Phase 4 step 1\n' +
      'arrows: walk + face   |   S or shift: sprint   |   click: beep\n' +
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

  const avatar = await Avatar.preload(AVATAR_SCALE);
  avatar.setPosition(STAGE_WIDTH / 2, GROUND_Y);
  app.stage.addChild(avatar.container);

  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const sim = new FixedStep({ hz: SIM_HZ });

  let tickCount = 0;
  let facingRight = true;

  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) {
      tickCount++;

      const left = input.isDown('ArrowLeft');
      const right = input.isDown('ArrowRight');
      const sprint =
        input.isDown('KeyS') || input.isDown('ShiftLeft') || input.isDown('ShiftRight');

      let vx = 0;
      const speed = sprint ? RUN_SPEED : WALK_SPEED;
      if (right && !left) {
        vx = speed;
        facingRight = true;
      } else if (left && !right) {
        vx = -speed;
        facingRight = false;
      }

      avatar.setPosition(
        Math.max(40, Math.min(STAGE_WIDTH - 40, avatar.x + vx)),
        GROUND_Y,
      );

      avatar.update({ vx, vy: 0, onGround: true, facingRight });

      input.endTick();
    }
    tickReadout.text = `tick ${tickCount}   state ${avatar.state}`;
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

  console.log('Waker Phase 4 step 1 ready: Avatar state machine wired up.');
}

void main();
