import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CurveGround, type CurvePoint } from './CurveGround.js';

export type GraphState = 'idle' | 'drawing' | 'paused' | 'solid';

// Matches the legacy `delay = 96` in genericGraph.mxml — the live curve
// pauses for this many timer units (≈4 sec at 1.5/tick, 24 fps) at the
// right edge of the graph before auto-resetting and redrawing from x=0.
const PAUSE_DELAY = 96;

export interface GraphOptions {
  /** World-space x/y of the graph's top-left. */
  graphX: number;
  graphY: number;
  width: number;
  height: number;
  /**
   * Value range that maps to the full graph height. A value of `+maxValue`
   * draws at the top of the graph; `-maxValue` at the bottom.
   */
  maxValue: number;
  yOffset?: number;
  background?: Texture;
  /** RGB hex (e.g. 0x009804) — color of the live curve while drawing. */
  drawColor?: number;
  /** RGB hex of the curve once the player drops the orb and the graph solidifies. */
  solidColor?: number;
  drawWidth?: number;
  /** Stroke + collision thickness once solidified. Original game uses 14. */
  solidWidth?: number;
  /** Pixels of x advance per simulation tick. Original game uses 1.5. */
  speedPerTick?: number;
}

const SPARK_BASE_RADIUS = 8;
const SPARK_PULSE_AMPLITUDE = 3;
const SPARK_PULSE_RATE = 0.25; // radians per tick

interface GraphConfig {
  graphX: number;
  graphY: number;
  width: number;
  height: number;
  maxValue: number;
  yOffset: number;
  drawColor: number;
  solidColor: number;
  drawWidth: number;
  solidWidth: number;
  speedPerTick: number;
}

export class Graph {
  readonly container: Container;
  private readonly path: Graphics;
  private readonly spark: Graphics;
  state: GraphState = 'idle';

  private timer = 0;
  private pauseTimer = 0;
  private points: CurvePoint[] = [];
  private solidGround: CurveGround | null = null;
  private pulsePhase = 0;
  private readonly cfg: GraphConfig;

  constructor(opts: GraphOptions) {
    this.cfg = {
      graphX: opts.graphX,
      graphY: opts.graphY,
      width: opts.width,
      height: opts.height,
      maxValue: opts.maxValue,
      yOffset: opts.yOffset ?? 0,
      drawColor: opts.drawColor ?? 0x009804,
      solidColor: opts.solidColor ?? 0x000000,
      drawWidth: opts.drawWidth ?? 5,
      solidWidth: opts.solidWidth ?? 14,
      speedPerTick: opts.speedPerTick ?? 1.5,
    };

    this.container = new Container();
    this.container.x = opts.graphX;
    this.container.y = opts.graphY;

    if (opts.background) {
      const bg = new Sprite(opts.background);
      bg.width = opts.width;
      bg.height = opts.height;
      bg.alpha = 0.2;
      this.container.addChild(bg);
    }

    this.path = new Graphics();
    this.container.addChild(this.path);

    // Procedurally-drawn glowing dot at the head of the live curve. Two
    // concentric circles + 'add' blend gives a soft bloom that reads as
    // a glow on top of the graph background.
    this.spark = new Graphics();
    this.spark.blendMode = 'add';
    this.spark.visible = false;
    this.container.addChild(this.spark);

    // Mask the graph contents to its rect. Without this, drawing past the
    // graph's logical width or beyond the y-range bleeds into the rest of
    // the level (the original Flex Canvas auto-clipped its children).
    const mask = new Graphics().rect(0, 0, opts.width, opts.height).fill(0xffffff);
    this.container.addChild(mask);
    this.container.mask = mask;
  }

  startDrawing(): void {
    this.state = 'drawing';
    this.timer = 0;
    this.pauseTimer = 0;
    this.points = [];
    this.solidGround = null;
    this.path.clear();
    this.spark.visible = true;
    this.pulsePhase = 0;
  }

  /**
   * Advance one simulation tick of the live graph. While drawing, appends
   * the next point. When the timer reaches the graph width, transitions to
   * `paused`; after PAUSE_DELAY units of pause-time the graph clears and
   * restarts drawing from x=0 (mirrors the original game's "draw → flash →
   * reset" cycle while the orb is still held).
   */
  tick(value: number): void {
    if (this.state === 'idle' || this.state === 'solid') return;

    if (this.state === 'paused') {
      this.pauseTimer += this.cfg.speedPerTick;
      if (this.pauseTimer >= PAUSE_DELAY) {
        // Restart from scratch, replotting the current value at x=0.
        this.timer = 0;
        this.pauseTimer = 0;
        this.points = [];
        this.path.clear();
        this.state = 'drawing';
        this.spark.visible = true;
      }
      return;
    }

    // state === 'drawing'
    if (this.timer >= this.cfg.width) {
      this.state = 'paused';
      this.pauseTimer = 0;
      this.spark.visible = false;
      this.spark.clear();
      return;
    }

    const localY = this.relativeValue(value) + this.cfg.yOffset;
    const localX = this.timer;
    this.points.push({ x: localX, y: localY });

    if (this.points.length === 1) {
      this.path.moveTo(localX, localY);
    } else {
      this.path.lineTo(localX, localY);
    }
    this.path.stroke({ color: this.cfg.drawColor, width: this.cfg.drawWidth });

    this.pulsePhase += SPARK_PULSE_RATE;
    const r = SPARK_BASE_RADIUS + Math.sin(this.pulsePhase) * SPARK_PULSE_AMPLITUDE;
    this.spark.clear();
    this.spark.circle(localX, localY, r * 1.6).fill({ color: this.cfg.drawColor, alpha: 0.25 });
    this.spark.circle(localX, localY, r).fill({ color: 0xffffff, alpha: 0.95 });

    this.timer += this.cfg.speedPerTick;
  }

  /**
   * Lock the curve in. Returns a CurveGround in *world* coordinates that the
   * level should add to its CompositeGround so the avatar can stand on the
   * solidified curve. Returns null if the player dropped the orb before
   * accumulating enough points to be useful as a platform.
   */
  solidify(): CurveGround | null {
    if ((this.state !== 'drawing' && this.state !== 'paused') || this.points.length < 2) {
      this.reset();
      return null;
    }
    this.state = 'solid';
    this.pauseTimer = 0;
    this.spark.visible = false;
    this.spark.clear();

    this.path.clear();
    const first = this.points[0]!;
    this.path.moveTo(first.x, first.y);
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i]!;
      this.path.lineTo(p.x, p.y);
    }
    this.path.stroke({ color: this.cfg.solidColor, width: this.cfg.solidWidth });

    const worldPoints: CurvePoint[] = this.points.map((p) => ({
      x: p.x + this.cfg.graphX,
      y: p.y + this.cfg.graphY,
    }));
    this.solidGround = new CurveGround(worldPoints, this.cfg.solidWidth);
    return this.solidGround;
  }

  reset(): void {
    this.state = 'idle';
    this.timer = 0;
    this.pauseTimer = 0;
    this.points = [];
    this.path.clear();
    this.solidGround = null;
    this.spark.visible = false;
    this.spark.clear();
  }

  get ground(): CurveGround | null {
    return this.solidGround;
  }

  // value -> graph-local y. Center of graph maps to value=0; positive values
  // draw above center; negative below. Mirrors the original game's
  // relativeValue() in genericGraph.mxml.
  private relativeValue(value: number): number {
    const origin = this.cfg.height / 2;
    const half = this.cfg.height / 2;
    return origin - (value / this.cfg.maxValue) * half;
  }
}
