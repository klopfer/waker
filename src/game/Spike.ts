// Ported from legacy/src/spikeClass.mxml + spikeObstacle.mxml. A spike is
// a deadly hazard that either sits still or oscillates between two
// coordinates along a single axis. Touching one teleports the avatar
// back to spawn and plays the hurt SFX (handled in Level.ts).
//
// The original game's spike art (extracted as `tempObs/Portal.png`)
// rasterized to a fully-opaque 20×20 black rectangle — JPEXS captured
// just the SWF symbol's bbox, not its actual irregular silhouette. The
// real on-screen shape (per Ruffle screenshots: legacy/screenshots/
// Screenshot 2026-05-18 1337*.png) is a dark organic blob with a
// brown/orange spiral painted inside, slowly rotating. We draw that
// directly with Pixi.Graphics rather than fight the broken extraction.
//
// Pure motion + AABB-overlap logic is exported as standalone functions
// so the unit tests don't need a Pixi runtime; the Spike class is a
// thin wrapper that pairs that logic with the drawn graphics.

import { Container, Graphics } from 'pixi.js';
import { BODY } from './Movements.js';

export interface SpikeConfig {
  /** Top-left x of the spike bbox in stage space (matches legacy `spike.x = posX`). */
  x: number;
  /** Top-left y of the spike bbox in stage space. */
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

// ── Sizing ──
// Match the legacy 20×20 sprite bbox exactly. Earlier 30×30 was too big
// relative to the avatar (read as "challenging-by-accident" and visibly
// lodged into platforms because the visible blob bottom extended below
// posY + bboxHeight). With 20×20 and the blob+bumps tuned to fit just
// inside the bbox, the visible bottom sits at ~posY+19 — touching the
// platform top at legacy-authored coords without sinking into it.
export const SPIKE_BBOX_W = 20;
export const SPIKE_BBOX_H = 20;
const BLOB_RADIUS = 7;
const BLOB_BUMP_COUNT = 6;
const BLOB_BUMP_RADIUS = 4;
const BLOB_BUMP_DIST = 5;
const SPIRAL_MAX_RADIUS = 4.5;
const SPIRAL_TURNS = 2.25;
const SPIRAL_THICKNESS = 1.25;
const SPIRAL_SEGMENTS = 48;
const SPIRAL_ROTATION_PER_TICK = 0.06; // ~½ rotation/sec at 24 Hz

// Colors sampled from the Ruffle screenshot of displacement0 hard-mode:
//   blob silhouette ≈ very dark warm black
//   spiral fill     ≈ warm rust / brown
const BLOB_COLOR = 0x1a0e0a;
const SPIRAL_COLOR = 0x8b4513;

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
 * `bx`/`by`, dims from `BODY`) and a spike bbox (anchor: top-left at
 * `sx`/`sy`, dims `sw`×`sh`).
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

/** Build the irregular dark silhouette: 1 center disc + 6 perimeter bumps. */
function drawBlob(g: Graphics): void {
  g.circle(0, 0, BLOB_RADIUS).fill({ color: BLOB_COLOR });
  for (let i = 0; i < BLOB_BUMP_COUNT; i++) {
    const t = (i / BLOB_BUMP_COUNT) * Math.PI * 2;
    g.circle(
      Math.cos(t) * BLOB_BUMP_DIST,
      Math.sin(t) * BLOB_BUMP_DIST,
      BLOB_BUMP_RADIUS,
    ).fill({ color: BLOB_COLOR });
  }
}

/** Draw the inward spiral as a connected polyline. */
function drawSpiral(g: Graphics): void {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= SPIRAL_SEGMENTS; i++) {
    const t = i / SPIRAL_SEGMENTS;
    const angle = t * SPIRAL_TURNS * Math.PI * 2;
    const r = t * SPIRAL_MAX_RADIUS;
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  g.stroke({ color: SPIRAL_COLOR, width: SPIRAL_THICKNESS, cap: 'round' });
}

export class Spike {
  readonly container: Container;
  readonly width = SPIKE_BBOX_W;
  readonly height = SPIKE_BBOX_H;
  readonly state: SpikeMotionState;

  private readonly normCfg: Required<SpikeConfig>;
  private readonly spiralGfx: Graphics;

  constructor(cfg: SpikeConfig) {
    this.normCfg = normalizeConfig(cfg);

    this.container = new Container();
    this.container.x = this.normCfg.x;
    this.container.y = this.normCfg.y;

    const blob = new Graphics();
    drawBlob(blob);
    blob.x = SPIKE_BBOX_W / 2;
    blob.y = SPIKE_BBOX_H / 2;
    this.container.addChild(blob);

    this.spiralGfx = new Graphics();
    drawSpiral(this.spiralGfx);
    this.spiralGfx.x = SPIKE_BBOX_W / 2;
    this.spiralGfx.y = SPIKE_BBOX_H / 2;
    this.container.addChild(this.spiralGfx);

    this.state = {
      x: this.normCfg.x,
      y: this.normCfg.y,
      upOrLeft: this.normCfg.upOrLeft,
    };
  }

  /** Advance motion + spiral rotation + sync container position. */
  tick(): void {
    stepSpikeMotion(this.state, this.normCfg);
    this.container.x = this.state.x;
    this.container.y = this.state.y;
    this.spiralGfx.rotation += SPIRAL_ROTATION_PER_TICK;
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
    this.spiralGfx.rotation = 0;
  }
}
