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
import { Avatar } from './Avatar.js';
import { CompositeGround } from './CompositeGround.js';
import { CurveGround } from './CurveGround.js';
import { Graph } from './Graph.js';
import { BODY, Body, type MovementInputs } from './Movements.js';
import { Orb } from './Orb.js';
import { loadPixelGround, type PixelGround } from './PixelGround.js';
import { Spike, type SpikeConfig } from './Spike.js';

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

  /** Origin marker (where the orb's displacement is measured from). */
  origin: { x: number; y: number };

  /** Initial orb position. */
  orb: { x: number; y: number };

  /** Graph rect + scale + yOffset, all from the legacy `addGraph(...)` call. */
  graph: {
    x: number;
    y: number;
    width: number;
    height: number;
    maxValue: number;
    yOffset: number;
  };

  /** Stand cradle (an orb-only thin shelf the orb rests on at level start). */
  cradle: {
    lift: number; // px above origin Y
    halfWidth: number;
    thickness?: number; // default 2
  };

  /** Painted-sun centroid for the procedural sun-pulse halo overlay. */
  sunCentroid: { x: number; y: number };

  /**
   * True if the painted bg already has D / ↑ / SPACEBAR help glyphs
   * baked in (tutorial levels). Skips the runtime procedural prompts
   * so we don't stack them on the painted ones.
   */
  hasHelpPromptsInBg: boolean;

  /**
   * Optional list of spike hazards. Touching a spike teleports the
   * avatar back to `spawn` and plays the hurt SFX. Orb / graph state
   * are NOT reset (matches legacy spikeObstacle.mxml: only the player
   * is moved). Empty / undefined = no spikes.
   */
  spikes?: readonly SpikeConfig[];
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
  spike: Texture | null;
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

// ─── The Level class ──────────────────────────────────────────────────

export class Level {
  // Public for the driver / debug.
  readonly body: Body;
  readonly orb: Orb;
  readonly graph: Graph;

  private readonly cfg: LevelConfig;
  private readonly deps: LevelDeps;

  private readonly ground: CompositeGround;
  private readonly orbGround: CompositeGround;
  private readonly standCradle: CurveGround;

  private readonly bgSprite: Sprite;
  private readonly groundSprite: Sprite;
  private readonly sunPulse: Graphics;
  private readonly graphLayer: Container;
  private readonly originSprite: Sprite;
  private readonly originGlow: GlowFilter;
  private readonly exitSprite: Sprite;
  private readonly exitGlow: GlowFilter;
  private readonly promptD: Container | null;
  private readonly promptSpacebar: Container | null;
  private readonly spikes: readonly Spike[];
  private readonly winOverlay: Container;
  private readonly tickReadout: Text;

  private audioCtx: AudioContext | null = null;
  private graphTone: GraphTone | null = null;
  private audioStarted = false;

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
    const needsSpike = !!cfg.spikes && cfg.spikes.length > 0;
    const [bg, ground, orb, origin, graphBg, exit, spike] = await Promise.all([
      deps.assets.image(cfg.bgKey),
      deps.assets.image(cfg.groundKey),
      deps.assets.image('disOrb'),
      deps.assets.image('displaceOrigin'),
      deps.assets.image('graphBGD'),
      deps.assets.image('exit'),
      needsSpike ? deps.assets.image('spikeyObjects') : Promise.resolve(null),
    ]);
    const pixelGround = await loadPixelGround(deps.assets.url(cfg.groundKey));
    return new Level(
      cfg,
      deps,
      { bg, ground, orb, origin, graphBg, exit, spike },
      pixelGround,
    );
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

    // ── Orb ground (avatar ground + stand cradle shelf, orb-only) ──
    const cradleThickness = cfg.cradle.thickness ?? 2;
    this.standCradle = new CurveGround(
      [
        {
          x: cfg.origin.x - cfg.cradle.halfWidth,
          y: cfg.origin.y - cfg.cradle.lift + cradleThickness / 2,
        },
        {
          x: cfg.origin.x + cfg.cradle.halfWidth,
          y: cfg.origin.y - cfg.cradle.lift + cradleThickness / 2,
        },
      ],
      cradleThickness,
    );
    this.orbGround = new CompositeGround();
    this.orbGround.add(this.ground);
    this.orbGround.add(this.standCradle);

