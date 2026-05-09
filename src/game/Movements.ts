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
  // Vertical "step-up" / "step-down" allowance: when walking horizontally,
  // the avatar snaps onto floors within this many px of current y rather
  // than running side-push or going airborne. Lets sloped curves and
  // small painted-ground steps be walkable without jumping.
  //
  // Symmetric so up/down on the same surface feels the same.
  //
  // Calibration history:
  //   Analytical max curve-y change per game tick = ~17.4 px (max
  //   draw-time slope 1.45 per graph-x × 12 graph-x crossed at run
  //   speed). Started at 18, then 24 (v6), then bumped to 40 here —
  //   playtests on jagged player-drawn curves consistently showed the
  //   tighter values still freezing the avatar at slope changes. The
  //   analytical math doesn't account for some interaction (rounding,
  //   curve thickness halo, corner geometry, etc.) so we just give a
  //   generous margin.
  //
  //   40 is calibrated against the SMALLEST painted-floor cliff in
  //   displacement0 — leftmost cloud (y=389) → orb-stand (y=333) is
  //   a 56 px rise. 40 < 56, so this can't accidentally let the avatar
  //   walk up that cliff (still requires the proper jump). Same for
  //   walking off ledges: smallest drop is the same 56 px, 40 < 56,
  //   level progression preserved.
  STEP_UP: 40,
  STEP_DOWN: 40,
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
  // the side-push tripping. Matches the legacy game's behavior of having
  // shorter "leftPt"/"rightPt" aura images than the full body (the side
  // auras only covered torso, not head).
  //
  // Calibrated against the lowest-reachable curve overhead: line_y=304,
  // curve solid band [297, 311]; avatar on orb-stand at y=333, body
  // covers [298, 333] with HEIGHT=35. To fit body samples ABOVE the
  // curve's solid band: side samples must start at y ≥ 312, i.e.,
  // sideTopY = 333 - 35 + SIDE_TOP_MARGIN ≥ 312 → SIDE_TOP_MARGIN ≥ 14.
  // Smaller margins (was 8 in calibration v2) leave a few-px overlap
  // and the side-push trips intermittently.
  SIDE_TOP_MARGIN: 14,
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

  // STEP-UP / STEP-DOWN: when moving horizontally on the ground, snap
  // onto the floor at the new x rather than running side-push +
  // ground-snap. This unifies two effects:
  //
  //   1. Walking UP a sloped curve. The slope at edgeX is even higher
  //      than at center; without this, side-push trips on the slope's
  //      continuation and the avatar oscillates ("slides backwards").
  //   2. Walking DOWN a sloped curve / off a small step. Without this,
  //      groundYBelow returns +∞ momentarily and the avatar becomes
  //      airborne, drifting off the curve as gravity takes over.
  //
  // Mid-air step-up (the "cliff-edge ledge grab" we had through the
  // earlier `nearApex` branch) is GONE: it was inadvertently letting
  // the avatar grab platforms from BELOW during a jump (e.g., jumping
  // straight up under a small platform and snapping onto its top).
  // Cliff jumps in the level have enough margin that they don't need
  // ledge-grab assistance — the avatar reaches above the platform at
  // apex and falls onto it normally.
  //
  // For step UP, we ALSO require path-continuity at the MIDPOINT
  // between (state.x, state.y) and (new_x, newFloorY): the floor at
  // midX must be near the linear interpolation of state.y and
  // newFloorY. The tolerance is CONTEXT-DEPENDENT, governed by
  // whether the avatar is currently on a sloped surface or flat
  // ground:
  //
  //   - On slope: loose tolerance (20). Slope discontinuities pass
  //     freely; the avatar walks over kinks without getting stuck.
  //   - On flat:  tight tolerance (8). Boundary cases (e.g., a curve
  //     overhead dangling within STEP_UP range of the painted floor
  //     the avatar is on) are denied — the avatar walks UNDER instead
  //     of auto-grabbing the curve.
  //
  // The slope detector probes groundYBelow at state.x and at a 4-px
  // probe ahead in the direction of motion, with a tight searchFromY
  // (state.y - 1) so it only sees the surface the avatar is actually
  // standing on (not separate higher surfaces). If those two y values
  // differ at all, we're on a slope.
  //
  // When step-up/down fires, we OWN the X/Y resolution for this tick —
  // skip side-push (the "wall" was actually a slope) and ground-snap
  // (we're already on the floor). steppedToFloor tracks this.
  let steppedToFloor = false;
  if (vx !== 0 && onGround) {
    const newFloorY = ground.groundYBelow(x, state.y - PHYSICS.STEP_UP);
    if (newFloorY < state.y && newFloorY >= state.y - PHYSICS.STEP_UP) {
      // Discriminate "step up onto a slope continuation" from "auto-grab
      // a separate higher floor (curve overhead)" by the AVERAGE SLOPE
      // of the path from (state.x, state.y) to (new_x, newFloorY):
      //
      //   - Continuous slopes are bounded by max draw-time slope:
      //       max delta_y per draw-tick = 12 × 100 / 550 = 2.18 px
      //       delta_x per draw-tick     = 1.5 (speedPerTick)
      //       max segment slope         = 2.18 / 1.5 = 1.45 per x
      //     So `avgSlope = dy/dx` ≤ 1.45 across any in-curve walk.
      //
      //   - Auto-grab cases (curve overhead with an air gap below it)
      //     produce a sharp y jump from current to new floor: avgSlope
      //     = gap / dx, often > 2 for the gaps we want to deny.
      //
      // The probe-based detector this replaced ("is yHere == yAhead 4 px
      // ahead?") fails on flat-curve-segment-to-sloped-segment
      // transitions because both probes land on the flat section and
      // look identical to flat ground — incorrectly applying the
      // tight tolerance and rejecting legitimate slope walks.
      const dx = Math.abs(x - state.x);
      const dy = state.y - newFloorY;
      const avgSlope = dx > 0 ? Math.abs(dy / dx) : 0;
      const isSlopePath = avgSlope <= 2.0;
      const continuityTolerance = isSlopePath ? 30 : 8;

      const midX = (state.x + x) / 2;
      const midFloorY = ground.groundYBelow(midX, state.y - PHYSICS.STEP_UP);
      const expectedMid = (state.y + newFloorY) / 2;
      const isContinuous =
        midFloorY !== Number.POSITIVE_INFINITY &&
        Math.abs(midFloorY - expectedMid) <= continuityTolerance;

      if (isContinuous) {
        y = newFloorY;
        vy = 0;
        onGround = true;
        steppedToFloor = true;
      }
    } else if (newFloorY > state.y && newFloorY <= state.y + PHYSICS.STEP_DOWN) {
      // Step DOWN — only for small drops. Larger drops fall through to
      // the normal Y step, so cliffs cause real airborne descent.
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
    } else if (state.onGround && vy >= 0 && groundY - y <= PHYSICS.STEP_DOWN) {
      // GROUND CATCH: avatar was on the ground last tick, isn't rising
      // (vy >= 0, so not jumping), and the floor is within STEP_DOWN of
      // their current y. Snap to it. Prevents the avatar from drifting
      // off bumpy descending slopes when step-down/up didn't fire on
      // a single tick (e.g., a tick where state.y == newFloorY exactly,
      // or a tick where step-up's continuity check failed but the slope
      // is genuinely walkable).
      y = groundY;
      vy = 0;
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
