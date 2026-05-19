// A complete playable level: assets, ground, orb/graph, avatar wiring,
// audio triggers, win/reset state. main.ts is reduced to a thin engine
// driver that constructs one Level per "current level" and pumps tick()
// on a fixed-step loop.
//
// Per-level data lives in `src/levels/*.ts` as a `LevelConfig` literal.
// Adding a new level is data only — no changes to this file unless the
// level needs a new feature (spike, switch, moving platform, …) that
// isn't yet abstracted.

import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import type { AssetLoader } from '../engine/AssetLoader.js';
import type { Audio } from '../engine/Audio.js';
import { GraphTone } from '../engine/GraphTone.js';
import type { Input } from '../engine/Input.js';
import type { Difficulty } from '../engine/types.js';
import { Avatar } from './Avatar.js';
import { CompositeGround } from './CompositeGround.js';
import { CurveGround } from './CurveGround.js';
import { Graph } from './Graph.js';
import { BODY, Body, type MovementInputs } from './Movements.js';
import { MovingPlatform, type MovingPlatformConfig } from './MovingPlatform.js';
import { Orb } from './Orb.js';
import { loadPixelGround, type PixelGround } from './PixelGround.js';
import { Spike, type SpikeConfig } from './Spike.js';
import { Switch, type SwitchConfig } from './Switch.js';

// ─── Per-level data ────────────────────────────────────────────────────

export interface LevelConfig {
  /** Manifest keys for background, painted-floor collision, BGM. */
  bgKey: string;
  groundKey: string;
  bgmKey: string;

  /** Avatar spawn — usually high above the floor; gravity catches them. */
  spawn: { x: number; y: number };

  /** Exit portal (Flash top-left anchor). Sprite is 40×40 unless overridden. */
  exit: { x: number; y: number; w?: number; h?: number };

  /**
   * One or more orb setups. displacement0/1 have a single orb;
   * displacement2/3 use two each (the legacy `super.addGraph(...)` is
   * called twice with different graph/origin/orb positions). Each
   * setup is fully self-contained — origin marker, initial orb
   * position, paired graph rect, and stand-cradle shelf.
   */
  orbs: readonly OrbSetupConfig[];

  /** Painted-sun centroid for the procedural sun-pulse halo overlay. */
  sunCentroid: { x: number; y: number };

  /**
   * Show the runtime procedural D / SPACE key prompts. Default false:
   * by displacement1 the player has learned both controls (and the
   * tutorial bg already paints them), so the floating prompts read as
   * noise on subsequent levels. Set true only on levels where the
   * mechanic is genuinely new and the bg doesn't already advertise it.
   */
  showHelpPrompts?: boolean;

  /**
   * Optional list of spike hazards. Touching a spike teleports the
   * avatar back to `spawn` and plays the hurt SFX. Orb / graph state
   * are NOT reset (matches legacy spikeObstacle.mxml: only the player
   * is moved). Empty / undefined = no spikes.
   */
  spikes?: readonly SpikeConfig[];

  /**
   * Optional list of switches and their attached moving platforms.
   * Pressing D while overlapping a switch toggles it: flips the
   * direction of all attached platforms and (re)starts their motion.
   * Platforms act as solid ground (avatar can stand on top, blocked
   * by sides). Empty / undefined = no switches.
   */
  switches?: readonly SwitchWithPlatformsConfig[];

  /**
   * Optional next-level BUILDER (not a resolved config). When the
   * player presses SPACE on the win overlay, LevelManager calls this
   * with the current Difficulty to get the next LevelConfig and
   * loads it. Undefined = SPACE restarts the current level
   * (terminal / standalone level).
   *
   * Builder-not-config so the chain stays one source of truth while
   * each level's CONTENT (e.g., which spikes appear) varies by
   * Settings.LEVEL_DIFFICULTY at load time.
   */
  nextLevel?: LevelBuilder;
}

/**
 * A function that produces a LevelConfig for a given difficulty.
 * Each src/levels/*.ts file exports one of these. LevelManager calls
 * the builder with its currentDifficulty whenever a level is loaded
 * (initial load, transition via win overlay, jump via debug picker,
 * or difficulty change).
 */
export type LevelBuilder = (difficulty: Difficulty) => LevelConfig;

export interface SwitchWithPlatformsConfig {
  switch: SwitchConfig;
  platforms: readonly MovingPlatformConfig[];
}