    // ── Graph layer ──
    this.graphLayer = new Container();
    deps.app.stage.addChild(this.graphLayer);
    this.graph = new Graph({
      graphX: cfg.graph.x,
      graphY: cfg.graph.y,
      width: cfg.graph.width,
      height: cfg.graph.height,
      maxValue: cfg.graph.maxValue,
      yOffset: cfg.graph.yOffset,
      background: tex.graphBg,
    });
    this.graphLayer.addChild(this.graph.container);

    // ── Origin marker (with proximity glow) ──
    this.originSprite = new Sprite(tex.origin);
    this.originSprite.anchor.set(0.5, 1);
    this.originSprite.x = cfg.origin.x;
    this.originSprite.y = cfg.origin.y;
    this.originGlow = new GlowFilter({
      color: 0xffffaa,
      distance: 20,
      outerStrength: 0,
      innerStrength: 0,
      quality: 0.3,
    });
    this.originSprite.filters = [this.originGlow];
    deps.app.stage.addChild(this.originSprite);

    // ── Orb ──
    this.orb = new Orb({
      initialX: cfg.orb.x,
      initialY: cfg.orb.y,
      texture: tex.orb,
      pairedGraph: this.graph,
      valueProvider: (avatarX) => Math.abs(avatarX - cfg.origin.x),
    });
    deps.app.stage.addChild(this.orb.container);

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

    // ── Procedural key prompts (skipped on tutorial levels) ──
    if (cfg.hasHelpPromptsInBg) {
      this.promptD = null;
      this.promptSpacebar = null;
    } else {
      this.promptD = Level.makeKeyPrompt('D', 22, 22);
      deps.app.stage.addChild(this.promptD);
      this.promptSpacebar = Level.makeKeyPrompt('SPACE', 50, 20);
      deps.app.stage.addChild(this.promptSpacebar);
    }

    // ── Spikes ──
    // Added BEFORE the avatar so the avatar draws on top. If cfg.spikes
    // is set, tex.spike was loaded in Level.load() — assert for safety.
    if (cfg.spikes && cfg.spikes.length > 0) {
      if (!tex.spike) {
        throw new Error('Level: spike texture missing but cfg.spikes is non-empty');
      }
      const spikeTex = tex.spike;
      this.spikes = cfg.spikes.map((s) => {
        const spike = new Spike(s, spikeTex);
        deps.app.stage.addChild(spike.container);
        return spike;
      });
    } else {
      this.spikes = [];
    }

    // ── Body (avatar physics state) ──
    this.body = new Body({ x: cfg.spawn.x, y: cfg.spawn.y, onGround: false });
    deps.avatar.setPosition(this.body.state.x, this.body.state.y);
    deps.app.stage.addChild(deps.avatar.container);

    // ── Win overlay (added LAST so it draws on top) ──
    this.winOverlay = Level.makeWinOverlay();
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
      if (this.deps.input.wasPressed('Space')) this.reset();
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

    // Update avatar visuals + orb physics.
    this.deps.avatar.setPosition(this.body.state.x, this.body.state.y);
    this.deps.avatar.update({
      vx: this.body.state.vx,
      vy: this.body.state.vy,
      onGround: this.body.state.onGround,
      facingRight: this.body.state.facingRight,
    });

    this.orb.update(this.body.state.x, this.body.state.y, this.orbGround);

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

    // Debug readout.
    const orbState =
      this.orb.state === 'held'
        ? 'orb=held'
        : `orb=world (${this.orb.x.toFixed(0)},${this.orb.y.toFixed(0)})`;
    const graphState = `graph=${this.orb.pairedGraph.state}`;
    this.tickReadout.text = `tick ${this.tickCount}   avatar=(${this.body.state.x.toFixed(
      0,
    )},${this.body.state.y.toFixed(0)})   ${orbState}   ${graphState}`;

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

