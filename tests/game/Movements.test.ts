import { describe, it, expect } from 'vitest';
import {
  BODY,
  FlatGround,
  PHYSICS,
  step,
  type GroundProvider,
  type MovementInputs,
  type MovementState,
} from '../../src/game/Movements.js';

const NEUTRAL: MovementInputs = {
  moveLeft: false,
  moveRight: false,
  sprint: false,
  jumpPressed: false,
};

function start(overrides: Partial<MovementState> = {}): MovementState {
  return {
    x: 100,
    y: 500,
    vx: 0,
    vy: 0,
    facingRight: true,
    onGround: true,
    ...overrides,
  };
}

describe('Movements.step', () => {
  const ground = new FlatGround(500);

  it('walk right snaps vx to WALK_SPEED', () => {
    const next = step(start(), { ...NEUTRAL, moveRight: true }, ground);
    expect(next.vx).toBe(PHYSICS.WALK_SPEED);
    expect(next.facingRight).toBe(true);
    expect(next.x).toBe(100 + PHYSICS.WALK_SPEED);
  });

  it('walk left snaps vx to -WALK_SPEED and flips facing', () => {
    const next = step(start(), { ...NEUTRAL, moveLeft: true }, ground);
    expect(next.vx).toBe(-PHYSICS.WALK_SPEED);
    expect(next.facingRight).toBe(false);
  });

  it('sprint accelerates by RUN_ACCEL each tick up to MAX_RUN_SPEED', () => {
    let s = start();
    for (let i = 0; i < 10; i++) s = step(s, { ...NEUTRAL, moveRight: true, sprint: true }, ground);
    expect(s.vx).toBeCloseTo(10 * PHYSICS.RUN_ACCEL, 5);
    for (let i = 0; i < 100; i++) s = step(s, { ...NEUTRAL, moveRight: true, sprint: true }, ground);
    expect(s.vx).toBeCloseTo(PHYSICS.MAX_RUN_SPEED, 5);
  });

  it('brake to zero on ground when no input', () => {
    let s = start({ vx: PHYSICS.WALK_SPEED });
    for (let i = 0; i < 20; i++) s = step(s, NEUTRAL, ground);
    expect(s.vx).toBe(0);
  });

  it('left+right cancel — body brakes', () => {
    const s = step(start({ vx: 8 }), { ...NEUTRAL, moveLeft: true, moveRight: true }, ground);
    expect(s.vx).toBe(8 - PHYSICS.RUN_BRAKE);
  });

  it('jump from ground sets vy = -JUMP_IMPULSE and leaves the ground', () => {
    const s = step(start(), { ...NEUTRAL, jumpPressed: true }, ground);
    expect(s.vy).toBe(-PHYSICS.JUMP_IMPULSE);
    expect(s.onGround).toBe(false);
  });

  it('jump press is ignored while airborne', () => {
    const s = step(
      start({ y: 200, vy: -5, onGround: false }),
      { ...NEUTRAL, jumpPressed: true },
      ground,
    );
    expect(s.vy).toBeCloseTo(-5 + PHYSICS.GRAVITY);
    expect(s.onGround).toBe(false);
  });

  it('gravity pulls vy by GRAVITY each airborne tick', () => {
    let s: MovementState = start({ y: 200, vy: 0, onGround: false });
    s = step(s, NEUTRAL, ground);
    expect(s.vy).toBe(PHYSICS.GRAVITY);
    s = step(s, NEUTRAL, ground);
    expect(s.vy).toBe(PHYSICS.GRAVITY * 2);
  });

  it('falling speed clamps to MAX_FALL_SPEED', () => {
    const farGround = new FlatGround(99_999);
    let s: MovementState = start({ y: 200, vy: 0, onGround: false });
    for (let i = 0; i < 50; i++) s = step(s, NEUTRAL, farGround);
    expect(s.vy).toBe(PHYSICS.MAX_FALL_SPEED);
    expect(s.onGround).toBe(false);
  });

  it('lands on ground (clamps y, zeroes vy, sets onGround)', () => {
    const s = step(start({ y: 498, vy: 5, onGround: false }), NEUTRAL, ground);
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(500);
    expect(s.vy).toBe(0);
  });

  it('preserves vx in the air (no brake mid-jump)', () => {
    const airborne: MovementState = {
      x: 100,
      y: 200,
      vx: 8,
      vy: -5,
      facingRight: true,
      onGround: false,
    };
    const s = step(airborne, NEUTRAL, ground);
    expect(s.vx).toBe(8);
  });

  it('walking under a platform consults groundYBelow with prevY, not topmost', () => {
    // Two-floor ground: anything searching from y < 201 finds platform (200);
    // anything searching from y >= 201 falls through to floor (500).
    const twoFloor: GroundProvider = {
      groundYBelow: (_x: number, y: number) => (y < 201 ? 200 : 500),
      solidAt: () => false,
    };
    let s: MovementState = { x: 100, y: 500, vx: 0, vy: 0, facingRight: true, onGround: true };
    for (let i = 0; i < 20; i++) s = step(s, { ...NEUTRAL, moveRight: true }, twoFloor);
    expect(s.y).toBe(500);
    expect(s.onGround).toBe(true);
  });

  it('walking right into a wall stops vx and clamps x at the wall edge', () => {
    // Wall: every pixel with x >= 200 is solid.  Floor at y=500.
    const wallAt200: GroundProvider = {
      groundYBelow: (x: number, y: number) =>
        Math.floor(x) >= 200 && y <= 500 ? Math.floor(y) : 500,
      solidAt: (x: number, _y: number) => Math.floor(x) >= 200,
    };
    let s: MovementState = { x: 100, y: 500, vx: 0, vy: 0, facingRight: true, onGround: true };
    for (let i = 0; i < 30; i++) s = step(s, { ...NEUTRAL, moveRight: true }, wallAt200);
    expect(s.vx).toBe(0);
    // Right edge of body should be at or before the wall (x = 200).
    expect(s.x + BODY.HALF_WIDTH).toBeLessThanOrEqual(200);
    expect(s.x + BODY.HALF_WIDTH).toBeGreaterThanOrEqual(200 - 1);
  });

  it('walking left into a wall stops vx and clamps x at the wall edge', () => {
    const wallAt100: GroundProvider = {
      groundYBelow: (x: number, y: number) =>
        Math.floor(x) <= 100 && y <= 500 ? Math.floor(y) : 500,
      solidAt: (x: number, _y: number) => Math.floor(x) <= 100,
    };
    let s: MovementState = { x: 200, y: 500, vx: 0, vy: 0, facingRight: false, onGround: true };
    for (let i = 0; i < 30; i++) s = step(s, { ...NEUTRAL, moveLeft: true }, wallAt100);
    expect(s.vx).toBe(0);
    expect(s.x - BODY.HALF_WIDTH).toBeGreaterThanOrEqual(100);
  });

  it('a thin platform overhead does not bump the avatar if their center is clear', () => {
    // Platform at y in [80, 100], x in [200, 400]. Floor at y=300.
    // Avatar at x=180 — body right edge x=195 (inside the platform's x range
    // because 195 < 200 is false, actually x=195 < 200, *outside*), but more
    // importantly the head check (HEAD_HALF_WIDTH=4) only samples x in
    // [176, 184] which is well clear of the platform.
    const platformAndFloor: GroundProvider = {
      groundYBelow: (_x: number, y: number) =>
        y <= 300 ? 300 : Number.POSITIVE_INFINITY,
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (iy >= 300) return true;                  // floor
        if (ix >= 200 && ix <= 400 && iy >= 80 && iy <= 100) return true; // platform
        return false;
      },
    };
    let s: MovementState = { x: 180, y: 300, vx: 0, vy: 0, facingRight: true, onGround: true };
    s = step(s, { ...NEUTRAL, jumpPressed: true }, platformAndFloor);
    // Rise for several ticks; head check at x=180 should never see the
    // platform (even though body right edge x=195 would).
    for (let i = 0; i < 8; i++) {
      const before = s.vy;
      s = step(s, NEUTRAL, platformAndFloor);
      // vy should evolve smoothly under gravity, not snap to 0 from a head bump.
      expect(s.vy).toBeGreaterThanOrEqual(before);
    }
    // After the apex, the avatar should still be above the floor.
    expect(s.y).toBeLessThan(300);
  });

  it('jumping into a ceiling zeroes vy and stops the climb', () => {
    // Floor at y=200, ceiling solid at y <= 100. A single jump rises about
    // JUMP_IMPULSE^2/(2*GRAVITY) ≈ 52 px, so an avatar starting at y=200
    // (body top 140) can reach body top 88 — well into the ceiling at 100.
    const ceilingAndFloor: GroundProvider = {
      groundYBelow: (_x: number, y: number) => (y <= 200 ? 200 : Number.POSITIVE_INFINITY),
      solidAt: (_x: number, y: number) => {
        const iy = Math.floor(y);
        return iy <= 100 || iy >= 200;
      },
    };
    let s: MovementState = { x: 100, y: 200, vx: 0, vy: 0, facingRight: true, onGround: true };
    s = step(s, { ...NEUTRAL, jumpPressed: true }, ceilingAndFloor);
    expect(s.vy).toBeLessThan(0);

    let bumpedHead = false;
    for (let i = 0; i < 30; i++) {
      s = step(s, NEUTRAL, ceilingAndFloor);
      if (s.vy === 0 && !s.onGround) {
        bumpedHead = true;
        break;
      }
    }
    expect(bumpedHead).toBe(true);
    // After bump: body top should be at or below the ceiling boundary.
    expect(s.y - BODY.HEIGHT).toBeGreaterThan(100);
  });

  it('full jump arc returns to ground after some ticks', () => {
    let s = start();
    s = step(s, { ...NEUTRAL, jumpPressed: true }, ground);
    expect(s.onGround).toBe(false);
    let landed = false;
    for (let i = 0; i < 100; i++) {
      s = step(s, NEUTRAL, ground);
      if (s.onGround) {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
    expect(s.y).toBe(500);
    expect(s.vy).toBe(0);
  });
});