/** One orb + its paired graph + origin marker + stand-cradle. */
export interface OrbSetupConfig {
  /** Origin marker: where the orb's displacement is measured FROM. */
  origin: { x: number; y: number };
  /** Initial orb position (typically directly above origin in the cradle). */
  orb: { x: number; y: number };
  /** Graph rect on the stage where this orb's curve plots. */
  graph: {
    x: number;
    y: number;
    width: number;
    height: number;
    maxValue: number;
    yOffset: number;
  };
  /** Thin orb-only shelf that holds the orb above the origin marker. */
  cradle: {
    lift: number;
    halfWidth: number;
    thickness?: number;
  };
}

// ─── Engine singletons passed in ──────────────────────────────────────

export interface LevelDeps {
  app: Application;
  assets: AssetLoader;
  avatar: Avatar;
  audio: Audio;
  input: Input;
}

// ─── Bundled textures loaded in Level.load() ──────────────────────────

interface LevelTextures {
  bg: Texture;
  ground: Texture;
  orb: Texture;
  origin: Texture;
  graphBg: Texture;
  exit: Texture;
}

// ─── Constants that aren't per-level ──────────────────────────────────

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;

const ORIGIN_MAX_GLOW_STRENGTH = 4;
const EXIT_W_DEFAULT = 40;
const EXIT_H_DEFAULT = 40;

const PROMPT_BOB_AMPLITUDE = 3;
const PROMPT_BOB_RATE = 0.12;
const PROMPT_D_RADIUS = 110;
const PROMPT_SPACEBAR_VISIBLE_TICKS = 24 * 3;
const PROMPT_RUN_VX_THRESHOLD = 4;
const PROMPT_BG_COLOR = 0xfff2c2;
const PROMPT_TEXT_COLOR = 0x1a1a1a;
const PROMPT_BORDER_COLOR = 0x1a1a1a;

const SUN_PULSE_BASE_RADIUS = 36;
const SUN_PULSE_AMPLITUDE = 8;
const SUN_PULSE_BASE_ALPHA = 0.22;
const SUN_PULSE_ALPHA_AMPLITUDE = 0.12;
const SUN_PULSE_RATE = 0.04;
const SUN_COLOR = 0xfff4c8;

const BG_SWAY_RATE = 0.006;
const BG_SWAY_AMPLITUDE = 2;

const JUMP_SFX_VARIANTS = ['sfxJump01', 'sfxJump02', 'sfxJump03', 'sfxJump04', 'sfxJump05'];
const LAND_SFX_VARIANTS = ['sfxLand01', 'sfxLand02', 'sfxLand03', 'sfxLand04', 'sfxLand05'];

const GRAPH_TONE_BASE_HZ = 220;
const GRAPH_TONE_OCTAVES = 2;

// Inset from the bottom of the avatar bbox used in moving-platform squish
// detection. Without this, body.step's ground-snap leaves the avatar's
// feet at the platform's top y — and a horizontal platform's overlap check
// "(by + bh) > platform.y" trips false-positive on float precision, so the
// platform stops every frame the avatar stands on it. 4 px is generous
// enough to absorb any rounding, narrow enough that a platform visibly
// inside the avatar's lower legs still triggers squish.
const PLATFORM_SQUISH_FEET_INSET = 4;
// Tolerance for detecting which platform the avatar is "standing on" so
// we can carry them along with the platform's motion. body.state.y should
// equal the platform's top exactly after ground-snap, but allow a couple
// of px to be safe.
const AVATAR_PLATFORM_DETECT_TOLERANCE = 2;

// ─── The Level class ──────────────────────────────────────────────────

/** Per-orb runtime bundle — keeps the parallel arrays cohesive. */
interface OrbBundle {
  readonly setup: OrbSetupConfig;
  readonly orb: Orb;
  readonly graph: Graph;
  readonly cradle: CurveGround;
  readonly originSprite: Sprite;
  readonly originGlow: GlowFilter;
}

export class Level {
  // Public for the driver / debug.
  readonly body: Body;
  readonly orbs: readonly Orb[];

  private readonly cfg: LevelConfig;
  private readonly deps: LevelDeps;

  private readonly ground: CompositeGround;
  private readonly orbGround: CompositeGround;
  private readonly orbBundles: readonly OrbBundle[];

  private readonly bgSprite: Sprite;
  private readonly groundSprite: Sprite;
  private readonly sunPulse: Graphics;
  private readonly graphLayer: Container;
  private readonly exitSprite: Sprite;
  private readonly exitGlow: GlowFilter;
  private readonly promptD: Container | null;
  private readonly promptSpacebar: Container | null;
  private readonly spikes: readonly Spike[];
  private readonly switches: readonly Switch[];
  private readonly platforms: readonly MovingPlatform[];
  private readonly winOverlay: Container;
  private readonly tickReadout: Text;

  private audioCtx: AudioContext | null = null;
  private graphTone: GraphTone | null = null;
  private audioStarted = false;
  private disposed = false;

