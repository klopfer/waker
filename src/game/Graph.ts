import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CurveGround, type CurvePoint } from './CurveGround.js';

export type GraphState = 'idle' | 'drawing' | 'solid';

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
  /** Glowing dot drawn at the head of the live curve. Hidden when not drawing. */
  spark?: Texture;
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
  private readonly spark: Sprite | null;
  state: GraphState = 'idle';

  private timer = 0;
  private points: CurvePoint[] = [];
  private solidGround: CurveGround | null = null;
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

    if (opts.spark) {
      this.spark = new Sprite(opts.spark);
      this.spark.anchor.set(0.5, 0.5);
      this.spark.visible = false;
      this.container.addChild(this.spark);
    } else {
      this.spark = null;
    }

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
    this.points = [];
    this.solidGround = null;
    this.path.clear();
    if (this.spark) this.spark.visible = true;
  }

  /** Append the next point to the curve while drawing. No-op outside `drawing` state. */
  tick(value: number): void {
    if (this.state !== 'drawing') return;
    if (this.timer >= this.cfg.width) return;

    const localY = this.relativeValue(value) + this.cfg.yOffset;
    const localX = this.timer;
    this.points.push({ x: localX, y: localY });

    if (this.points.length === 1) {
      this.path.moveTo(localX, localY);
    } else {
      this.path.lineTo(localX, localY);
    }
    this.path.stroke({ color: this.cfg.drawColor, width: this.cfg.drawWidth });

    if (this.spark) {
      this.spark.x = localX;
      this.spark.y = localY;
    }

    this.timer += this.cfg.speedPerTick;
  }

  /**
   * Lock the curve in. Returns a CurveGround in *world* coordinates that the
   * level should add to its CompositeGround so the avatar can stand on the
   * solidified curve. Returns null if the player dropped the orb before
   * accumulating enough points to be useful as a platform.
   */
  solidify(): CurveGround | null {
    if (this.state !== 'drawing' || this.points.length < 2) {
      this.reset();
      return null;
    }
    this.state = 'solid';
    if (this.spark) this.spark.visible = false;

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
    this.points = [];
    this.path.clear();
    this.solidGround = null;
    if (this.spark) this.spark.visible = false;
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
