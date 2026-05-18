import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
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
// 0.30 was the initial Phase-3 placeholder; the original Flash game's
// avatar reads visually smaller relative to the 800×600 stage. 0.25
// matches the original screenshot more closely. Edit and reload to
// A/B against the original — the value is captured at level load.
const AVATAR_SCALE = 0.25;

// displacement0 (tutorial — actually the FIRST playable level in the original
// sequence; what we previously had loaded as "leveld1" was displacement1, the
// second level). Constants below come from legacy/src/levels/displacement0.mxml.
//
// Entrance: the original spawns the avatar at the level's left edge above
// the bottom floor, so the player drops in from the upper-left and lands on
// the very-bottom cloud bank at x=0..50 (painted-floor topmost-solid y=520).
// They then have to walk + jump up the staircase. Spawning ON a higher cloud
// step skips the level's intended progression — see docs/calibration.md.
const SPAWN_X = 30;
const SPAWN_Y = 0;

// Orb + graph layout from displacement0.mxml line 39:
//   super.addGraph(0, 0, 800-110-200, 134, 550, 200, 200, 70, 300, 290, 0, 300, 273, 0, 0)
// graphtype=0 (displacement), graphratio=0 (square), x=490, y=134, scale=550,
// width=200, height=200, offset=70, orbx=300, orby=290, originx=300, originy=273.
const GRAPH_X = 490;
const GRAPH_Y = 134;
const GRAPH_W = 200;
const GRAPH_H = 200;
const GRAPH_MAX_VALUE = 550;
// `offset` (8th arg of legacy `addGraph`) — passed straight into
// genericGraph.init() as `_yOffset`, then added to the curve's y-position
// each draw. Without this the curve at value=0 sits at the CENTER of the
// graph rect (world y=234 here), which is far above the avatar's head when
// they pick up the orb. With offset=70 the value=0 line sits ~29 px above
// the orb-stand platform top — close enough that a single jump lands on
// the curve. See docs/calibration.md.
const GRAPH_OFFSET = 70;
const ORIGIN_X = 300;
// The legacy origin Y (273) is a Flash top-left coordinate; we use a (0.5, 1)
// bottom-anchor and place the origin's bottom on the painted floor at x=300.
// Topmost-solid pixel in levelTD_ground.png at x=300 is y=333 (measured via
// pngjs sweep), which is the second-step cloud platform.
const ORIGIN_Y = 333;
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

// Exit portal placement copied from displacement0.mxml line 27:
//   super.setExit(750, 174)
// Flash placed exit.png with its top-left at the given coords (Image
// default anchor (0, 0)), so we mirror that with anchor (0, 0).
const EXIT_X = 750;
const EXIT_Y = 174;
// Exit sprite is 40 × 40. Bbox is (EXIT_X, EXIT_Y) → (EXIT_X+40, EXIT_Y+40).
const EXIT_W = 40;
const EXIT_H = 40;

// Key-prompt floating sprites — visual hints that fade in/out based on
// context. Each prompt bobs ~3 px on a slow sine for a "floating" feel.
const PROMPT_BOB_AMPLITUDE = 3;
const PROMPT_BOB_RATE = 0.12;
// Some levels (the tutorial / displacement0) have the original D and
// SPACEBAR help glyphs baked INTO the painted bg PNG. On those, our
// runtime procedural prompts would just stack on top of the painted
// ones. Set this true on those levels to skip the procedural prompts
// entirely. Future non-tutorial levels can flip this to false.
const BG_HAS_HELP_PROMPTS = true;

// How close (in px) the avatar has to be to the orb for the "press D"
// pickup prompt to appear. Slightly larger than ORB_PICKUP_RADIUS so the
// player gets a hint BEFORE they're already close enough to grab it.
const PROMPT_D_RADIUS = 110;
// Spacebar prompt is gated on the player first STARTING TO RUN (not on
// spawn) — showing it during the spawn-fall looked like the prompt was
// chasing the avatar down. After they start moving on the ground, the
// hint shows for ~3 sec then permanently hides. Pressing jump also
// hides it immediately.
const PROMPT_SPACEBAR_VISIBLE_TICKS = 24 * 3; // ~3 sec at 24 Hz
const PROMPT_RUN_VX_THRESHOLD = 4; // px/tick — past walking, into running

