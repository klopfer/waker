import { Application, Sprite, Text } from 'pixi.js';
import { AssetLoader } from './engine/AssetLoader.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { Avatar } from './game/Avatar.js';
import { Body, type MovementInputs } from './game/Movements.js';
import { loadPixelGround } from './game/PixelGround.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;
const AVATAR_SCALE = 0.3;

// Pre-port leveld1 entrance (from legacy/src/levels/displacement1.mxml line 27:
// super.setEntrance(0, 390)). The level's collision PNG drives where the
// avatar actually lands.
const SPAWN_X = 80;
const SPAWN_Y = 100; // start a bit above the painted ground so we can see the fall

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

  const assets = new AssetLoader();

  const [bgTex, groundTex] = await Promise.all([
    assets.image('bgWorld1_1'),
    assets.image('leveld1_collision'),
  ]);
  const bgSprite = new Sprite(bgTex);
  bgSprite.x = 0;
  bgSprite.y = 0;
  app.stage.addChild(bgSprite);

  const groundSprite = new Sprite(groundTex);
  groundSprite.alpha = 1;
  app.stage.addChild(groundSprite);

  const ground = await loadPixelGround(assets.url('leveld1_collision'));

  const label = new Text({
    text:
      'Waker — Phase 4 step 3: real terrain (leveld1)\n' +
      'arrows: walk + face   |   S/shift: sprint   |   space/up: jump',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 13, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 12;
  app.stage.addChild(label);

  const tickReadout = new Text({
    text: 'tick 0   state idle-right',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 12 },
  });
  tickReadout.anchor.set(0.5, 1);
  tickReadout.x = STAGE_WIDTH / 2;
  tickReadout.y = STAGE_HEIGHT - 8;
  app.stage.addChild(tickReadout);

  const avatar = await Avatar.preload(AVATAR_SCALE);
  const body = new Body({ x: SPAWN_X, y: SPAWN_Y, onGround: false });
  avatar.setPosition(body.state.x, body.state.y);
  app.stage.addChild(avatar.container);

  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const sim = new FixedStep({ hz: SIM_HZ });

  let tickCount = 0;

  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) {
      tickCount++;

      const moveInputs: MovementInputs = {
        moveLeft: input.isDown('ArrowLeft'),
        moveRight: input.isDown('ArrowRight'),
        sprint:
          input.isDown('KeyS') || input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        jumpPressed: input.wasPressed('Space') || input.wasPressed('ArrowUp'),
      };

      body.step(moveInputs, ground);

      // keep the avatar inside the stage horizontally; if it falls off the
      // bottom (no ground in this column), respawn at the entrance.
      if (body.state.x < 8) {
        body.state.x = 8;
        body.state.vx = 0;
      } else if (body.state.x > STAGE_WIDTH - 8) {
        body.state.x = STAGE_WIDTH - 8;
        body.state.vx = 0;
      }
      if (body.state.y > STAGE_HEIGHT + 200) {
        body.state.x = SPAWN_X;
        body.state.y = SPAWN_Y;
        body.state.vx = 0;
        body.state.vy = 0;
        body.state.onGround = false;
      }

      avatar.setPosition(body.state.x, body.state.y);
      avatar.update({
        vx: body.state.vx,
        vy: body.state.vy,
        onGround: body.state.onGround,
        facingRight: body.state.facingRight,
      });

      input.endTick();
    }
    tickReadout.text = `tick ${tickCount}   state ${avatar.state}   y=${body.state.y.toFixed(0)}`;
  });

  console.log('Waker Phase 4 step 3 ready: leveld1 background + pixel-mask ground.');
}

void main();
