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

// Larger than half the orb sprite (60 px) plus half the avatar body (15 px)
// so that the avatar can pick up the orb the moment its body box visually
// touches the orb, not when their center is on top of it.
const ORB_PICKUP_RADIUS = 75;
// Pixel offset above avatar.y where the held orb's BOTTOM sits. Negative =
// above. With both orb and avatar anchored bottom-center, -55 puts the orb
// just above the head of the displayed avatar (~50 px tall at scale 0.3).
const ORB_HELD_OFFSET_Y = -55;
const ORB_GRAVITY = 2;
const ORB_MAX_FALL = 12;

// Native size of the curated orb assets — used to position the rotating
// effect at the visual center of the orb.
const ORB_SPRITE_SIZE = 60;

// Effect (orbiting triangles) — fast spin, scaled down so the halo is just
// slightly larger than the orb glyph, tinted toward warm white-yellow
// (matches the original game's glow), and partly transparent.
const EFFECT_ROTATION_PER_TICK = 0.06;
const EFFECT_SCALE = 0.7;
const EFFECT_ALPHA = 0.65;
const EFFECT_TINT = 0xffffaa;

// Core (orb glyph itself) — slower counter-spin so it doesn't look locked
// to the effect, plus a slow alpha pulse that reads as a "glow" without
// needing a separate animated bitmap (~one breath per 1.5 sec at 24 Hz).
const CORE_ROTATION_PER_TICK = 0.03;
const CORE_PULSE_RATE = 0.18;
const CORE_PULSE_BASE = 0.85;
const CORE_PULSE_AMPLITUDE = 0.15;

export class Orb {
  state: OrbState = 'in_world';
  x: number;
  y: number;

  readonly container: Container;
  readonly pairedGraph: Graph;

  private vy = 0;
  private pulsePhase = 0;
  private readonly valueProvider: OrbValueProvider;
  private readonly effectSprite: Sprite | null;
  private readonly coreSprite: Sprite;

  constructor(opts: OrbOptions) {
    this.x = opts.initialX;
    this.y = opts.initialY;
    this.pairedGraph = opts.pairedGraph;
    this.valueProvider = opts.valueProvider;

    this.container = new Container();

    // The core orb is bottom-anchored so orb.y = ground means the orb's
    // BOTTOM rests on the floor (matching the avatar). The effect sprite is
    // pinned at the visual center of the orb (half a sprite-height above the
    // anchor) and uses center-anchor so it can rotate around its middle
    // without precessing across the orb body.
    // The `npm run colorkey` build step has already turned each texture's
    // sentinel-color halo transparent, so default ('normal') blending is
    // correct here. Both sprites are positioned at the orb's visual center
    // (y = -ORB_SPRITE_SIZE/2 inside the container, which is bottom-anchored
    // to (orb.x, orb.y)) and use anchor (0.5, 0.5) so they rotate cleanly
    // around their own center.
    if (opts.effectTexture) {
      const fx = new Sprite(opts.effectTexture);
      fx.anchor.set(0.5, 0.5);
      fx.x = 0;
      fx.y = -ORB_SPRITE_SIZE / 2;
      fx.scale.set(EFFECT_SCALE);
      fx.alpha = EFFECT_ALPHA;
      fx.tint = EFFECT_TINT;
      this.container.addChild(fx);
      this.effectSprite = fx;
    } else {
      this.effectSprite = null;
    }
    this.coreSprite = new Sprite(opts.texture);
    this.coreSprite.anchor.set(0.5, 0.5);
    this.coreSprite.x = 0;
    this.coreSprite.y = -ORB_SPRITE_SIZE / 2;
    this.container.addChild(this.coreSprite);

    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
  }

  update(avatarX: number, avatarY: number, ground: GroundProvider): void {
    if (this.effectSprite) this.effectSprite.rotation += EFFECT_ROTATION_PER_TICK;
    this.coreSprite.rotation += CORE_ROTATION_PER_TICK;
    this.pulsePhase += CORE_PULSE_RATE;
    this.coreSprite.alpha = CORE_PULSE_BASE + Math.sin(this.pulsePhase) * CORE_PULSE_AMPLITUDE;

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
    this.pairedGraph.solidify();
  }

  overlapsAvatar(avatarX: number, avatarY: number): boolean {
    if (this.state !== 'in_world') return false;
    // Both avatar and orb are bottom-anchored, so their feet are roughly at
    // the same y when the avatar walks up to a grounded orb. Check distance
    // from the avatar's mid-body to the orb's mid-body (~30 px above each
    // anchor) for a forgiving radius-based pickup.
    const dx = avatarX - this.x;
    const dy = (avatarY - 30) - (this.y - 30);
    return dx * dx + dy * dy < ORB_PICKUP_RADIUS * ORB_PICKUP_RADIUS;
  }
}