  // The platform the avatar's feet are resting on this frame (if any).
  // Set after body.step, used during platform.tick to carry the avatar
  // along with the platform's motion.
  private avatarPlatform: MovingPlatform | null = null;

  /**
   * Hook called when the player presses SPACE on the win overlay. If
   * unset, falls back to reset() (single-level behavior). LevelManager
   * sets this to advance to cfg.nextLevel.
   */
  onWinSpacePressed: (() => void) | null = null;

  private tickCount = 0;
  private firstRunTick: number | null = null;
  private firstJumped = false;
  private firstDropped = false;
  private levelComplete = false;
  private promptPhase = 0;
  private sunPhase = 0;
  private bgSwayPhase = 0;

  /** Async factory — loads textures + pixel ground from manifest keys, then constructs. */
  static async load(cfg: LevelConfig, deps: LevelDeps): Promise<Level> {
    const [bg, ground, orb, origin, graphBg, exit] = await Promise.all([
      deps.assets.image(cfg.bgKey),
      deps.assets.image(cfg.groundKey),
      deps.assets.image('disOrb'),
      deps.assets.image('displaceOrigin'),
      deps.assets.image('graphBGD'),
      deps.assets.image('exit'),
    ]);
    const pixelGround = await loadPixelGround(deps.assets.url(cfg.groundKey));
    return new Level(cfg, deps, { bg, ground, orb, origin, graphBg, exit }, pixelGround);
  }