    if (this.orb.state === 'held') {
      this.orb.drop(this.cfg.orb.x, this.cfg.orb.y);
    } else {
      this.orb.x = this.cfg.orb.x;
      this.orb.y = this.cfg.orb.y;
      this.orb.container.x = Math.round(this.cfg.orb.x);
      this.orb.container.y = Math.round(this.cfg.orb.y);
    }

    const oldCurve = this.graph.ground;
    if (oldCurve && this.ground.has(oldCurve)) this.ground.remove(oldCurve);
    this.graph.reset();

    this.firstRunTick = null;
    this.firstJumped = false;
    this.firstDropped = false;
    this.levelComplete = false;

    for (const spike of this.spikes) spike.reset();

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
    if (this.orb.state === 'held') {
      const wasDrawingOrPaused =
        this.orb.pairedGraph.state === 'drawing' || this.orb.pairedGraph.state === 'paused';
      this.orb.drop(this.body.state.x, this.body.state.y - 20);
      this.firstDropped = true;
      if (wasDrawingOrPaused) {
        const newGround = this.orb.pairedGraph.ground;
        if (newGround) this.ground.add(newGround);
      }
      this.deps.audio.playSfx('sfxDrop', this.deps.assets.url('sfxDrop'));
    } else if (this.orb.overlapsAvatar(this.body.state.x, this.body.state.y)) {
      const old = this.orb.pairedGraph.ground;
      if (old && this.ground.has(old)) this.ground.remove(old);
      this.orb.pickup();
      this.deps.audio.playSfx('sfxPickup', this.deps.assets.url('sfxPickup'));
    }
  }

  private tickGraphTone(): void {
    if (!this.graphTone) return;
    const shouldPlay = this.orb.state === 'held' && this.graph.state === 'drawing';
    if (shouldPlay && !this.graphTone.isPlaying) this.graphTone.start();
    else if (!shouldPlay && this.graphTone.isPlaying) this.graphTone.stop();
    if (shouldPlay) {
      const value = Math.abs(this.body.state.x - this.cfg.origin.x);
      this.graphTone.setNormalized(Math.min(1, value / this.cfg.graph.maxValue));
    }
  }

  private tickVisuals(): void {
    // Origin proximity glow.
    const distToOrigin = Math.abs(this.body.state.x - this.cfg.origin.x);
    const proximity = Math.max(0, Math.min(1, 1 - distToOrigin / this.cfg.graph.maxValue));
    this.originGlow.outerStrength = proximity * ORIGIN_MAX_GLOW_STRENGTH;

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
      let targetAlpha = 0;
      if (!this.firstDropped) {
        if (this.orb.state === 'held') {
          targetAlpha = 1;
        } else {
          const dx = this.body.state.x - this.orb.x;
          const dy = this.body.state.y - this.orb.y;
          if (Math.sqrt(dx * dx + dy * dy) < PROMPT_D_RADIUS) targetAlpha = 1;
        }
      }
      this.promptD.x = this.orb.x;
      this.promptD.y = this.orb.y - 28 + promptBob;
      this.promptD.rotation = Math.sin(this.promptPhase * 0.7) * 0.035;
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

  private startAudio(): void {
    this.audioStarted = true;
    this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    this.graphTone = new GraphTone(this.audioCtx, {
      baseHz: GRAPH_TONE_BASE_HZ,
      octaves: GRAPH_TONE_OCTAVES,
    });
    this.deps.audio.playBgm(this.cfg.bgmKey, this.deps.assets.url(this.cfg.bgmKey));
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

  private static makeWinOverlay(): Container {
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
      text: 'press SPACE to restart',
      style: { fill: 0xffeec8, fontFamily: 'sans-serif', fontSize: 16, align: 'center' },
    });
    sub.anchor.set(0.5, 0);
    sub.x = STAGE_WIDTH / 2;
    sub.y = STAGE_HEIGHT / 2 + 12;
    c.addChild(sub);
    return c;
  }
}
