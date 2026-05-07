import { Application, Graphics, Text } from 'pixi.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;

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

  const placeholder = new Graphics().rect(380, 280, 40, 40).fill(0xffaa00);
  app.stage.addChild(placeholder);

  const label = new Text({
    text: 'Waker — Phase 1 scaffold\nclick: beep   |   any key: log',
    style: { fill: 0xaaaaaa, fontFamily: 'monospace', fontSize: 14, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 24;
  app.stage.addChild(label);

  let elapsed = 0;
  app.ticker.add(({ deltaMS }) => {
    elapsed += deltaMS;
    placeholder.alpha = 0.5 + 0.5 * Math.sin(elapsed / 300);
  });

  let audioCtx: AudioContext | null = null;
  document.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  });

  document.addEventListener('keydown', (e) => {
    console.log(`key: ${e.key} (code=${e.code})`);
  });

  console.log('Waker scaffold ready.');
}

void main();
