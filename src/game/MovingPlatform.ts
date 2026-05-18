// Ported from legacy/src/obstaclesClass.mxml + the obstacle-movement
// half of switchObject.mxml. A moving platform is a solid rectangle
// owned by a Switch. Pressing the switch flips its direction and
// (re)starts motion. The platform moves at a fixed speed until it
// hits a screen edge, another platform, or the avatar — at which
// point it stops in place and stays put until the next switch press.
//
// SCOPE: v1 implements the basic stop-on-collision behavior. The
// legacy `obstaclesClass` also pushes the AVATAR back when sandwiched
// between a moving platform and a wall (~200 lines of pixel-aura
// squish checks); that's deferred to D3. For now the platform just
// stops, which prevents the avatar from being trapped inside.

import { Graphics } from 'pixi.js';
import { RectGround } from './RectGround.js';

export interface MovingPlatformConfig {
  /** Top-left x of the platform's bbox. */
  x: number;
  /** Top-left y of the platform's bbox. */
  y: number;
  /** Width in px. Legacy used fixed sizes (20, 160); free-form here. */
  width: number;
  /** Height in px. Legacy used fixed sizes (20, 80, 140, 200). */
  height: number;
  /** True = oscillates along x; false = along y. */
  horizontal: boolean;
  /** Initial direction: true = up (vertical) / left (horizontal). */
  upOrLeft: boolean;
}

/** Avatar bbox the platform checks against (anchor: top-left). */
export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

const OBSTACLE_SPEED = 5; // px / tick, legacy OBSTACLEMOVEMENTSPEED
const FILL_COLOR = 0x232838;
const TOP_HIGHLIGHT_COLOR = 0x4a5168;
const BOLT_COLOR = 0x6b7488;
const BOLT_INSET = 4;
const BOLT_RADIUS = 1;
const TOP_HIGHLIGHT_THICKNESS = 2;

function drawPlatform(g: Graphics, w: number, h: number): void {
  g.rect(0, 0, w, h).fill({ color: FILL_COLOR });
  g.rect(0, 0, w, TOP_HIGHLIGHT_THICKNESS).fill({ color: TOP_HIGHLIGHT_COLOR });
  // Bolts at the corners for visual interest + readability against the bg.
  g.circle(BOLT_INSET, BOLT_INSET, BOLT_RADIUS).fill({ color: BOLT_COLOR });
  g.circle(w - BOLT_INSET, BOLT_INSET, BOLT_RADIUS).fill({ color: BOLT_COLOR });
  g.circle(BOLT_INSET, h - BOLT_INSET, BOLT_RADIUS).fill({ color: BOLT_COLOR });
  g.circle(w - BOLT_INSET, h - BOLT_INSET, BOLT_RADIUS).fill({ color: BOLT_COLOR });
}

export class MovingPlatform {
  /** Mutable AABB the avatar's physics queries each tick. */
  readonly ground: RectGround;
  readonly container: Graphics;

  private readonly horizontal: boolean;
  private readonly initialX: number;
  private readonly initialY: number;
  private readonly initialUpOrLeft: boolean;

  private upOrLeft: boolean;
  private moving = false;

  constructor(cfg: MovingPlatformConfig) {
    this.ground = new RectGround(cfg.x, cfg.y, cfg.width, cfg.height);
    this.horizontal = cfg.horizontal;
    this.upOrLeft = cfg.upOrLeft;
    this.initialX = cfg.x;
    this.initialY = cfg.y;
    this.initialUpOrLeft = cfg.upOrLeft;

    this.container = new Graphics();
    drawPlatform(this.container, cfg.width, cfg.height);
    this.container.x = cfg.x;
    this.container.y = cfg.y;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /** Flip direction + (re)start motion. Called by the owning Switch. */
  flip(): void {
    this.upOrLeft = !this.upOrLeft;
    this.moving = true;
  }

  /**
   * Advance one tick. Stops in place if the new position would:
   *   1. push any edge past the stage bounds
   *   2. overlap the avatar bbox
   *   3. overlap any other moving platform
   * The first stop condition wins; ordering is intentional (stage edge
   * cheapest to test).
   */
  tick(
    others: readonly MovingPlatform[],
    avatar: AABB,
    stageW: number,
    stageH: number,
  ): void {
    if (!this.moving) {
      this.container.x = this.ground.x;
      this.container.y = this.ground.y;
      return;
    }
    const oldX = this.ground.x;
    const oldY = this.ground.y;

    if (this.horizontal) {
      this.ground.x += this.upOrLeft ? -OBSTACLE_SPEED : OBSTACLE_SPEED;
    } else {
      this.ground.y += this.upOrLeft ? -OBSTACLE_SPEED : OBSTACLE_SPEED;
    }

    let stopped = false;
    if (
      this.ground.x < 0 ||
      this.ground.x + this.ground.w > stageW ||
      this.ground.y < 0 ||
      this.ground.y + this.ground.h > stageH
    ) {
      stopped = true;
    } else if (this.ground.overlapsBox(avatar.x, avatar.y, avatar.w, avatar.h)) {
      stopped = true;
    } else {
      for (const other of others) {
        if (other === this) continue;
        if (this.ground.overlapsBox(other.ground.x, other.ground.y, other.ground.w, other.ground.h)) {
          stopped = true;
          break;
        }
      }
    }

    if (stopped) {
      this.ground.x = oldX;
      this.ground.y = oldY;
      this.moving = false;
    }

    this.container.x = this.ground.x;
    this.container.y = this.ground.y;
  }

  /** Restore start-of-level position + direction; stop motion. */
  reset(): void {
    this.ground.x = this.initialX;
    this.ground.y = this.initialY;
    this.upOrLeft = this.initialUpOrLeft;
    this.moving = false;
    this.container.x = this.initialX;
    this.container.y = this.initialY;
  }
}
