import { Application, Container, Sprite, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { AssetLoader } from './engine/AssetLoader.js';
import { FixedStep } from './engine/FixedStep.js';
import { Input } from './engine/Input.js';
import { Avatar } from './game/Avatar.js';
import { CompositeGround } from './game/CompositeGround.js';
import { CurveGround } from './game/CurveGround.js';
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
// The avatar can travel at most ~600 px from the origin at x=200 before hitting
// the level edge clamps; 600 maps that full traversable range onto the graph
// height. Original game used 400 here but the current test playground rewards
// the larger range.
const GRAPH_MAX_VALUE = 600;
const ORIGIN_X = 200;
// Anchor (0.5, 1) means y is the sprite's BOTTOM. Place the origin marker's
// bottom on the painted floor so it reads as a "stand" sitting on the ground.
const ORIGIN_Y = 498;
// Lift in pixels at which the stand's cradle holds the orb above the floor.
// ~½ to ⅔ of the visible orb glyph diameter (20 px), per the v6 review,
// so the orb visibly nests inside the U-shape of the stand instead of
// resting on the floor next to it.
const STAND_CRADLE_LIFT = 12;
// Half-width of the cradle "shelf" the orb lands on. Must be wide enough
// that imperfect drop x's still land in the stand, but not so wide it
// overlaps the avatar's footprint sample range.
const STAND_CRADLE_HALF_WIDTH = 18;
// Orb spawns sitting INSIDE the origin stand: same x, lifted to the cradle
// height. Gravity will keep it there because the stand shelf is added to
// the orb's ground stack (see `orbGround` below).
const ORB_X = ORIGIN_X;
const ORB_Y = ORIGIN_Y - STAND_CRADLE_LIFT;

// Origin proximity glow — when the avatar is near the stand the marker
// blooms brighter; the GLOW falls off linearly with distance until it's
// gone at the far edge of the playable range. The stand sprite itself
// stays fully opaque the whole time. GRAPH_MAX_VALUE is reused as the max
// meaningful distance because that's exactly the range the displacement
// orb can plot.
const ORIGIN_MAX_GLOW_STRENGTH = 4;

// Exit portal placement copied from displacement1.mxml line 26:
//   super.setExit(740, 195)
// Flash placed exit.png with its top-left at the given coords (Image
// default anchor (0, 0)), so we mirror that with anchor (0, 0).
const EXIT_X = 740;
const EXIT_Y = 195;

// Key-prompt floating sprites — visual hints that fade in/out based on
// context. Each prompt bobs ~3 px on a slow sine for a "floating" feel.
const PROMPT_BOB_AMPLITUDE = 3;
const PROMPT_BOB_RATE = 0.12;
// How close (in px) the avatar has to be to the orb for the "press D"
// pickup prompt to appear. Slightly larger than ORB_PICKUP_RADIUS so the
// player gets a hint BEFORE they're already close enough to grab it.
const PROMPT_D_RADIUS = 110;
// Spacebar prompt fades out after the player has been on the ground long
// enough to read it AND has not jumped. The original game just showed
// onscreen hints; we just guard against showing it forever.
const PROMPT_SPACEBAR_HIDE_AFTER_TICKS = 24 * 6; // ~6 sec at 24 Hz

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

  const [bgTex, groundTex, orbTex, originTex, graphBgTex, exitTex, helpDTex, helpSpaceTex] =
    await Promise.all([
      assets.image('bgWorld1_1'),
      assets.image('leveld1_collision'),
      assets.image('disOrb'),
      assets.image('displaceOrigin'),
      assets.image('graphBGD'),
      assets.image('exit'),
      assets.image('help_image_D'),
      assets.image('help_image_spacebar'),
    ]);

  const bgSprite = new Sprite(bgTex);
  app.stage.addChild(bgSprite);
  // The collision PNG IS the painted-ground silhouette in the original
  // game's compositing — without it the bg is just sky.
  const groundSprite = new Sprite(groundTex);
  app.stage.addChild(groundSprite);

  const pixelGround = await loadPixelGround(assets.url('leveld1_collision'));
  // Avatar's ground: painted floor + (later) any solidified curves the
  // player draws. Does NOT include the stand cradle — we don't want the
  // avatar bumping up onto the stand when walking past it.
  const ground = new CompositeGround();
  ground.add(pixelGround);

  // Orb's ground: same as the avatar's, plus a thin horizontal shelf at
  // the stand's cradle height so the orb naturally rests in the stand
  // instead of falling through it. Composing the avatar's `ground` here
  // (rather than re-adding pixelGround) means solidified curves added to
  // `ground` are visible to the orb too, automatically.
  const standCradle = new CurveGround(
    [
      { x: ORIGIN_X - STAND_CRADLE_HALF_WIDTH, y: ORIGIN_Y - STAND_CRADLE_LIFT },
      { x: ORIGIN_X + STAND_CRADLE_HALF_WIDTH, y: ORIGIN_Y - STAND_CRADLE_LIFT },
    ],
    2,
  );
  const orbGround = new CompositeGround();
  orbGround.add(ground);
  orbGround.add(standCradle);

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
  // The `npm run colorkey` step keyed the dark-blue halo (and the blue-ramp
  // antialiased edges) to alpha 0 already, so default blend is correct.
  // The stand stays fully opaque always — only the GLOW strength fades with
  // distance. Modulating the sprite's alpha as well made the stand itself
  // disappear when the avatar walked away, which read as a bug.
  const originGlow = new GlowFilter({
    color: 0xffffaa,
    distance: 20,
    outerStrength: 0,
    innerStrength: 0,
    quality: 0.3,
  });
  originSprite.filters = [originGlow];
  app.stage.addChild(originSprite);

  const orb = new Orb({
    initialX: ORB_X,
    initialY: ORB_Y,
    texture: orbTex,
    pairedGraph: graph,
    // Displacement: |avatar.x - origin.x|. Original game line 384 of game.mxml.
    valueProvider: (avatarX) => Math.abs(avatarX - ORIGIN_X),
  });
  app.stage.addChild(orb.container);

  // Exit portal: same coords (740, 195) the legacy level uses, anchor
  // (0, 0) to match Flash's default Image anchoring. The portal stays
  // visually "alive" via a pulsing cyan GlowFilter — without it the
  // 40×40 sprite would read as a static decoration.
  const exitSprite = new Sprite(exitTex);
  exitSprite.anchor.set(0, 0);
  exitSprite.x = EXIT_X;
  exitSprite.y = EXIT_Y;
  const exitGlow = new GlowFilter({
    color: 0x66ffff,
    distance: 18,
    outerStrength: 1.5,
    innerStrength: 0,
    quality: 0.3,
  });
  exitSprite.filters = [exitGlow];
  app.stage.addChild(exitSprite);

  // Key prompts — small floating help glyphs that appear contextually.
  // The "D" prompt orbits the orb when it's pickupable (avatar nearby +
  // not yet held) and re-appears above the avatar's head when held to
  // remind the player they can drop it. Spacebar prompt shows above the
  // avatar's head at level start until it auto-hides.
  const promptD = new Sprite(helpDTex);
  promptD.anchor.set(0.5, 1);
  promptD.alpha = 0;
  app.stage.addChild(promptD);

  const promptSpacebar = new Sprite(helpSpaceTex);
  promptSpacebar.anchor.set(0.5, 1);
  promptSpacebar.alpha = 0;
  app.stage.addChild(promptSpacebar);

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
  // Latches the first time the player presses jump so the spacebar prompt
  // can hide. Also serves as a cheap "tutorial complete" signal we can
  // reuse later if more prompts are added.
  let firstJumped = false;
  // Phase accumulator drives prompt bobbing AND exit-portal glow pulse —
  // sharing one phase keeps everything visually in sync without tracking
  // separate timers.
  let promptPhase = 0;

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
          const wasDrawingOrPaused =
            orb.pairedGraph.state === 'drawing' || orb.pairedGraph.state === 'paused';
          orb.drop(body.state.x, body.state.y - 20);
          if (wasDrawingOrPaused) {
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

      orb.update(body.state.x, body.state.y, orbGround);

      // Origin proximity glow: glow strength is linear in |avatar.x - origin.x|,
      // max at the origin and zero at GRAPH_MAX_VALUE away. The stand sprite
      // itself stays fully opaque — fading its alpha looked like a bug
      // (the stand disappeared when the avatar walked away).
      const distToOrigin = Math.abs(body.state.x - ORIGIN_X);
      const proximity = Math.max(0, Math.min(1, 1 - distToOrigin / GRAPH_MAX_VALUE));
      originGlow.outerStrength = proximity * ORIGIN_MAX_GLOW_STRENGTH;

      // Exit portal pulse — half the prompt-bob rate so the portal feels
      // calm/inviting rather than urgent.
      promptPhase += PROMPT_BOB_RATE;
      exitGlow.outerStrength = 1.5 + Math.sin(promptPhase * 0.5) * 1.0;
      const promptBob = Math.sin(promptPhase) * PROMPT_BOB_AMPLITUDE;

      // Latch first-jump so the spacebar prompt knows when to fade.
      if (moveInputs.jumpPressed) firstJumped = true;

      // Prompt-D visibility:
      //   in-world + avatar within PROMPT_D_RADIUS  → "press D to pick up"
      //   held                                       → "press D to drop"
      let promptDTargetAlpha = 0;
      if (orb.state === 'held') {
        promptDTargetAlpha = 1;
        // Place above avatar's head, slightly to the right of the held orb
        // so the two glyphs don't stack on each other.
        promptD.x = body.state.x + 18;
        promptD.y = body.state.y - 88 + promptBob;
      } else {
        const dxOrb = body.state.x - orb.x;
        const dyOrb = body.state.y - orb.y;
        const distOrb = Math.sqrt(dxOrb * dxOrb + dyOrb * dyOrb);
        if (distOrb < PROMPT_D_RADIUS) promptDTargetAlpha = 1;
        // Position above the orb regardless of avatar distance — when the
        // alpha lerp ramps up, the prompt is already in place.
        promptD.x = orb.x;
        promptD.y = orb.y - 36 + promptBob;
      }

      // Prompt-spacebar visibility: only at the very start, fades when
      // the player jumps OR the timer runs out. Anchors above avatar's
      // head, bobbing on the OPPOSITE phase from the D prompt so the
      // two never look glued together.
      const spacebarTargetAlpha =
        !firstJumped && tickCount < PROMPT_SPACEBAR_HIDE_AFTER_TICKS ? 1 : 0;
      promptSpacebar.x = body.state.x;
      promptSpacebar.y = body.state.y - 78 - promptBob;

      // Smooth alpha fade — the lerp factor (0.15) is fast enough to
      // feel responsive but slow enough that brief proximity dips don't
      // visibly flicker the prompt.
      promptD.alpha += (promptDTargetAlpha - promptD.alpha) * 0.15;
      promptSpacebar.alpha += (spacebarTargetAlpha - promptSpacebar.alpha) * 0.15;

      input.endTick();
    }
    const orbState = orb.state === 'held' ? 'orb=held' : `orb=world (${orb.x.toFixed(0)},${orb.y.toFixed(0)})`;
    const graphState = `graph=${orb.pairedGraph.state}`;
    tickReadout.text = `tick ${tickCount}   avatar=(${body.state.x.toFixed(0)},${body.state.y.toFixed(0)})   ${orbState}   ${graphState}`;
  });

  console.log('Waker Phase 4 step 5 ready: orb + graph mechanic wired up.');
}

void main();
