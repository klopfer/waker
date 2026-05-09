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
  // CALIBRATED: 14.5 in legacy `movements.mxml`. We bump to 15.5 because at
  // legacy values the leftmost-cloud → orb-stand jump in displacement0
  // requires a 56 px rise vs a 60 px max-rise — only 4 px of margin, which
  // makes the jump "exact-timing only." 15.5 yields 68 px max rise (12 px
  // margin), matching the playtest leeway the user reported in the original.
  JUMP_IMPULSE: 15.5,
  WALK_SPEED: 6,
  MAX_RUN_SPEED: 12,
  RUN_ACCEL: 0.3,
  RUN_BRAKE: 1.5,
  // Vertical "step-up" allowance: when walking horizontally, the avatar
  // automatically snaps up to floors that are within this many px above
  // current y. Lets sloped curves and small painted-ground steps be
  // walkable without jumping. Larger than max curve-rise per tick at run
  // speed (~17 px) so even steep player-drawn slopes are traversable;
  // smaller than the staircase gaps in the painted level so we don't
  // accidentally snap onto unrelated platforms.
  STEP_UP: 18,
  // Vertical "step-down" allowance: when walking on ground, snap DOWN
  // to floors that are this many px below current y (rather than going
  // briefly airborne and letting gravity drift the avatar off the
  // curve sideways during the fall). Larger drops fall through to the
  // normal airborne path, so real cliffs still cause real falls.
  STEP_DOWN: 18,
} as const;

// Avatar collision box. Bottom-center is anchored at the body's (x, y).
// CALIBRATED to match the rendered avatar at AVATAR_SCALE = 0.25.
//
// Native avatar frame is 236×157 px; the standing character within that
// is ~85 px wide at the head, narrowing to ~41 px at the waist, and ~136
// px tall from head-top to foot-top (excluding the long backward tail
// that pads out the frame's left side). At 0.25 scale: ~21 wide / ~10
// waist / ~34 tall on the 800×600 stage. The original Flash game used
// `init(80, 80)` for the avatar canvas with the visible figure
// occupying maybe 60 of those 80 px — see docs/calibration.md.
//
// Previous values (HALF_WIDTH=15, HEIGHT=60) were tuned for an earlier
// AVATAR_SCALE=0.3 and were ~2× the visible character height, which
// caused phantom head-bumps where the player's visual head was clearly
// below a platform's underside but the collision box wasn't.
//
// HEAD_HALF_WIDTH is intentionally much narrower than HALF_WIDTH so the
// avatar's full body width doesn't bonk on platform underside corners
// when its visual center would still clear the edge.
export const BODY = {
  HALF_WIDTH: 12,
  HEAD_HALF_WIDTH: 4,
  HEIGHT: 35,
  // Vertical sample step for side-wall scans: every N px down the body.
  // 4 px catches sub-tile features without being too slow (24 Hz × ~9
  // samples now that HEIGHT=35 × ~30 push iterations = manageable).
  SAMPLE_STEP: 4,
  // Iteration cap on the iterative "push out of wall" loop, in pixels.
  MAX_PUSH: 30,
  // Top-of-body margin where SIDE collision is suppressed — gives the
  // head/upper torso clearance to brush past low overhead obstacles
  // (e.g., a player-drawn graph curve at the lowest reachable y) without
  // the side-push tripping. Without this, a 1-2 px head clip into a
  // curve overhead causes the avatar to be stuck even though their
  // visual head is clearly below the curve. Matches the legacy game's
  // behavior of having shorter "leftPt"/"rightPt" aura images than the
  // full body (the side auras only covered torso, not head).
  SIDE_TOP_MARGIN: 8,
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

  /**
   * True if the world-space pixel at (x, y) is solid terrain. Used by side
   * and head collision to stop the avatar walking into walls or jumping
   * through ceilings. Out-of-bounds queries return false (open space).
   */
  solidAt(x: number, y: number): boolean;
}

export class FlatGround implements GroundProvider {
  constructor(private readonly y: number) {}
  groundYBelow(_x: number, searchFromY: number): number {
    return searchFromY <= this.y ? this.y : Number.POSITIVE_INFINITY;
  }
  solidAt(_x: number, y: number): boolean {
    return y >= this.y;
  }
}

function anySolidAlongVerticalEdge(
  edgeX: number,
  bottomY: number,
  ground: GroundProvider,
): boolean {
  // Sample from one pixel above the body bottom up to the SIDE top —
  // which is HEIGHT-SIDE_TOP_MARGIN px above feet, NOT the absolute body
  // top. The top SIDE_TOP_MARGIN px of the body are excluded so the
  // head/upper torso can brush past low overhead obstacles without
  // tripping the side-push (see BODY.SIDE_TOP_MARGIN comment).
  // Ceiling collision (anySolidAlongTopEdge) still uses the full body
  // top, so head-bumps into actual ceilings work normally.
  const sideTopY = bottomY - BODY.HEIGHT + BODY.SIDE_TOP_MARGIN;
  for (let y = bottomY - 1; y > sideTopY; y -= BODY.SAMPLE_STEP) {
    if (ground.solidAt(edgeX, y)) return true;
  }
  return ground.solidAt(edgeX, sideTopY + 1);
}