  private constructor(
    cfg: LevelConfig,
    deps: LevelDeps,
    tex: LevelTextures,
    pixelGround: PixelGround,
  ) {
    this.cfg = cfg;
    this.deps = deps;

    // ── Bg + sun pulse + ground silhouette ──
    this.bgSprite = new Sprite(tex.bg);
    deps.app.stage.addChild(this.bgSprite);

    this.sunPulse = new Graphics().circle(0, 0, 1).fill(SUN_COLOR);
    this.sunPulse.blendMode = 'add';
    this.sunPulse.x = cfg.sunCentroid.x;
    this.sunPulse.y = cfg.sunCentroid.y;
    deps.app.stage.addChild(this.sunPulse);

    this.groundSprite = new Sprite(tex.ground);
    deps.app.stage.addChild(this.groundSprite);

    // ── Avatar ground (painted floor + future solidified curves) ──
    this.ground = new CompositeGround();
    this.ground.add(pixelGround);

    // ── Orb ground (avatar ground + every stand cradle shelf, orb-only) ──
    this.orbGround = new CompositeGround();
    this.orbGround.add(this.ground);

    // ── Graph layer (single Container; per-orb graphs are children) ──
    this.graphLayer = new Container();
    deps.app.stage.addChild(this.graphLayer);

    // ── Build one bundle per orb setup ──
    const bundles: OrbBundle[] = [];
    for (const setup of cfg.orbs) {
      const cradleThickness = setup.cradle.thickness ?? 2;
      const cradle = new CurveGround(
        [
          {
            x: setup.origin.x - setup.cradle.halfWidth,
            y: setup.origin.y - setup.cradle.lift + cradleThickness / 2,
          },
          {
            x: setup.origin.x + setup.cradle.halfWidth,
            y: setup.origin.y - setup.cradle.lift + cradleThickness / 2,
          },
        ],
        cradleThickness,
      );
      this.orbGround.add(cradle);

      const graph = new Graph({
        graphX: setup.graph.x,
        graphY: setup.graph.y,
        width: setup.graph.width,
        height: setup.graph.height,
        maxValue: setup.graph.maxValue,
        yOffset: setup.graph.yOffset,
        background: tex.graphBg,
      });
      this.graphLayer.addChild(graph.container);

      const originSprite = new Sprite(tex.origin);
      originSprite.anchor.set(0.5, 1);
      originSprite.x = setup.origin.x;
      originSprite.y = setup.origin.y;
      const originGlow = new GlowFilter({
        color: 0xffffaa,
        distance: 20,
        outerStrength: 0,
        innerStrength: 0,
        quality: 0.3,
      });
      originSprite.filters = [originGlow];
      deps.app.stage.addChild(originSprite);

      const originX = setup.origin.x;
      const orb = new Orb({
        initialX: setup.orb.x,
        initialY: setup.orb.y,
        texture: tex.orb,
        pairedGraph: graph,
        valueProvider: (avatarX) => Math.abs(avatarX - originX),
      });
      deps.app.stage.addChild(orb.container);

      bundles.push({ setup, orb, graph, cradle, originSprite, originGlow });
    }
    this.orbBundles = bundles;
    this.orbs = bundles.map((b) => b.orb);

    // ── Exit portal ──
    this.exitSprite = new Sprite(tex.exit);
    this.exitSprite.anchor.set(0, 0);
    this.exitSprite.x = cfg.exit.x;
    this.exitSprite.y = cfg.exit.y;
    this.exitGlow = new GlowFilter({
      color: 0x66ffff,
      distance: 18,
      outerStrength: 1.5,
      innerStrength: 0,
      quality: 0.3,
    });
    this.exitSprite.filters = [this.exitGlow];
    deps.app.stage.addChild(this.exitSprite);

    // ── Procedural key prompts (default: skipped) ──
    if (cfg.showHelpPrompts) {
      this.promptD = Level.makeKeyPrompt('D', 22, 22);
      deps.app.stage.addChild(this.promptD);
      this.promptSpacebar = Level.makeKeyPrompt('SPACE', 50, 20);
      deps.app.stage.addChild(this.promptSpacebar);
    } else {
      this.promptD = null;
      this.promptSpacebar = null;
    }

    // ── Spikes ──
    // Added BEFORE the avatar so the avatar draws on top. Spike art is
    // procedural Pixi.Graphics (see src/game/Spike.ts), no texture needed.
    this.spikes = (cfg.spikes ?? []).map((s) => {
      const spike = new Spike(s);
      deps.app.stage.addChild(spike.container);
      return spike;
    });

    // ── Moving platforms + switches ──
    // Platforms add themselves to the avatar's ground stack so the avatar
    // can stand on them (and also to the orb ground so the orb can rest
    // on a stopped platform). Switches own a list of attached platforms;
    // toggling flips direction on all of them.
    const allPlatforms: MovingPlatform[] = [];
    const switches: Switch[] = [];
    for (const sw of cfg.switches ?? []) {
      const switchObj = new Switch(sw.switch);
      for (const pCfg of sw.platforms) {
        const platform = new MovingPlatform(pCfg);
        switchObj.attach(platform);
        deps.app.stage.addChild(platform.container);
        this.ground.add(platform.ground);
        allPlatforms.push(platform);
      }
      deps.app.stage.addChild(switchObj.container);
      switches.push(switchObj);
    }
    this.switches = switches;
    this.platforms = allPlatforms;

    // ── Body (avatar physics state) ──
    this.body = new Body({ x: cfg.spawn.x, y: cfg.spawn.y, onGround: false });
    deps.avatar.setPosition(this.body.state.x, this.body.state.y);
    deps.app.stage.addChild(deps.avatar.container);

    // ── Win overlay (added LAST so it draws on top) ──
    // cfg.nextLevel is a builder function (not a config), so a truthy
    // check still distinguishes "chain continues" from "terminal level."
    const winSubtitle = cfg.nextLevel
      ? 'press SPACE for next level'
      : 'press SPACE to restart';
    this.winOverlay = Level.makeWinOverlay(winSubtitle);
    deps.app.stage.addChild(this.winOverlay);

    // ── Debug tick readout (added last; underneath the win overlay) ──
    this.tickReadout = new Text({
      text: '',
      style: { fill: 0xffffff, fontFamily: 'monospace', fontSize: 12 },
    });
    this.tickReadout.anchor.set(0.5, 1);
    this.tickReadout.x = STAGE_WIDTH / 2;
    this.tickReadout.y = STAGE_HEIGHT - 8;
    deps.app.stage.addChild(this.tickReadout);
  }

