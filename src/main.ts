import { Application, Graphics, Text } from 'pixi.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;

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

  const placeholder = new Graphics().rect(-20, -20, 40, 40).fill(0xffaa00);
  placeholder.x = STAGE_WIDTH / 2;
  placeholder.y = STAGE_HEIGHT / 2;
  app.stage.addChild(placeholder);

  const label = new Text({
    text:
      'Waker — Phase 1+3 scaffold\n' +
      'arrows: move   |   click: beep   |   any key: log\n' +
      'simulation: 24 Hz fixed step (tick counter below)',
    style: { fill: 0xaaaaaa, fontFamily: 'monospace', fontSize: 14, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 16;
  app.stage.addChild(label);

  const tickReadout = new Text({
    text: 'tick 0',
    style: { fill: 0x66ccff, fontFamily: 'monospace', fontSize: 14 },
  });
  tickReadout.anchor.set(0.5, 1);
  tickReadout.x = STAGE_WIDTH / 2;
  tickReadout.y = STAGE_HEIGHT - 16;
  app.stage.addChild(tickReadout);

  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const sim = new FixedStep({ hz: SIM_HZ });

  let tickCount = 0;
  let pulse = 0;
  const speed = 4;

  app.ticker.add(({ deltaMS }) => {
    const { steps, alpha } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) {
      tickCount++;
      pulse += 1;

      if (input.wasPressed('Escape')) console.log('escape pressed');
      if (input.isDown('ArrowLeft')) placeholder.x -= speed;
      if (input.isDown('ArrowRight')) placeholder.x += speed;
      if (input.isDown('ArrowUp')) placeholder.y -= speed;
      if (input.isDown('ArrowDown')) placeholder.y += speed;

      input.endTick();
    }

    placeholder.alpha = 0.5 + 0.5 * Math.sin(pulse / 6 + alpha);
    tickReadout.text = `tick ${tickCount}`;
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

  window.addEventListener('keydown', (e) => {
    console.log(`key: ${e.key} (code=${e.code})`);
  });

  console.log('Waker scaffold ready (24 Hz sim wired up).');
}

void main();
