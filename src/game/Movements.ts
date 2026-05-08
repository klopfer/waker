// Ported from legacy/src/movements.mxml. The original mixes a player-velocity
// vector with a per-frame acceleration field; we collapse that into direct
// velocity updates because the original logic always sets accel = "delta to
// reach target velocity this frame", which is functionally identical.
//
// Coordinate convention is screen-space (positive y = down) — the AS3
// original used inverted y internally and then negated when applying the
// velocity to position. Constants below reflect screen-space:
//   gravity is positive (pulls down)
//   jump impulse is applied as vy = -JUMP_IMPULSE (negative = up)
//
// Speeds are px / tick at the 24 Hz fixed simulation step. Numbers come
// directly from movements.mxml lines 446-453, with `gameSpeed = 1.5`
// pre-multiplied:
//   GRAVITY         = 2
//   MAXFALLINGSPEED = -12  -> MAX_FALL_SPEED = 12 (down)
//   JUMPSPEED       = 14.5
//   WALKINGSPEED    = 4 * 1.5 = 6
//   MAXRUNSPEED     = 8 * 1.5 = 12
//   RUNSPEED        = 0.2 * 1.5 = 0.3   (run acceleration per tick)
//   RUNBRAKE        = 1 * 1.5 = 1.5     (decel per tick when no input on ground)

export const PHYSICS = {
  GRAVITY: 2,
  MAX_FALL_SPEED: 12,
  JUMP_IMPULSE: 14.5,
  WALK_SPEED: 6,
  MAX_RUN_SPEED: 12,
  RUN_ACCEL: 0.3,
  RUN_BRAKE: 1.5,
} as const;

export interface MovementInputs {
  moveLeft: boolean;
  moveRight: boolean;
  sprint: boolean;
  jumpPressed: boolean;
}

export interface MovementState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight: boolean;
  onGround: boolean;
}

export interface GroundProvider {
  /**
   * World-space y of the next floor at column x, searching downward from
   * y `searchFromY`. Returns +Infinity if no floor exists in that column at
   * or below the search start (avatar would fall forever).
   *
   * Searching downward (rather than always returning the topmost pixel) is
   * what lets the avatar walk *under* a high platform — the column has an
   * opaque pixel at the platform's top y, but if the avatar is below that
   * y we want the floor below, not the platform above.
   */
  groundYBelow(x: number, searchFromY: number): number;
}

export class FlatGround implements GroundProvider {
  constructor(private readonly y: number) {}
  groundYBelow(_x: number, searchFromY: number): number {
    return searchFromY <= this.y ? this.y : Number.POSITIVE_INFINITY;
  }
}

export function step(
  state: MovementState,
  inputs: MovementInputs,
  ground: GroundProvider,
): MovementState {
  let { vx, vy, facingRight, onGround } = state;

  if (inputs.moveRight && !inputs.moveLeft) {
    facingRight = true;
    if (inputs.sprint && onGround) {
      vx = Math.min(vx + PHYSICS.RUN_ACCEL, PHYSICS.MAX_RUN_SPEED);
      if (vx < 0) vx = Math.min(vx + PHYSICS.RUN_BRAKE, 0);
    } else {
      vx = PHYSICS.WALK_SPEED;
    }
  } else if (inputs.moveLeft && !inputs.moveRight) {
    facingRight = false;
    if (inputs.sprint && onGround) {
      vx = Math.max(vx - PHYSICS.RUN_ACCEL, -PHYSICS.MAX_RUN_SPEED);
      if (vx > 0) vx = Math.max(vx - PHYSICS.RUN_BRAKE, 0);
    } else {
      vx = -PHYSICS.WALK_SPEED;
    }
  } else if (onGround) {
    if (Math.abs(vx) <= PHYSICS.RUN_BRAKE) vx = 0;
    else vx -= Math.sign(vx) * PHYSICS.RUN_BRAKE;
  }

  if (inputs.jumpPressed && onGround) {
    vy = -PHYSICS.JUMP_IMPULSE;
    onGround = false;
  } else if (!onGround) {
    vy = Math.min(vy + PHYSICS.GRAVITY, PHYSICS.MAX_FALL_SPEED);
  } else {
    vy = 0;
  }

  const x = state.x + vx;
  let y = state.y + vy;

  const groundY = ground.groundYBelow(x, state.y);
  if (y >= groundY) {
    y = groundY;
    if (vy > 0) vy = 0;
    onGround = true;
  } else {
    onGround = false;
  }

  return { x, y, vx, vy, facingRight, onGround };
}

/**
 * Mutable convenience wrapper around step() — main.ts uses this so it can
 * call body.step(inputs) each tick without managing a state object explicitly.
 */
export class Body {
  state: MovementState;
  constructor(initial: Partial<MovementState> & Pick<MovementState, 'x' | 'y'>) {
    this.state = {
      vx: 0,
      vy: 0,
      facingRight: true,
      onGround: true,
      ...initial,
    };
  }

  step(inputs: MovementInputs, ground: GroundProvider): MovementState {
    this.state = step(this.state, inputs, ground);
    return this.state;
  }
}