  /** Run one simulation tick. Called from the engine's FixedStep driver. */
  tick(): void {
    this.tickCount++;

    // First user gesture unlocks the AudioContext + starts BGM.
    if (!this.audioStarted && this.anyGameKeyPressed()) {
      this.startAudio();
    }

    // Win-state freeze: only listen for the restart key. Visuals
    // (orb/sun/exit pulse, bg sway) still tick below so the scene
    // doesn't go static behind the overlay.
    if (this.levelComplete) {
      if (this.deps.input.wasPressed('Space')) {
        if (this.onWinSpacePressed) this.onWinSpacePressed();
        else this.reset();
      }
      this.tickVisuals();
      this.deps.input.endTick();
      return;
    }

    const moveInputs: MovementInputs = {
      moveLeft: this.deps.input.isDown('ArrowLeft'),
      moveRight: this.deps.input.isDown('ArrowRight'),
      sprint:
        this.deps.input.isDown('KeyS') ||
        this.deps.input.isDown('ShiftLeft') ||
        this.deps.input.isDown('ShiftRight'),
      jumpPressed:
        this.deps.input.wasPressed('Space') || this.deps.input.wasPressed('ArrowUp'),
    };

    // D key: pickup OR drop.
    if (this.deps.input.wasPressed('KeyD')) this.handleDKey();

    // R key: emergency restart. Same effect as the win-overlay SPACE
    // restart (reset orbs, curves, avatar, switches/platforms) — gives
    // the player an escape hatch if they wedge themselves under a
    // self-drawn curve and can't move in either direction.
    if (this.deps.input.wasPressed('KeyR')) {
      this.reset();
      this.deps.input.endTick();
      return;
    }

    // Pre-step state for jump/land SFX triggers.
    const wasOnGround = this.body.state.onGround;
    const willJump = moveInputs.jumpPressed && this.body.state.onGround;

    this.body.step(moveInputs, this.ground);

    // Boundary clamp + fall-out-of-world reset.
    if (this.body.state.x < 8) {
      this.body.state.x = 8;
      this.body.state.vx = 0;
    } else if (this.body.state.x > STAGE_WIDTH - 8) {
      this.body.state.x = STAGE_WIDTH - 8;
      this.body.state.vx = 0;
    }
    if (this.body.state.y > STAGE_HEIGHT + 200) {
      this.body.state.x = this.cfg.spawn.x;
      this.body.state.y = this.cfg.spawn.y;
      this.body.state.vx = 0;
      this.body.state.vy = 0;
      this.body.state.onGround = false;
    }

    // Jump / land SFX.
    if (willJump) this.playRandomSfx(JUMP_SFX_VARIANTS);
    if (!wasOnGround && this.body.state.onGround) this.playRandomSfx(LAND_SFX_VARIANTS);

    // Spike motion + collision. Tick first so the spike's new position is
    // the one we test against; matches legacy spikeObstacle.spikeGameLoop
    // (move, then overlap-check, all in the same pass).
    for (const spike of this.spikes) spike.tick();
    for (const spike of this.spikes) {
      if (spike.overlapsBody(this.body.state.x, this.body.state.y)) {
        this.respawnOnHit();
        break;
      }
    }

    // Detect which platform (if any) the avatar is currently standing on.
    // Must run AFTER body.step so we see the post-snap y. Used below to
    // carry the avatar with the platform if it moves this tick.
    this.avatarPlatform = null;
    if (this.body.state.onGround) {
      for (const p of this.platforms) {
        const bx = this.body.state.x;
        const by = this.body.state.y;
        if (
          bx >= p.ground.x &&
          bx <= p.ground.x + p.ground.w &&
          Math.abs(by - p.ground.y) <= AVATAR_PLATFORM_DETECT_TOLERANCE
        ) {
          this.avatarPlatform = p;
          break;
        }
      }
    }

    // Moving platforms — each ticks itself, stopping on stage edge /
    // avatar squish / other-platform collision. Avatar bbox passed in has
    // its bottom inset by PLATFORM_SQUISH_FEET_INSET so a platform passing
    // UNDER the avatar's feet doesn't false-trigger squish-stop.
    const avatarBox = {
      x: this.body.state.x - BODY.HALF_WIDTH,
      y: this.body.state.y - BODY.HEIGHT,
      w: BODY.HALF_WIDTH * 2,
      h: BODY.HEIGHT - PLATFORM_SQUISH_FEET_INSET,
    };
    for (const p of this.platforms) {
      const oldX = p.ground.x;
      const oldY = p.ground.y;
      p.tick(this.platforms, avatarBox, STAGE_WIDTH, STAGE_HEIGHT);
      // If the avatar is riding this platform AND it actually moved,
      // bring the avatar along by the same delta. Next frame's body.step
      // will resolve any side-push if the carry pushed them into a wall.
      if (p === this.avatarPlatform) {
        const dx = p.ground.x - oldX;
        const dy = p.ground.y - oldY;
        if (dx !== 0 || dy !== 0) {
          this.body.state.x += dx;
          this.body.state.y += dy;
          this.deps.avatar.setPosition(this.body.state.x, this.body.state.y);
        }
      }
    }

    // Switch pulse animations.
    for (const sw of this.switches) sw.tick();

    // Update avatar visuals + orb physics.
    this.deps.avatar.setPosition(this.body.state.x, this.body.state.y);
    this.deps.avatar.update({
      vx: this.body.state.vx,
      vy: this.body.state.vy,
      onGround: this.body.state.onGround,
      facingRight: this.body.state.facingRight,
    });

    for (const orb of this.orbs) {
      orb.update(this.body.state.x, this.body.state.y, this.orbGround);
    }

    // GraphTone — state-driven, frequency tracks value during draw.
    this.tickGraphTone();

    // Win check (after avatar/orb update so the position is final).
    if (this.avatarOverlapsExit()) {
      this.levelComplete = true;
      this.winOverlay.visible = true;
      this.deps.audio.playSfx('sfxWin', this.deps.assets.url('sfxWin'));
      if (this.graphTone?.isPlaying) this.graphTone.stop();
    }

    // Per-tick visual updates.
    this.tickVisuals();

    // Latch first-jump / first-run for the prompt visibility.
    if (moveInputs.jumpPressed) this.firstJumped = true;
    if (
      this.firstRunTick === null &&
      this.body.state.onGround &&
      Math.abs(this.body.state.vx) >= PROMPT_RUN_VX_THRESHOLD
    ) {
      this.firstRunTick = this.tickCount;
    }

    // Prompt position + alpha (no-op if hasHelpPromptsInBg).
    this.tickPrompts();

    // Debug readout. Shows a compact summary across all orbs.
    const orbsInfo = this.orbs
      .map((o, i) =>
        o.state === 'held' ? `orb${i + 1}=held` : `orb${i + 1}=(${o.x.toFixed(0)},${o.y.toFixed(0)})`,
      )
      .join('  ');
    this.tickReadout.text = `tick ${this.tickCount}   avatar=(${this.body.state.x.toFixed(
      0,
    )},${this.body.state.y.toFixed(0)})   ${orbsInfo}`;

    this.deps.input.endTick();
  }

