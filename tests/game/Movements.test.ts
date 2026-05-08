import { describe, it, expect } from 'vitest';
import {
  FlatGround,
  PHYSICS,
  step,
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
    // Two-floor ground: anything searching from y < 200 finds platform (200);
    // anything searching from y >= 201 falls through to floor (500).
    const twoFloor = {
      groundYBelow(_x: number, y: number): number {
        return y < 201 ? 200 : 500;
      },
    };
    let s: MovementState = { x: 100, y: 500, vx: 0, vy: 0, facingRight: true, onGround: true };
    // Walk right while on the floor: stays at y=500.
    for (let i = 0; i < 20; i++) s = step(s, { ...NEUTRAL, moveRight: true }, twoFloor);
    expect(s.y).toBe(500);
    expect(s.onGround).toBe(true);
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
