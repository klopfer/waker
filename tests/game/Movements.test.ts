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

  it('does not climb a full-height edge wall via the side ground-samples', () => {
    // Regression: velocity0's screen-edge walls are solid full-height
    // columns. PixelGround.groundYBelow scans UP to a band's top when the
    // search start is already inside solid, so a side-sample (x ± HALF_WIDTH)
    // landing inside the wall returns the wall's top (y≈0). The 3-sample
    // ground catch took min() of those, snapping the avatar to the top of
    // the wall — letting it "climb" the edge to the screen top. The fix
    // rejects samples more than STEP_UP above the feet.
    const WALL_RIGHT = 16;
    const FLOOR_Y = 482;
    const edgeWall: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        if (Math.floor(x) < WALL_RIGHT) return 0; // full-height wall: band top
        return searchFromY <= FLOOR_Y ? FLOOR_Y : Number.POSITIVE_INFINITY;
      },
      solidAt: (x: number, y: number) => (Math.floor(x) < WALL_RIGHT ? true : y >= FLOOR_Y),
    };
    let s = start({ x: 60, y: FLOOR_Y });
    for (let i = 0; i < 60; i++) s = step(s, { ...NEUTRAL, moveLeft: true }, edgeWall);
    // Stays on the floor — never snapped up the wall (pre-fix: y ≈ 0).
    expect(s.y).toBe(FLOOR_Y);
    // Stopped by the wall, body never pushed through it.
    expect(s.x - BODY.HALF_WIDTH).toBeGreaterThanOrEqual(WALL_RIGHT - 1);
  });

  it('does not burrow into a wall reached by walking up a slope', () => {
    // Regression (velocity0): a gentle, walkable slope leads up to a
    // full-height wall (the screen-edge walls have a curved floor in front
    // of them). Pre-fix, step-up fired each tick climbing the slope and
    // SKIPPED side-push, so the avatar's body burrowed into the wall until
    // only its tail showed / it got stuck high on the wall. The head-gate
    // suppresses step-up at the wall so side-push stops the body flush.
    const WALL_X = 200;
    const slopeY = (x: number) => 500 - Math.max(0, Math.min(100, x - 100)) * 0.3;
    const slopeIntoWall: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        const ix = Math.floor(x);
        if (ix >= WALL_X) return searchFromY <= 600 ? 0 : Number.POSITIVE_INFINITY;
        return searchFromY <= 600 ? slopeY(ix) : Number.POSITIVE_INFINITY;
      },
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        if (ix >= WALL_X) return y >= 0 && y <= 600;
        return y >= slopeY(ix) && y <= 600;
      },
    };
    let s = start({ x: 110, y: slopeY(110) });
    for (let i = 0; i < 60; i++) s = step(s, { ...NEUTRAL, moveRight: true }, slopeIntoWall);
    // Body's right edge stops at the wall face, never crossing into it.
    expect(s.x + BODY.HALF_WIDTH).toBeLessThanOrEqual(WALL_X);
    // Climbed the slope toward the wall (didn't stall at the start).
    expect(s.x).toBeGreaterThan(150);
    // Never climbed the full-height wall toward the top of the screen.
    expect(s.y).toBeGreaterThan(400);
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
    // Floor at y=200, ceiling solid at y <= CEILING_Y. A single jump rises
    // about JUMP_IMPULSE^2/(2*GRAVITY) ≈ 52 px, so an avatar at y=200
    // (body top = 200 - BODY.HEIGHT) reaches body top = 200 - HEIGHT - 52
    // at apex. Set the ceiling 8 px below that so the head-bump branch
    // reliably triggers regardless of how BODY.HEIGHT is calibrated.
    const APEX_BODY_TOP = 200 - BODY.HEIGHT - 52;
    const CEILING_Y = APEX_BODY_TOP + 8;
    const ceilingAndFloor: GroundProvider = {
      groundYBelow: (_x: number, y: number) => (y <= 200 ? 200 : Number.POSITIVE_INFINITY),
      solidAt: (_x: number, y: number) => {
        const iy = Math.floor(y);
        return iy <= CEILING_Y || iy >= 200;
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
    expect(s.y - BODY.HEIGHT).toBeGreaterThan(CEILING_Y);
  });

  it('jumping sideways onto an adjacent platform lands on its top', () => {
    // leveld1-shaped synthetic ground: low platform at x in [0, 70] with top
    // at y=440 (and solid down through the bottom of the canvas), main floor
    // at x in [70, 800] with top at y=498. The platform sits 58 px above the
    // main floor — at the upper bound of the single-jump arc (60 px), so it
    // takes a clean jump while moving left to land on it. Pre-fix this test
    // failed because side-push at the new y kicked the avatar back as soon
    // as their descending feet crossed the platform top y.
    const leveld1ish: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        const ix = Math.floor(x);
        if (ix < 0 || ix > 800) return Number.POSITIVE_INFINITY;
        const platformZone = ix < 70;
        const groundTop = platformZone ? 440 : 498;
        if (Math.floor(searchFromY) > groundTop) {
          // Inside or below the surface — return wherever the search starts.
          return Math.max(groundTop, Math.floor(searchFromY));
        }
        return groundTop;
      },
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (ix < 0 || ix > 800 || iy < 0) return false;
        if (ix < 70) return iy >= 440;
        return iy >= 498;
      },
    };

    let s: MovementState = {
      x: 86, y: 498, vx: 0, vy: 0, facingRight: true, onGround: true,
    };
    s = step(s, { ...NEUTRAL, jumpPressed: true, moveLeft: true }, leveld1ish);
    let landedOnPlatform = false;
    for (let i = 0; i < 30; i++) {
      s = step(s, { ...NEUTRAL, moveLeft: true }, leveld1ish);
      if (s.onGround && s.y === 440) {
        landedOnPlatform = true;
        break;
      }
    }
    expect(landedOnPlatform).toBe(true);
  });

  it('approaching a side wall at body height is symmetric L vs R', () => {
    // Vertical strip at x ∈ [W_LEFT, W_RIGHT] solid at body height
    // (between feet and head, in the side-push sample range). Avatar
    // approaches the strip from each side; mirror invariant.
    const FLOOR_Y = 500;
    const W_LEFT = 200;
    const W_RIGHT = 280;
    const STRIP_TOP_Y = FLOOR_Y - 24; // = sideTopY+1 sample
    const STRIP_BOT_Y = FLOOR_Y - 6;  // inside side-push range
    const sideWall: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        const ix = Math.floor(x);
        if (ix >= W_LEFT && ix <= W_RIGHT && searchFromY <= STRIP_TOP_Y) return STRIP_TOP_Y;
        return searchFromY <= FLOOR_Y ? FLOOR_Y : Number.POSITIVE_INFINITY;
      },
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (iy >= FLOOR_Y) return true;
        if (ix >= W_LEFT && ix <= W_RIGHT && iy >= STRIP_TOP_Y && iy <= STRIP_BOT_Y) return true;
        return false;
      },
    };
    let rightS: MovementState = { x: 150, y: FLOOR_Y, vx: 0, vy: 0, facingRight: true, onGround: true };
    for (let i = 0; i < 60; i++) rightS = step(rightS, { ...NEUTRAL, moveRight: true }, sideWall);
    let leftS: MovementState = { x: 330, y: FLOOR_Y, vx: 0, vy: 0, facingRight: false, onGround: true };
    for (let i = 0; i < 60; i++) leftS = step(leftS, { ...NEUTRAL, moveLeft: true }, sideWall);
    const rightFinalEdge = rightS.x + BODY.HALF_WIDTH;
    const leftFinalEdge = leftS.x - BODY.HALF_WIDTH;
    // Distance from each avatar's leading edge to the strip should match.
    const rightGap = W_LEFT - rightFinalEdge;
    const leftGap = leftFinalEdge - W_RIGHT;
    expect(Math.abs(rightGap - leftGap)).toBeLessThanOrEqual(2);
  });

  it('walking off a narrow ledge is symmetric L vs R', () => {
    // Narrow platform from x=[200, 280] at y=440, infinite floor at y=500.
    // Walk off each edge; the avatar should descend symmetrically.
    const PLATFORM_TOP = 440;
    const FLOOR_Y = 500;
    const P_LEFT = 200;
    const P_RIGHT = 280;
    const narrowLedge: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        const ix = Math.floor(x);
        if (ix >= P_LEFT && ix <= P_RIGHT && searchFromY <= PLATFORM_TOP) return PLATFORM_TOP;
        return searchFromY <= FLOOR_Y ? FLOOR_Y : Number.POSITIVE_INFINITY;
      },
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (iy >= FLOOR_Y) return true;
        if (ix >= P_LEFT && ix <= P_RIGHT && iy >= PLATFORM_TOP) return true;
        return false;
      },
    };
    let rightS: MovementState = { x: 240, y: PLATFORM_TOP, vx: 0, vy: 0, facingRight: true, onGround: true };
    for (let i = 0; i < 40; i++) rightS = step(rightS, { ...NEUTRAL, moveRight: true }, narrowLedge);
    let leftS: MovementState = { x: 240, y: PLATFORM_TOP, vx: 0, vy: 0, facingRight: false, onGround: true };
    for (let i = 0; i < 40; i++) leftS = step(leftS, { ...NEUTRAL, moveLeft: true }, narrowLedge);
    // Both should have walked off and landed on the floor.
    expect(rightS.y).toBe(FLOOR_Y);
    expect(leftS.y).toBe(FLOOR_Y);
    expect(rightS.onGround).toBe(true);
    expect(leftS.onGround).toBe(true);
    const rightDist = rightS.x - 240;
    const leftDist = 240 - leftS.x;
    expect(Math.abs(rightDist - leftDist)).toBeLessThanOrEqual(2);
  });

  it('walking left vs right under an overhead curve is symmetric', () => {
    // mixed1 stuck-near-door symptom: a player-drawn curve creates a
    // narrow passage just above the platform top. Walking LEFT→RIGHT
    // under it works; walking RIGHT→LEFT through the SAME geometry gets
    // wedged. If the physics has a direction-asymmetric bug, this test
    // (mirrored geometry, mirrored motion) will diverge.
    //
    // Floor: solid at y >= FLOOR_Y for all x.
    // Curve: a solid horizontal strip 12 px wide at head height,
    //   spanning x ∈ [PASSAGE_X_MIN, PASSAGE_X_MAX]. The strip's top is
    //   STRIP_TOP_Y, bottom is STRIP_BOT_Y. STRIP_BOT_Y sits just below
    //   the avatar's body top (= FLOOR_Y - BODY.HEIGHT) so it counts as
    //   head-height contact but does not fully block the body.
    const FLOOR_Y = 500;
    const STRIP_TOP_Y = FLOOR_Y - BODY.HEIGHT - 6;
    const STRIP_BOT_Y = FLOOR_Y - BODY.HEIGHT + 2;
    const PASSAGE_X_MIN = 200;
    const PASSAGE_X_MAX = 280;
    const wedge: GroundProvider = {
      groundYBelow: (x: number, searchFromY: number) => {
        const ix = Math.floor(x);
        if (
          ix >= PASSAGE_X_MIN &&
          ix <= PASSAGE_X_MAX &&
          searchFromY <= STRIP_TOP_Y
        ) {
          return STRIP_TOP_Y;
        }
        return searchFromY <= FLOOR_Y ? FLOOR_Y : Number.POSITIVE_INFINITY;
      },
      solidAt: (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (iy >= FLOOR_Y) return true;
        if (
          ix >= PASSAGE_X_MIN &&
          ix <= PASSAGE_X_MAX &&
          iy >= STRIP_TOP_Y &&
          iy <= STRIP_BOT_Y
        ) {
          return true;
        }
        return false;
      },
    };

    // Start at x=150 (clear of the strip on the LEFT), walk right.
    let rightS: MovementState = { x: 150, y: FLOOR_Y, vx: 0, vy: 0, facingRight: true, onGround: true };
    for (let i = 0; i < 60; i++) rightS = step(rightS, { ...NEUTRAL, moveRight: true }, wedge);
    const rightFinalX = rightS.x;

    // Start at x=330 (clear of the strip on the RIGHT), walk left.
    let leftS: MovementState = { x: 330, y: FLOOR_Y, vx: 0, vy: 0, facingRight: false, onGround: true };
    for (let i = 0; i < 60; i++) leftS = step(leftS, { ...NEUTRAL, moveLeft: true }, wedge);
    const leftFinalX = leftS.x;

    // Mirror: distance traveled from the start should be the same magnitude.
    const rightDist = rightFinalX - 150;
    const leftDist = 330 - leftFinalX;
    // Allow 2 px slack (axis sampling can stop at slightly different
    // sub-pixel positions). Anything more is a real direction asymmetry.
    expect(Math.abs(rightDist - leftDist)).toBeLessThanOrEqual(2);
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