  /** Restore level-start state. Called when the player presses restart on the win overlay. */
  reset(): void {
    this.body.state.x = this.cfg.spawn.x;
    this.body.state.y = this.cfg.spawn.y;
    this.body.state.vx = 0;
    this.body.state.vy = 0;
    this.body.state.facingRight = true;
    this.body.state.onGround = false;
    this.deps.avatar.setPosition(this.body.state.x, this.body.state.y);

    for (const b of this.orbBundles) {
      if (b.orb.state === 'held') {
        b.orb.drop(b.setup.orb.x, b.setup.orb.y);
      } else {
        b.orb.x = b.setup.orb.x;
        b.orb.y = b.setup.orb.y;
        b.orb.container.x = Math.round(b.setup.orb.x);
        b.orb.container.y = Math.round(b.setup.orb.y);
      }
      const oldCurve = b.graph.ground;
      if (oldCurve && this.ground.has(oldCurve)) this.ground.remove(oldCurve);
      b.graph.reset();
    }

    this.firstRunTick = null;
    this.firstJumped = false;
    this.firstDropped = false;
    this.levelComplete = false;

    for (const spike of this.spikes) spike.reset();
    for (const sw of this.switches) sw.reset();
    for (const p of this.platforms) p.reset();

    if (this.graphTone?.isPlaying) this.graphTone.stop();
    this.deps.audio.playSfx('sfxGraphReset', this.deps.assets.url('sfxGraphReset'));

    this.winOverlay.visible = false;
  }

  /**
   * Spike hit response. Matches legacy spikeObstacle.mxml: teleport the
   * avatar back to the entrance, zero velocity, play the hurt SFX. Orb /
   * graph / win state are NOT touched — the spike is a "soft" reset.
   */
  private respawnOnHit(): void {
    this.body.state.x = this.cfg.spawn.x;
    this.body.state.y = this.cfg.spawn.y;
    this.body.state.vx = 0;
    this.body.state.vy = 0;
    this.body.state.onGround = false;
    this.deps.avatar.setPosition(this.body.state.x, this.body.state.y);
    this.deps.audio.playSfx('sfxHurt', this.deps.assets.url('sfxHurt'));
  }

  // ─── Per-tick helpers ────────────────────────────────────────────

  private handleDKey(): void {
    // 1) Any held orb takes priority — drop it.
    const heldBundle = this.orbBundles.find((b) => b.orb.state === 'held');
    if (heldBundle) {
      const wasDrawingOrPaused =
        heldBundle.graph.state === 'drawing' || heldBundle.graph.state === 'paused';
      heldBundle.orb.drop(this.body.state.x, this.body.state.y - 20);
      this.firstDropped = true;
      if (wasDrawingOrPaused) {
        const newGround = heldBundle.graph.ground;
        if (newGround) this.ground.add(newGround);
      }
      this.deps.audio.playSfx('sfxDrop', this.deps.assets.url('sfxDrop'));
      return;
    }
    // 2) Otherwise, the first orb the avatar overlaps gets picked up.
    for (const b of this.orbBundles) {
      if (b.orb.overlapsAvatar(this.body.state.x, this.body.state.y)) {
        const old = b.graph.ground;
        if (old && this.ground.has(old)) this.ground.remove(old);
        b.orb.pickup();
        this.deps.audio.playSfx('sfxPickup', this.deps.assets.url('sfxPickup'));
        return;
      }
    }
    // 3) Falls through to switches if no orb action consumed the key.
    for (const sw of this.switches) {
      if (sw.overlapsBody(this.body.state.x, this.body.state.y)) {
        const sfxKey = sw.toggle();
        this.deps.audio.playSfx(sfxKey, this.deps.assets.url(sfxKey));
        return;
      }
    }
  }

