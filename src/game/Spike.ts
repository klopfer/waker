// Ported from legacy/src/spikeClass.mxml + spikeObstacle.mxml. A spike is
// a deadly sprite that either sits still or oscillates between two
// coordinates along a single axis. Touching it teleports the player back
// to the level's entrance and plays the hurt SFX (handled in Level.ts).
//
// Pure motion + AABB-overlap logic is exported as standalone functions so
// the unit tests don't need a Pixi runtime; the Spike class is a thin
// wrapper that pairs that logic with a Sprite.

import { Sprite, type Texture } from 'pixi.js';
import { BODY } from './Movements.js';

export interface SpikeConfig {
  /** Top-left x in stage space (matches legacy `spike.x = posX`). */
  x: number;
  /** Top-left y in stage space. */
  y: number;
  /** False = stationary; remaining motion fields are ignored. */
  isMoving?: boolean;
  /** True = oscillate along x; false = along y. Only meaningful if isMoving. */
  horizontal?: boolean;
  /** Initial direction: true = up (vertical) / left (horizontal). */
  upOrLeft?: boolean;
  /** Lower bound on the oscillation axis. Must be < turn2. */
  turn?: number;
  /** Upper bound on the oscillation axis. */
  turn2?: number;
  /** Pixels per simulation tick. */
  speed?: number;
}

/** Mutable per-spike state advanced by `stepSpikeMotion`. */
export interface SpikeMotionState {
  x: number;
  y: number;
  upOrLeft: boolean;
}

/**
 * Advance a moving spike by one tick. Matches legacy spikeObstacle.mxml
 * spikeGameLoop: move in the current direction, flip direction at the
 * boundary. Stationary spikes are a no-op.
 */
export function stepSpikeMotion(state: SpikeMotionState, cfg: Required<SpikeConfig>): void {
  if (!cfg.isMoving || cfg.speed <= 0) return;
  if (cfg.horizontal) {
    if (state.upOrLeft) {
      state.x -= cfg.speed;
      if (state.x < cfg.turn) state.upOrLeft = false;
    } else {
      state.x += cfg.speed;
      if (state.x > cfg.turn2) state.upOrLeft = true;
    }
  } else {
    if (state.upOrLeft) {
      state.y -= cfg.speed;
      if (state.y < cfg.turn) state.upOrLeft = false;
    } else {
      state.y += cfg.speed;
      if (state.y > cfg.turn2) state.upOrLeft = true;
    }
  }
}

/**
 * AABB overlap between the avatar body box (anchor: bottom-center at
 * `bx`/`by`, dims from `BODY`) and a spike sprite (anchor: top-left at
 * `sx`/`sy`, dims `sw`×`sh`). Used in place of the legacy pixel-perfect
 * test — bbox is fine here because the spike art fills its bounding box.
 */
export function spikeOverlapsBody(
  bx: number,
  by: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): boolean {
  const ax0 = bx - BODY.HALF_WIDTH;
  const ax1 = bx + BODY.HALF_WIDTH;
  const ay0 = by - BODY.HEIGHT;
  const ay1 = by;
  return ax0 < sx + sw && ax1 > sx && ay0 < sy + sh && ay1 > sy;
}

function normalizeConfig(cfg: SpikeConfig): Required<SpikeConfig> {
  return {
    x: cfg.x,
    y: cfg.y,
    isMoving: cfg.isMoving ?? false,
    horizontal: cfg.horizontal ?? false,
    upOrLeft: cfg.upOrLeft ?? false,
    turn: cfg.turn ?? 0,
    turn2: cfg.turn2 ?? 0,
    speed: cfg.speed ?? 0,
  };
}

export class Spike {
  readonly container: Sprite;
  readonly width: number;
  readonly height: number;
  readonly state: SpikeMotionState;

  private readonly normCfg: Required<SpikeConfig>;

  constructor(cfg: SpikeConfig, texture: Texture) {
    this.normCfg = normalizeConfig(cfg);
    this.container = new Sprite(texture);
    this.container.x = this.normCfg.x;
    this.container.y = this.normCfg.y;
    this.width = this.container.width;
    this.height = this.container.height;
    this.state = {
      x: this.normCfg.x,
      y: this.normCfg.y,
      upOrLeft: this.normCfg.upOrLeft,
    };
  }

  /** Advance motion + sync sprite. Caller decides ordering vs. body.step. */
  tick(): void {
    stepSpikeMotion(this.state, this.normCfg);
    this.container.x = this.state.x;
    this.container.y = this.state.y;
  }

  /** True if the spike's bbox overlaps the avatar body bbox. */
  overlapsBody(bx: number, by: number): boolean {
    return spikeOverlapsBody(bx, by, this.state.x, this.state.y, this.width, this.height);
  }

  /** Restore the spike's start-of-level position + direction. */
  reset(): void {
    this.state.x = this.normCfg.x;
    this.state.y = this.normCfg.y;
    this.state.upOrLeft = this.normCfg.upOrLeft;
    this.container.x = this.state.x;
    this.container.y = this.state.y;
  }
}
