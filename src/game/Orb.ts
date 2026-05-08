import { Container, Sprite, Texture } from 'pixi.js';
import { Graph } from './Graph.js';
import type { GroundProvider } from './Movements.js';

export type OrbState = 'in_world' | 'held';

/**
 * Maps the avatar's current state (and stored extras like an origin marker)
 * to the value the paired graph should plot this tick. For displacement
 * orbs the original game returns |avatar.x - origin.x|; for velocity orbs
 * it returns avatar's vx.
 */
export type OrbValueProvider = (avatarX: number, avatarY: number) => number;

export interface OrbOptions {
  initialX: number;
  initialY: number;
  texture: Texture;
  effectTexture?: Texture;
  pairedGraph: Graph;
  valueProvider: OrbValueProvider;
}

const ORB_PICKUP_RADIUS = 50;
// Pixel offset above avatar.y (which is bottom-anchored) where the held orb floats.
const ORB_HELD_OFFSET_Y = -90;
const ORB_GRAVITY = 2;
const ORB_MAX_FALL = 12;

export class Orb {
  state: OrbState = 'in_world';
  x: number;
  y: number;

  readonly container: Container;
  readonly pairedGraph: Graph;

  private vy = 0;
  private readonly valueProvider: OrbValueProvider;

  constructor(opts: OrbOptions) {
    this.x = opts.initialX;
    this.y = opts.initialY;
    this.pairedGraph = opts.pairedGraph;
    this.valueProvider = opts.valueProvider;

    this.container = new Container();

    if (opts.effectTexture) {
      const fx = new Sprite(opts.effectTexture);
      fx.anchor.set(0.5, 0.5);
      this.container.addChild(fx);
    }
    const core = new Sprite(opts.texture);
    core.anchor.set(0.5, 0.5);
    this.container.addChild(core);

    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
  }

  update(avatarX: number, avatarY: number, ground: GroundProvider): void {
    if (this.state === 'held') {
      this.x = avatarX;
      this.y = avatarY + ORB_HELD_OFFSET_Y;
      this.container.x = Math.round(this.x);
      this.container.y = Math.round(this.y);
      this.pairedGraph.tick(this.valueProvider(avatarX, avatarY));
      return;
    }

    const prevY = this.y;
    this.vy = Math.min(this.vy + ORB_GRAVITY, ORB_MAX_FALL);
    this.y += this.vy;
    const groundY = ground.groundYBelow(this.x, prevY);
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
    }
    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
  }

  pickup(): void {
    if (this.state !== 'in_world') return;
    this.state = 'held';
    this.container.visible = false;
    this.pairedGraph.startDrawing();
  }

  drop(x: number, y: number): void {
    if (this.state !== 'held') return;
    this.state = 'in_world';
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.container.x = Math.round(x);
    this.container.y = Math.round(y);
    this.container.visible = true;
    this.pairedGraph.solidify();
  }

  overlapsAvatar(avatarX: number, avatarY: number): boolean {
    if (this.state !== 'in_world') return false;
    const dx = avatarX - this.x;
    // Avatar y is bottom-anchored; check the orb against the avatar's middle
    // (~30 px above feet) for a more natural pickup feel.
    const dy = avatarY - 30 - this.y;
    return dx * dx + dy * dy < ORB_PICKUP_RADIUS * ORB_PICKUP_RADIUS;
  }
}