  private tickGraphTone(): void {
    if (!this.graphTone) return;
    // GraphTone tracks the currently-held orb's graph. With multi-orb,
    // at most one orb can be held; the rest are inactive for audio.
    const heldBundle = this.orbBundles.find((b) => b.orb.state === 'held');
    const shouldPlay = !!heldBundle && heldBundle.graph.state === 'drawing';
    if (shouldPlay && !this.graphTone.isPlaying) this.graphTone.start();
    else if (!shouldPlay && this.graphTone.isPlaying) this.graphTone.stop();
    if (shouldPlay && heldBundle) {
      const value = Math.abs(this.body.state.x - heldBundle.setup.origin.x);
      this.graphTone.setNormalized(Math.min(1, value / heldBundle.setup.graph.maxValue));
    }
  }

  private tickVisuals(): void {
    // Origin proximity glow — each origin glows based on distance from
    // the avatar, falling off across its own graph's maxValue range.
    for (const b of this.orbBundles) {
      const distToOrigin = Math.abs(this.body.state.x - b.setup.origin.x);
      const proximity = Math.max(0, Math.min(1, 1 - distToOrigin / b.setup.graph.maxValue));
      b.originGlow.outerStrength = proximity * ORIGIN_MAX_GLOW_STRENGTH;
    }

    // Exit portal pulse + shared phase.
    this.promptPhase += PROMPT_BOB_RATE;
    this.exitGlow.outerStrength = 1.5 + Math.sin(this.promptPhase * 0.5) * 1.0;

    // Sun pulse — scale + alpha on the pre-drawn 1-px disc.
    this.sunPhase += SUN_PULSE_RATE;
    const sunSin = Math.sin(this.sunPhase);
    this.sunPulse.scale.set(SUN_PULSE_BASE_RADIUS + sunSin * SUN_PULSE_AMPLITUDE);
    this.sunPulse.alpha = SUN_PULSE_BASE_ALPHA + sunSin * SUN_PULSE_ALPHA_AMPLITUDE;

    // Bg horizontal sway.
    this.bgSwayPhase += BG_SWAY_RATE;
    const bgOffset = Math.sin(this.bgSwayPhase) * BG_SWAY_AMPLITUDE;
    this.bgSprite.x = bgOffset;
    this.groundSprite.x = bgOffset;
  }

  private tickPrompts(): void {
    const promptBob = Math.sin(this.promptPhase) * PROMPT_BOB_AMPLITUDE;

    if (this.promptD) {
      // With multi-orb, pin the prompt to whichever orb is the most
      // relevant: a held orb if any, else the nearest world-positioned
      // orb. Fades in if the avatar is near (or holding).
      const heldBundle = this.orbBundles.find((b) => b.orb.state === 'held');
      let anchorOrb = heldBundle?.orb ?? null;
      let nearestDist = Number.POSITIVE_INFINITY;
      if (!anchorOrb) {
        for (const b of this.orbBundles) {
          const dx = this.body.state.x - b.orb.x;
          const dy = this.body.state.y - b.orb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            anchorOrb = b.orb;
          }
        }
      }
      let targetAlpha = 0;
      if (!this.firstDropped && anchorOrb) {
        if (anchorOrb.state === 'held' || nearestDist < PROMPT_D_RADIUS) targetAlpha = 1;
      }
      if (anchorOrb) {
        this.promptD.x = anchorOrb.x;
        this.promptD.y = anchorOrb.y - 28 + promptBob;
        this.promptD.rotation = Math.sin(this.promptPhase * 0.7) * 0.035;
      }
      this.promptD.alpha += (targetAlpha - this.promptD.alpha) * 0.15;
    }

