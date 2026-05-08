import { Application, Container, Sprite, Text } from 'pixi.js';
import { AssetLoader } from './engine/AssetLoader.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { Avatar } from './game/Avatar.js';
import { CompositeGround } from './game/CompositeGround.js';
import { Body, type MovementInputs } from './game/Movements.js';
import { Graph } from './game/Graph.js';
import { Orb } from './game/Orb.js';
import { loadPixelGround } from './game/PixelGround.js';

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const SIM_HZ = 24;
const AVATAR_SCALE = 0.3;

// leveld1 entrance from legacy/src/levels/displacement1.mxml line 27.
const SPAWN_X = 80;
const SPAWN_Y = 100;

// Orb + graph layout copied from displacement1.mxml line 38:
//   super.addGraph(0, 0, 308, 200, 400, 300, 300, 100, 200, 430, 0, 200, 438, …)
// graphtype=0 (displacement), x=308, y=200, scale=400 (maxValue),
// graph 300x300, orb at (200, 430), origin at (200, 438).
const GRAPH_X = 308;
const GRAPH_Y = 200;
const GRAPH_W = 300;
const GRAPH_H = 300;
const GRAPH_MAX_VALUE = 400;
const ORB_X = 200;
const ORB_Y = 430;
const ORIGIN_X = 200;
const ORIGIN_Y = 438;

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

  const [bgTex, groundTex, orbTex, orbFxTex, originTex, graphBgTex] = await Promise.all([
    assets.image('bgWorld1_1'),
    assets.image('leveld1_collision'),
    assets.image('disOrb'),
    assets.image('disEffect'),
    assets.image('displaceOrigin'),
    assets.image('graphBGD'),
  ]);

  const bgSprite = new Sprite(bgTex);
  app.stage.addChild(bgSprite);
  // The collision PNG is overlaid lightly so you can see the painted ground
  // shapes the avatar is colliding against — full alpha would obscure the
  // actual level art.
  const groundSprite = new Sprite(groundTex);
  groundSprite.alpha = 0.25;
  app.stage.addChild(groundSprite);

  const pixelGround = await loadPixelGround(assets.url('leveld1_collision'));
  const ground = new CompositeGround();
  ground.add(pixelGround);

  const graphLayer = new Container();
  app.stage.addChild(graphLayer);

  const graph = new Graph({
    graphX: GRAPH_X,
    graphY: GRAPH_Y,
    width: GRAPH_W,
    height: GRAPH_H,
    maxValue: GRAPH_MAX_VALUE,
    background: graphBgTex,
  });
  graphLayer.addChild(graph.container);

  const originSprite = new Sprite(originTex);
  originSprite.anchor.set(0.5, 1);
  originSprite.x = ORIGIN_X;
  originSprite.y = ORIGIN_Y;
  app.stage.addChild(originSprite);

  const orb = new Orb({
    initialX: ORB_X,
    initialY: ORB_Y,
    texture: orbTex,
    effectTexture: orbFxTex,
    pairedGraph: graph,
    // Displacement: |avatar.x - origin.x|. Original game line 384 of game.mxml.
    valueProvider: (avatarX) => Math.abs(avatarX - ORIGIN_X),
  });
  app.stage.addChild(orb.container);

  const label = new Text({
    text:
      'Waker — Phase 4 step 5: orb pickup + graph drawing\n' +
      'arrows: walk   |   S/shift: sprint   |   space/up: jump   |   D: pick up / drop orb',
    style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 13, align: 'center' },
  });
  label.anchor.set(0.5, 0);
  label.x = STAGE_WIDTH / 2;
  label.y = 12;
  app.stage.addChild(label);

  const tickReadout = new Text({
    text: '',
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

      // D key handles both pickup and drop.
      if (input.wasPressed('KeyD')) {
        if (orb.state === 'held') {
          // Drop at avatar's feet, slightly raised so it doesn't merge with the floor.
          const droppedSolid = orb.pairedGraph.state === 'drawing';
          orb.drop(body.state.x, body.state.y - 20);
          if (droppedSolid) {
            const newGround = orb.pairedGraph.ground;
            if (newGround) ground.add(newGround);
          }
        } else if (orb.overlapsAvatar(body.state.x, body.state.y)) {
          // If a curve was previously solidified, remove its layer before redrawing.
          const old = orb.pairedGraph.ground;
          if (old && ground.has(old)) ground.remove(old);
          orb.pickup();
        }
      }

      body.step(moveInputs, ground);

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

      orb.update(body.state.x, body.state.y, ground);

      input.endTick();
    }
    const orbState = orb.state === 'held' ? 'orb=held' : `orb=world (${orb.x.toFixed(0)},${orb.y.toFixed(0)})`;
    const graphState = `graph=${orb.pairedGraph.state}`;
    tickReadout.text = `tick ${tickCount}   avatar=(${body.state.x.toFixed(0)},${body.state.y.toFixed(0)})   ${orbState}   ${graphState}`;
  });

  console.log('Waker Phase 4 step 5 ready: orb + graph mechanic wired up.');
}

void main();