// Animated background. The painted sun's bright-white centroid in
// levelTD_bg.png (the tutorial bg) is at (207, 102) — measured by a
// pngjs sweep. A procedural soft-glow disc layered on top of the bg
// in 'add' blend reads as the painted sun "pulsing" without needing
// a separate sun-mask asset. Cloud drift is intentionally NOT done
// procedurally — no cloud PNG is curated, and procedural cloud
// sprites would visually fight the painted cloud bank.
const SUN_X = 207;
const SUN_Y = 102;
const SUN_PULSE_BASE_RADIUS = 36;
const SUN_PULSE_AMPLITUDE = 8;
const SUN_PULSE_BASE_ALPHA = 0.22;
const SUN_PULSE_ALPHA_AMPLITUDE = 0.12;
const SUN_PULSE_RATE = 0.04;
const SUN_COLOR = 0xfff4c8;
// Subtle horizontal sway on the bg+ground sprites for "alive" feel.
// Slow rate (0.006 rad/tick → ~26 sec/cycle at 24 Hz) and tiny
// amplitude so the player doesn't consciously notice the motion but
// the scene stops feeling frozen.
const BG_SWAY_RATE = 0.006;
const BG_SWAY_AMPLITUDE = 2;

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

  const [bgTex, groundTex, orbTex, originTex, graphBgTex, exitTex] = await Promise.all([
    assets.image('bgWorld1_t'),
    assets.image('levelTD_collision'),
    assets.image('disOrb'),
    assets.image('displaceOrigin'),
    assets.image('graphBGD'),
    assets.image('exit'),
  ]);

  const bgSprite = new Sprite(bgTex);
  app.stage.addChild(bgSprite);
  // Sun pulse sits between the bg and the ground silhouette. 'add' blend
  // makes the warm gradient fill BRIGHTEN whatever's beneath without
  // covering it, so the painted sun (which is a near-white disc) gets a
  // glowing halo that reads as a slow breath. Drawing geometry once and
  // animating only `scale` + `alpha` per tick is cheaper than redrawing
  // the Graphics every frame.
  const sunPulse = new Graphics().circle(0, 0, 1).fill(SUN_COLOR);
  sunPulse.blendMode = 'add';
  sunPulse.x = SUN_X;
  sunPulse.y = SUN_Y;
  app.stage.addChild(sunPulse);
  // The collision PNG IS the painted-ground silhouette in the original
  // game's compositing — without it the bg is just sky.
  const groundSprite = new Sprite(groundTex);
  app.stage.addChild(groundSprite);

  const pixelGround = await loadPixelGround(assets.url('levelTD_collision'));
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
  //
  // CurveGround.groundYBelow returns line_y - thickness/2 (top of the
  // solid band — see calibration v4). To make the cradle's TOP land at
  // (ORIGIN_Y - STAND_CRADLE_LIFT), we set the polyline line at
  // STAND_CRADLE_LIFT - thickness/2 below the origin. With thickness=2,
  // that means the line is at y = ORIGIN_Y - STAND_CRADLE_LIFT + 1.
  const STAND_CRADLE_THICKNESS = 2;
  const standCradle = new CurveGround(
    [
      {
        x: ORIGIN_X - STAND_CRADLE_HALF_WIDTH,
        y: ORIGIN_Y - STAND_CRADLE_LIFT + STAND_CRADLE_THICKNESS / 2,
      },
      {
        x: ORIGIN_X + STAND_CRADLE_HALF_WIDTH,
        y: ORIGIN_Y - STAND_CRADLE_LIFT + STAND_CRADLE_THICKNESS / 2,
      },
    ],
    STAND_CRADLE_THICKNESS,
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
    yOffset: GRAPH_OFFSET,
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

  // ───────────────────────────────────────────────────────────────────────
  // Level-complete overlay (hidden until win detection fires).
  //
  // A semi-transparent dimming layer + centered title text + a
  // "press SPACE to restart" instruction. Sits above everything except
  // the debug readouts. Display order matters: this is added LATE so
  // it occludes the gameplay when shown.
  // ───────────────────────────────────────────────────────────────────────
  const winOverlay = new Container();
  winOverlay.visible = false;
  const winDim = new Graphics()
    .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    .fill({ color: 0x000000, alpha: 0.55 });
  winOverlay.addChild(winDim);
  const winTitle = new Text({
    text: 'Level Complete',
    style: {
      fill: 0xffffff,
      fontFamily: 'sans-serif',
      fontSize: 48,
      fontWeight: '700',
      align: 'center',
    },
  });
  winTitle.anchor.set(0.5, 1);
  winTitle.x = STAGE_WIDTH / 2;
  winTitle.y = STAGE_HEIGHT / 2 - 8;
  winOverlay.addChild(winTitle);
  const winSub = new Text({
    text: 'press SPACE to restart',
    style: {
      fill: 0xffeec8,
      fontFamily: 'sans-serif',
      fontSize: 16,
      align: 'center',
    },
  });
  winSub.anchor.set(0.5, 0);
  winSub.x = STAGE_WIDTH / 2;
  winSub.y = STAGE_HEIGHT / 2 + 12;
  winOverlay.addChild(winSub);
  // Deferred: addChild for winOverlay happens after the gameplay
  // layers so it draws on top. We add it right before the tick loop.

  // Bbox-overlap predicate. The avatar uses bottom-center anchor; treat
  // the avatar's body as covering [x-HALF_WIDTH, x+HALF_WIDTH] horiz and
  // [y-HEIGHT, y] vertically. Win fires when the avatar's body bbox
  // intersects the exit's bbox at all — generous so you don't have to
  // stand IN the portal, walking onto the exit platform near it counts.
  const avatarOverlapsExit = (avatarX: number, avatarY: number): boolean => {
    const ax0 = avatarX - 12; // HALF_WIDTH; hard-coded here to avoid importing BODY just for this
    const ax1 = avatarX + 12;
    const ay0 = avatarY - 35;
    const ay1 = avatarY;
    return ax0 < EXIT_X + EXIT_W && ax1 > EXIT_X && ay0 < EXIT_Y + EXIT_H && ay1 > EXIT_Y;
  };

  // Key prompts — small floating help glyphs we draw procedurally instead
  // of the curated `help_image_D` / `help_image_spacebar` PNGs (which read
  // as too prominent at this scale). A rounded dark-cream rectangle with
  // a black letter inside matches the original game's palette while
  // staying smaller and quieter than the bitmap versions.
  //
  // SKIPPED on tutorial levels (BG_HAS_HELP_PROMPTS=true): the painted bg
  // already has D / ↑ / SPACEBAR glyphs baked in, so adding ours on top
  // just stacks them. Both promptD and promptSpacebar are nullable so the
  // tick block can branch on their presence rather than fading invisible
  // sprites every frame.
  const PROMPT_BG_COLOR = 0xfff2c2; // warm cream, same family as the orb halo
  const PROMPT_TEXT_COLOR = 0x1a1a1a;
  const PROMPT_BORDER_COLOR = 0x1a1a1a;
  const makeKeyPrompt = (label: string, width: number, height: number): Container => {
    const c = new Container();
    const radius = Math.min(width, height) / 4;
    const bg = new Graphics()
      .roundRect(-width / 2, -height, width, height, radius)
      .fill(PROMPT_BG_COLOR)
      .stroke({ color: PROMPT_BORDER_COLOR, width: 1.5 });
    c.addChild(bg);
    const text = new Text({
      text: label,
      style: {
        fill: PROMPT_TEXT_COLOR,
        fontFamily: 'sans-serif',
        fontSize: Math.round(height * 0.62),
        fontWeight: '700',
      },
    });
    text.anchor.set(0.5, 0.5);
    text.x = 0;
    text.y = -height / 2;
    c.addChild(text);
    c.alpha = 0;
    return c;
  };
  const promptD: Container | null = BG_HAS_HELP_PROMPTS ? null : makeKeyPrompt('D', 22, 22);
  const promptSpacebar: Container | null = BG_HAS_HELP_PROMPTS
    ? null
    : makeKeyPrompt('SPACE', 50, 20);
  if (promptD) app.stage.addChild(promptD);
  if (promptSpacebar) app.stage.addChild(promptSpacebar);

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

  // Win overlay sits ABOVE the avatar so it occludes the play scene
  // when shown. tickReadout is below it (drawn first), so debug text
  // is hidden under the overlay too — fine for v1.
  app.stage.addChild(winOverlay);

  const input = new Input(window, { preventDefaultFor: GAME_KEYS });
  const sim = new FixedStep({ hz: SIM_HZ });

  let tickCount = 0;
  // Latch state for the contextual prompts. Both prompts are designed to
  // appear at most once and stay gone afterward — the original game does
  // not nag the player past the first interaction.
  //   firstRunTick: tick when the player first hits running speed AND is
  //     on the ground. Spacebar prompt is anchored here, NOT to spawn,
  //     so it doesn't chase the avatar through the entrance fall.
  //   firstJumped: hides the spacebar prompt immediately on first jump,
  //     even if the 3-sec window hasn't elapsed.
  //   firstDropped: once the player has dropped the orb once, the D
  //     prompt is permanently gone — they understand the mechanic.
  let firstRunTick: number | null = null;
  let firstJumped = false;
  let firstDropped = false;
  // Win state. Set when the avatar's body bbox overlaps the exit portal.
  // While true: physics + input handling freeze, the winOverlay is shown,
  // and pressing the restart key resets everything back to spawn.
  let levelComplete = false;
  // Phase accumulator drives prompt bobbing AND exit-portal glow pulse —
  // sharing one phase keeps everything visually in sync without tracking
  // separate timers.
  let promptPhase = 0;
  // Independent phase trackers for the bg animation. The sun pulse and
  // bg sway run at much slower rates than the prompts (which need to
  // feel "alive" / urgent), so giving them their own accumulators keeps
  // the scene from feeling like everything's beating in lockstep.
  let sunPhase = 0;
  let bgSwayPhase = 0;

  // Restore every piece of mutable state back to level-start. Called when
  // the player presses restart on the win overlay, and could also be
  // wired to a debug "reset" hotkey later.
  const resetLevel = (): void => {
    // Avatar back to spawn.
    body.state.x = SPAWN_X;
    body.state.y = SPAWN_Y;
    body.state.vx = 0;
    body.state.vy = 0;
    body.state.facingRight = true;
    body.state.onGround = false;
    avatar.setPosition(body.state.x, body.state.y);

    // Orb back to in_world at the cradle, gravity will let it settle.
    // If the orb was held, drop() flips it to in_world. If it was
    // already in_world (e.g., dropped on a curve far from origin), we
    // forcibly reposition it.
    if (orb.state === 'held') {
      orb.drop(ORB_X, ORB_Y);
    } else {
      orb.x = ORB_X;
      orb.y = ORB_Y;
      orb.container.x = Math.round(ORB_X);
      orb.container.y = Math.round(ORB_Y);
    }

    // Graph back to idle, clear any solidified curve.
    const oldCurve = graph.ground;
    if (oldCurve && ground.has(oldCurve)) ground.remove(oldCurve);
    graph.reset();

    // Latches.
    firstRunTick = null;
    firstJumped = false;
    firstDropped = false;
    levelComplete = false;

    // Hide overlay.
    winOverlay.visible = false;
  };

  app.ticker.add(({ deltaMS }) => {
    const { steps } = sim.advance(deltaMS);
    for (let i = 0; i < steps; i++) {
      tickCount++;

      // While the win overlay is up, freeze the gameplay sim. Listen
      // only for the restart key. Keep visuals (orb pulse, sun pulse,
      // bg sway, exit glow) running below in the unconditional block
      // so the screen doesn't go static behind the overlay.
      if (levelComplete) {
        if (input.wasPressed('Space')) {
          resetLevel();
        }
        input.endTick();
        continue;
      }

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
          firstDropped = true;
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

      // Win check: avatar's body bbox overlaps the exit portal's bbox.
      // The visuals (orb/sun/exit pulse, bg sway) keep ticking below,
      // but the next iteration's `if (levelComplete)` branch short-
      // circuits input + physics.
      if (avatarOverlapsExit(body.state.x, body.state.y)) {
        levelComplete = true;
        winOverlay.visible = true;
      }

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

      // Sun pulse — animate scale and alpha on the pre-drawn 1-px disc.
      // Painted clouds in the bg are baked into the same layer as the
      // sun, so 'add' blend lets the halo read on top of them without
      // creating an obvious stacking-order issue.
      sunPhase += SUN_PULSE_RATE;
      const sunSin = Math.sin(sunPhase);
      sunPulse.scale.set(SUN_PULSE_BASE_RADIUS + sunSin * SUN_PULSE_AMPLITUDE);
      sunPulse.alpha = SUN_PULSE_BASE_ALPHA + sunSin * SUN_PULSE_ALPHA_AMPLITUDE;

      // Bg parallax sway — translate the bg + ground silhouette together
      // so they remain registered to each other; foreground actors
      // (avatar, orb, origin, exit) stay at world coords.
      bgSwayPhase += BG_SWAY_RATE;
      const bgOffset = Math.sin(bgSwayPhase) * BG_SWAY_AMPLITUDE;
      bgSprite.x = bgOffset;
      groundSprite.x = bgOffset;

      // Latch state for the contextual prompts.
      if (moveInputs.jumpPressed) firstJumped = true;
      if (
        firstRunTick === null &&
        body.state.onGround &&
        Math.abs(body.state.vx) >= PROMPT_RUN_VX_THRESHOLD
      ) {
        firstRunTick = tickCount;
      }

      // Prompt-D: visible from spawn through the player's first DROP,
      // then permanently hidden. While in_world, requires the avatar to
      // be within PROMPT_D_RADIUS so the prompt doesn't shout from
      // across the level; while held, distance is irrelevant (the
      // player knows where the orb is — they're carrying it). Always
      // anchored to the orb itself, NOT separately to the avatar.
      //
      // Subtle ±2° sway (so they read as hand-drawn floating signs, like
      // the painted ones in the original game's bg). Skipped entirely
      // when the bg has the help glyphs painted in (BG_HAS_HELP_PROMPTS).
      if (promptD) {
        let promptDTargetAlpha = 0;
        if (!firstDropped) {
          if (orb.state === 'held') {
            promptDTargetAlpha = 1;
          } else {
            const dxOrb = body.state.x - orb.x;
            const dyOrb = body.state.y - orb.y;
            const distOrb = Math.sqrt(dxOrb * dxOrb + dyOrb * dyOrb);
            if (distOrb < PROMPT_D_RADIUS) promptDTargetAlpha = 1;
          }
        }
        promptD.x = orb.x;
        promptD.y = orb.y - 28 + promptBob;
        promptD.rotation = Math.sin(promptPhase * 0.7) * 0.035; // ±2° sway
        promptD.alpha += (promptDTargetAlpha - promptD.alpha) * 0.15;
      }

      // Prompt-spacebar: stays at alpha 0 until the player first runs
      // (i.e., starts moving on the ground past the running threshold —
      // not at spawn while falling in). Then visible for ~3 sec or
      // until they press jump, whichever first. Permanently hides
      // afterward so it doesn't repeat each time they start running.
      // Counter-phase sway from promptD so they don't sway in lockstep.
      if (promptSpacebar) {
        const ticksSinceRun = firstRunTick === null ? -1 : tickCount - firstRunTick;
        const spacebarTargetAlpha =
          firstRunTick !== null &&
          !firstJumped &&
          ticksSinceRun >= 0 &&
          ticksSinceRun < PROMPT_SPACEBAR_VISIBLE_TICKS
            ? 1
            : 0;
        promptSpacebar.x = body.state.x;
        promptSpacebar.y = body.state.y - 70 - promptBob;
        promptSpacebar.rotation = Math.sin(promptPhase * 0.7 + Math.PI) * 0.035;
        promptSpacebar.alpha += (spacebarTargetAlpha - promptSpacebar.alpha) * 0.15;
      }

      input.endTick();
    }
    const orbState = orb.state === 'held' ? 'orb=held' : `orb=world (${orb.x.toFixed(0)},${orb.y.toFixed(0)})`;
    const graphState = `graph=${orb.pairedGraph.state}`;
    tickReadout.text = `tick ${tickCount}   avatar=(${body.state.x.toFixed(0)},${body.state.y.toFixed(0)})   ${orbState}   ${graphState}`;
  });

  console.log('Waker displacement0 (tutorial) ready: orb + graph mechanic wired up.');
}

void main();