    if (this.promptSpacebar) {
      const ticksSinceRun =
        this.firstRunTick === null ? -1 : this.tickCount - this.firstRunTick;
      const targetAlpha =
        this.firstRunTick !== null &&
        !this.firstJumped &&
        ticksSinceRun >= 0 &&
        ticksSinceRun < PROMPT_SPACEBAR_VISIBLE_TICKS
          ? 1
          : 0;
      this.promptSpacebar.x = this.body.state.x;
      this.promptSpacebar.y = this.body.state.y - 70 - promptBob;
      this.promptSpacebar.rotation = Math.sin(this.promptPhase * 0.7 + Math.PI) * 0.035;
      this.promptSpacebar.alpha += (targetAlpha - this.promptSpacebar.alpha) * 0.15;
    }
  }

  private avatarOverlapsExit(): boolean {
    const ex = this.cfg.exit.x;
    const ey = this.cfg.exit.y;
    const ew = this.cfg.exit.w ?? EXIT_W_DEFAULT;
    const eh = this.cfg.exit.h ?? EXIT_H_DEFAULT;
    const ax0 = this.body.state.x - BODY.HALF_WIDTH;
    const ax1 = this.body.state.x + BODY.HALF_WIDTH;
    const ay0 = this.body.state.y - BODY.HEIGHT;
    const ay1 = this.body.state.y;
    return ax0 < ex + ew && ax1 > ex && ay0 < ey + eh && ay1 > ey;
  }

  private anyGameKeyPressed(): boolean {
    const i = this.deps.input;
    return (
      i.wasPressed('Space') ||
      i.wasPressed('ArrowUp') ||
      i.wasPressed('ArrowLeft') ||
      i.wasPressed('ArrowRight') ||
      i.wasPressed('KeyD') ||
      i.wasPressed('KeyS') ||
      i.wasPressed('ShiftLeft') ||
      i.wasPressed('ShiftRight')
    );
  }

  /**
   * Public so LevelManager can pre-start audio on the new level after
   * a SPACE-press transition (the press is itself a user gesture, so
   * the browser audio unlock requirement is satisfied). Idempotent.
   */
  startAudio(): void {
    if (this.audioStarted) return;
    this.audioStarted = true;
    this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    this.graphTone = new GraphTone(this.audioCtx, {
      baseHz: GRAPH_TONE_BASE_HZ,
      octaves: GRAPH_TONE_OCTAVES,
    });
    this.deps.audio.playBgm(this.cfg.bgmKey, this.deps.assets.url(this.cfg.bgmKey));
  }

  /**
   * Remove all level-owned objects from the Pixi stage and release the
   * AudioContext + GraphTone. The shared avatar/audio/input singletons
   * are NOT disposed (caller / next Level reuses them). Safe to call
   * once; subsequent tick() calls become no-ops.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.graphTone?.isPlaying) this.graphTone.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
    this.graphTone = null;

    // Remove every level-owned object from the stage. Avatar.container
    // is shared (not owned) so we just unparent it; the next Level will
    // re-addChild it cleanly.
    const owned: (Container | Sprite | Graphics | Text)[] = [
      this.bgSprite,
      this.sunPulse,
      this.groundSprite,
      this.graphLayer,
      this.exitSprite,
      this.winOverlay,
      this.tickReadout,
    ];
    for (const b of this.orbBundles) {
      owned.push(b.originSprite, b.orb.container);
    }
    if (this.promptD) owned.push(this.promptD);
    if (this.promptSpacebar) owned.push(this.promptSpacebar);
    for (const s of this.spikes) owned.push(s.container);
    for (const p of this.platforms) owned.push(p.container);
    for (const sw of this.switches) owned.push(sw.container);
    for (const o of owned) {
      if (o.parent) o.parent.removeChild(o);
    }
    if (this.deps.avatar.container.parent) {
      this.deps.avatar.container.parent.removeChild(this.deps.avatar.container);
    }
  }

  private playRandomSfx(variants: readonly string[]): void {
    const key = variants[Math.floor(Math.random() * variants.length)]!;
    this.deps.audio.playSfx(key, this.deps.assets.url(key));
  }

  // ─── Static factories ────────────────────────────────────────────

  private static makeKeyPrompt(label: string, width: number, height: number): Container {
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
  }

  private static makeWinOverlay(subtitle: string): Container {
    const c = new Container();
    c.visible = false;
    const dim = new Graphics()
      .rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.55 });
    c.addChild(dim);
    const title = new Text({
      text: 'Level Complete',
      style: {
        fill: 0xffffff,
        fontFamily: 'sans-serif',
        fontSize: 48,
        fontWeight: '700',
        align: 'center',
      },
    });
    title.anchor.set(0.5, 1);
    title.x = STAGE_WIDTH / 2;
    title.y = STAGE_HEIGHT / 2 - 8;
    c.addChild(title);
    const sub = new Text({
      text: subtitle,
      style: { fill: 0xffeec8, fontFamily: 'sans-serif', fontSize: 16, align: 'center' },
    });
    sub.anchor.set(0.5, 0);
    sub.x = STAGE_WIDTH / 2;
    sub.y = STAGE_HEIGHT / 2 + 12;
    c.addChild(sub);
    return c;
  }
}
