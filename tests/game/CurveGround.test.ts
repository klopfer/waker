import { describe, it, expect } from 'vitest';
import { CurveGround } from '../../src/game/CurveGround.js';

describe('CurveGround', () => {
  it('returns Infinity with fewer than 2 points', () => {
    expect(new CurveGround([]).groundYBelow(100, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(new CurveGround([{ x: 100, y: 200 }]).groundYBelow(100, 0)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('returns the curve TOP (line - thickness/2), not the line center', () => {
    // Diagonal: (0, 100) -> (100, 200), thickness 14 → top = line - 7.
    const c = new CurveGround(
      [
        { x: 0, y: 100 },
        { x: 100, y: 200 },
      ],
      14,
    );
    expect(c.groundYBelow(0, 0)).toBe(93);
    expect(c.groundYBelow(50, 0)).toBe(143);
    expect(c.groundYBelow(100, 0)).toBe(193);
  });

  it('skips x outside the curve range', () => {
    const c = new CurveGround([
      { x: 0, y: 100 },
      { x: 100, y: 200 },
    ]);
    expect(c.groundYBelow(-10, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(c.groundYBelow(110, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('skips segments above the search start (avatar passes underneath)', () => {
    const c = new CurveGround([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);
    expect(c.groundYBelow(50, 200)).toBe(Number.POSITIVE_INFINITY); // curve top still above
  });

  it('solidAt detects points within thickness/2 of the curve', () => {
    const c = new CurveGround(
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      14,
    );
    expect(c.solidAt(50, 100)).toBe(true);
    expect(c.solidAt(50, 95)).toBe(true); // within 7
    expect(c.solidAt(50, 107)).toBe(true);
    expect(c.solidAt(50, 92)).toBe(false); // 8 px away, beyond half-thickness
    expect(c.solidAt(50, 200)).toBe(false);
  });

  it('groundYBelow + solidAt are consistent: feet land on the top of the solid band', () => {
    // Curve at line_y=100, thickness=14. solidAt true for y in [93, 107].
    // groundYBelow returns the topmost-solid (93), so an avatar landing at
    // that y has feet on the curve's TOP edge, body samples above are clear.
    const c = new CurveGround(
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      14,
    );
    const top = c.groundYBelow(50, 0);
    expect(top).toBe(93);
    expect(c.solidAt(50, top)).toBe(true); // feet sit on the band's top edge
    expect(c.solidAt(50, top - 1)).toBe(false); // 1 px above is clear
  });

  it('handles multi-segment curves', () => {
    // V-shape: (0,200) -> (50,100) -> (100,200), thickness 14.
    const c = new CurveGround(
      [
        { x: 0, y: 200 },
        { x: 50, y: 100 },
        { x: 100, y: 200 },
      ],
      14,
    );
    expect(c.groundYBelow(0, 0)).toBe(193);
    expect(c.groundYBelow(25, 0)).toBe(143);
    expect(c.groundYBelow(50, 0)).toBe(93);
    expect(c.groundYBelow(75, 0)).toBe(143);
    expect(c.groundYBelow(100, 0)).toBe(193);
  });
});
