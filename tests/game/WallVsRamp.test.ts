// Behavioral spec for the wall-vs-ramp discriminator (side collision).
// These lock the intended behavior BEFORE reworking isWallAt/side-push so
// the rework can't silently regress walkable slopes or the d3 trap.
import { describe, it, expect } from 'vitest';
import { CurveGround } from '../../src/game/CurveGround.js';
import { CompositeGround } from '../../src/game/CompositeGround.js';
import { FlatGround } from '../../src/game/Movements.js';
import {
  PHYSICS,
  BODY,
  step,
  type GroundProvider,
  type MovementState,
  type MovementInputs,
} from '../../src/game/Movements.js';

// A drawn graph platform: flat valley at y=400, then a rising segment of a
// given slope, then a flat plateau. Points 1.5 px apart in x (like Graph).
function curveWithSlope(slope: number): CurveGround {
  const pts: { x: number; y: number }[] = [];
  for (let x = 100; x <= 360; x += 1.5) pts.push({ x, y: 400 });
  let y = 400;
  let x = 361.5;
  while (y > 150) {
    y = Math.max(150, y - slope * 1.5);
    pts.push({ x, y });
    x += 1.5;
  }
  for (; x <= 620; x += 1.5) pts.push({ x, y: 150 });
  return new CurveGround(pts, 14);
}

function walkRight(ground: GroundProvider, sprint: boolean, start?: Partial<MovementState>): MovementState {
  const inputs: MovementInputs = { moveLeft: false, moveRight: true, sprint, jumpPressed: false };
  const v0 = sprint ? PHYSICS.MAX_RUN_SPEED : PHYSICS.WALK_SPEED;
  let s: MovementState = {
    x: 300,
    y: 393,
    vx: v0,
    vy: 0,
    facingRight: true,
    onGround: true,
    ...start,
  };
  for (let i = 0; i < 70; i++) s = step(s, inputs, ground);
  return s;
}

const RAMP_START_X = 360;

describe('wall-vs-ramp discriminator', () => {
  // Walkable slopes climb onto the plateau when WALKED into. (Walk is the
  // common approach; see the KNOWN LIMITATION note below re: sprinting into
  // a moderately-steep-but-walkable ramp from a standing-ish approach.)
  for (const slope of [0.8, 1.2, 1.8, 2.5]) {
    it(`climbs walkable slope ${slope} (walk)`, () => {
      const g = new CompositeGround();
      g.add(curveWithSlope(slope));
      const s = walkRight(g, false);
      expect(s.x).toBeGreaterThan(RAMP_START_X);
      expect(s.y).toBeLessThan(390);
    });
  }
  // Gentle ramps also climb at sprint speed.
  for (const slope of [0.8, 1.2]) {
    it(`climbs gentle slope ${slope} (sprint)`, () => {
      const g = new CompositeGround();
      g.add(curveWithSlope(slope));
      const s = walkRight(g, true);
      expect(s.x).toBeGreaterThan(RAMP_START_X);
    });
  }

  // Steep braking / hard-stop curve segments (the reported bug): the avatar
  // is stopped in front, never climbs up. Slope ≥ 6 is the guaranteed-wall
  // band (drawn "vertical" walls are far steeper); ~4–5 is a soft boundary.
  for (const slope of [6, 9, 30]) {
    for (const sprint of [false, true]) {
      it(`is stopped by steep wall slope ${slope} (sprint=${sprint})`, () => {
        const g = new CompositeGround();
        g.add(curveWithSlope(slope));
        const s = walkRight(g, sprint);
        expect(s.x).toBeLessThanOrEqual(RAMP_START_X);
        expect(s.y).toBeGreaterThan(360);
      });
    }
  }

  it('stops flush at a full-height pixel wall', () => {
    // Floor at y=400; everything at x>=400 is solid (full-height wall).
    const wall: GroundProvider = {
      groundYBelow: (x, from) =>
        Math.floor(x) >= 400 ? (from <= 600 ? 0 : Number.POSITIVE_INFINITY) : from <= 400 ? 400 : Number.POSITIVE_INFINITY,
      solidAt: (x, y) => (Math.floor(x) >= 400 ? y >= 0 && y <= 600 : y >= 400 && y <= 600),
    };
    const s = walkRight(wall, false);
    expect(s.x + BODY.HALF_WIDTH).toBeLessThanOrEqual(400);
    expect(s.y).toBe(400); // stayed on the floor
  });

  it('d3 trap: a low curve bar above the floor blocks horizontal movement', () => {
    // Avatar on a flat painted floor at y=400. A horizontal curve bar sits
    // ~22 px above the feet (in the body) across x=360..520 — drawing the
    // displacement curve "too low". The avatar must be unable to walk past.
    const g = new CompositeGround();
    g.add(new FlatGround(400));
    g.add(
      new CurveGround(
        [
          { x: 360, y: 378 },
          { x: 520, y: 378 },
        ],
        14,
      ),
    );
    const s = walkRight(g, false);
    // The bar's left face is at x≈360 (±half). Body right edge can't pass it.
    expect(s.x + BODY.HALF_WIDTH).toBeLessThanOrEqual(360 + 8);
  });

  it('walks freely under a curve that clears the head', () => {
    // Same flat floor, but the bar is well above the head (y=330, head is at
    // 400-35=365) — the avatar should walk straight under it.
    const g = new CompositeGround();
    g.add(new FlatGround(400));
    g.add(
      new CurveGround(
        [
          { x: 360, y: 330 },
          { x: 520, y: 330 },
        ],
        14,
      ),
    );
    const s = walkRight(g, false);
    expect(s.x).toBeGreaterThan(420); // passed under the bar
  });
});