function anySolidAlongTopEdge(
  centerX: number,
  bottomY: number,
  ground: GroundProvider,
): boolean {
  const topY = bottomY - BODY.HEIGHT;
  for (let dx = -BODY.HEAD_HALF_WIDTH; dx <= BODY.HEAD_HALF_WIDTH; dx += BODY.SAMPLE_STEP) {
    if (ground.solidAt(centerX + dx, topY)) return true;
  }
  return ground.solidAt(centerX + BODY.HEAD_HALF_WIDTH, topY);
}

function pushOutFromWallRight(x: number, bottomY: number, ground: GroundProvider): number {
  let cur = x;
  for (let i = 0; i < BODY.MAX_PUSH; i++) {
    if (!anySolidAlongVerticalEdge(cur + BODY.HALF_WIDTH, bottomY, ground)) return cur;
    cur -= 1;
  }
  return cur;
}

function pushOutFromWallLeft(x: number, bottomY: number, ground: GroundProvider): number {
  let cur = x;
  for (let i = 0; i < BODY.MAX_PUSH; i++) {
    if (!anySolidAlongVerticalEdge(cur - BODY.HALF_WIDTH - 1, bottomY, ground)) return cur;
    cur += 1;
  }
  return cur;
}

function pushDownFromCeiling(x: number, bottomY: number, ground: GroundProvider): number {
  let cur = bottomY;
  for (let i = 0; i < BODY.MAX_PUSH; i++) {
    if (!anySolidAlongTopEdge(x, cur, ground)) return cur;
    cur += 1;
  }
  return cur;
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

  // Resolve X first using the *current* y, then Y using the new x.
  // This is the standard platformer "axis-separated" collision order: a
  // body that's still airborne (current y above the platform top) doesn't
  // see the platform's body as a wall, so descending sideways into a
  // platform's airspace lands on its top instead of getting kicked out.
  // Mixing the two — running side-push at the *new* y — fails the
  // landing case because the new y has already crossed the platform top
  // by the time the side check fires.
  let x = state.x + vx;
  let y = state.y;

  // STEP-UP / STEP-DOWN: when moving horizontally and "tracking" a floor,
  // snap onto the floor at the new x rather than running side-push +
  // ground-snap. This unifies three effects:
  //
  //   1. Walking UP a sloped curve. The slope at edgeX is even higher
  //      than at center; without this, side-push trips on the slope's
  //      continuation and the avatar oscillates ("slides backwards").
  //   2. Walking DOWN a sloped curve / off a small step. Without this,
  //      groundYBelow returns +∞ momentarily and the avatar becomes
  //      airborne, drifting off the curve as gravity takes over.
  //   3. Landing on a ledge near jump-apex when feet are 1-2 px below
  //      the platform top (cliff-edge ledge grab).
  //
  // When this fires, we OWN the X/Y resolution for this tick — skip
  // side-push (the "wall" was actually a slope) and ground-snap (we're
  // already on the floor). steppedToFloor tracks this.
  let steppedToFloor = false;
  if (vx !== 0) {
    const newFloorY = ground.groundYBelow(x, state.y - PHYSICS.STEP_UP);
    if (newFloorY < state.y && newFloorY >= state.y - PHYSICS.STEP_UP) {
      // Step UP — fires on ground OR rising-near-apex (cliff-edge grab).
      // Falling avatars don't auto-grab ledges (would feel sticky).
      const nearApex = vy <= 0 && vy >= -PHYSICS.RUN_BRAKE;
      if (onGround || nearApex) {
        y = newFloorY;
        vy = 0;
        onGround = true;
        steppedToFloor = true;
      }
    } else if (
      onGround &&
      newFloorY > state.y &&
      newFloorY <= state.y + PHYSICS.STEP_DOWN
    ) {
      // Step DOWN — only when on ground, only for small drops. Larger
      // drops fall through to the normal Y step, so cliffs cause real
      // airborne descent.
      y = newFloorY;
      vy = 0;
      onGround = true;
      steppedToFloor = true;
    }
  }

  if (!steppedToFloor) {
    if (vx > 0) {
      const pushed = pushOutFromWallRight(x, y, ground);
      if (pushed !== x) {
        x = pushed;
        vx = 0;
      }
    } else if (vx < 0) {
      const pushed = pushOutFromWallLeft(x, y, ground);
      if (pushed !== x) {
        x = pushed;
        vx = 0;
      }
    }

    y = y + vy;
    if (vy < 0) {
      const pushed = pushDownFromCeiling(x, y, ground);
      if (pushed !== y) {
        y = pushed;
        vy = 0;
      }
    }

    // Floor lookup uses the new x AND the old y as the search start, so a
    // descending avatar whose feet cross a platform top during this tick
    // lands on the platform rather than passing through.
    const groundY = ground.groundYBelow(x, state.y);
    if (y >= groundY) {
      y = groundY;
      if (vy > 0) vy = 0;
      onGround = true;
    } else {
      onGround = false;
    }
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
