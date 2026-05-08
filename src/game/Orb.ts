import { Container, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
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
  pairedGraph: Graph;
  valueProvider: OrbValueProvider;
}

// Larger than half the orb sprite (60 px) plus half the avatar body (15 px)
// so that the avatar can pick up the orb the moment its body box visually
// touches the orb, not when their center is on top of it.
const ORB_PICKUP_RADIUS = 75;
// Pixel offset above avatar.y where the held orb's BOTTOM sits. Negative =
// above. With both orb and avatar anchored bottom-center, -75 puts the
// black glyph just above the head of the displayed avatar (~50 px tall at
// scale 0.3).
const ORB_HELD_OFFSET_Y = -75;
const ORB_GRAVITY = 2;
const ORB_MAX_FALL = 12;

// The curated orb texture is a 60×60 PNG with the actual black glyph in a
// 20×20 box centered at (29.5, 29.5). With anchor (0.5, 0.5) the sprite's
// rotation pivot lands on that center; offsetting the sprite by GLYPH_FOOT
// inside the container puts the visible glyph's BOTTOM at the container
// origin (the orb's "feet"), so a grounded orb sits on the floor like the
// avatar / origin stand do, instead of floating ~20 px above the floor.
const ORB_GLYPH_HALF = 10;
const ORB_GLYPH_FOOT_OFFSET = -ORB_GLYPH_HALF;

// Slow alpha pulse on the orb's core that reads as a "glow" without needing
// a separate animated bitmap (~one breath per 1.5 sec at 24 Hz). Stays
// near-opaque so the glyph itself never fades out — the user wants the
// orb visible and the GLOW pulsing.
const CORE_ROTATION_PER_TICK = 0.03;
const PULSE_RATE = 0.18;

// Procedural glow halo, replaces the SWF-extracted "orbiting triangles"
// effect sprite (which contained 1082 opaque green pixels of intentional
// non-sentinel content that the user read as "the orb still has a green
// box around it"). The glow's outer strength pulses with the same phase
// as the core alpha so the orb visibly breathes.
const GLOW_COLOR = 0xffffaa;
const GLOW_DISTANCE = 18;
const GLOW_STRENGTH_BASE = 2.5;
const GLOW_STRENGTH_AMPLITUDE = 1.5;

export class Orb {
  state: OrbState = 'in_world';
  x: number;
  y: number;

  readonly container: Container;
  readonly pairedGraph: Graph;

  private vy = 0;
  private pulsePhase = 0;
  private readonly valueProvider: OrbValueProvider;
  private readonly coreSprite: Sprite;
  private readonly glow: GlowFilter;

  constructor(opts: OrbOptions) {
    this.x = opts.initialX;
    this.y = opts.initialY;
    this.pairedGraph = opts.pairedGraph;
    this.valueProvider = opts.valueProvider;

    this.container = new Container();

    // Container is positioned at (orb.x, orb.y) — the orb's "feet." The
    // core sprite's anchor sits at the visible glyph's CENTER (so rotation
    // looks centered) but the sprite is shifted up by ORB_GLYPH_HALF so
    // the visible bottom of the glyph lands exactly at the container
    // origin — same arrangement the bottom-anchored origin stand uses.
    // The `npm run colorkey` build step keys the dark-green sentinel halo
    // out, so default 'normal' blend is correct.
    this.coreSprite = new Sprite(opts.texture);
    this.coreSprite.anchor.set(0.5, 0.5);
    this.coreSprite.x = 0;
    this.coreSprite.y = ORB_GLYPH_FOOT_OFFSET;
    this.container.addChild(this.coreSprite);

    this.glow = new GlowFilter({
      color: GLOW_COLOR,
      distance: GLOW_DISTANCE,
      outerStrength: GLOW_STRENGTH_BASE,
      innerStrength: 0,
      quality: 0.3,
    });
    this.coreSprite.filters = [this.glow];

    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
  }

  update(avatarX: number, avatarY: number, ground: GroundProvider): void {
    this.coreSprite.rotation += CORE_ROTATION_PER_TICK;
    this.pulsePhase += PULSE_RATE;
    this.glow.outerStrength =
      GLOW_STRENGTH_BASE + Math.sin(this.pulsePhase) * GLOW_STRENGTH_AMPLITUDE;

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
