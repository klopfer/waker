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

  // Regression: solidAt expanded each segment's x range by ±half (so
  // endpoints are rounded), but groundYBelow used strict xMin..xMax.
  // The avatar's ground-catch would then miss the curve at columns
  // just past a segment's strict end where solidAt still reports
  // solid (the endpoint cap) — manifesting as "jump above the curve,
  // fall right through" at segment joints with steep slope changes.
  // Fix: groundYBelow uses ±half expansion + clamped t.
  describe('groundYBelow vs solidAt: segment endpoint consistency', () => {
    // Two-segment curve with a steep slope change at the joint.
    //   p0=(100, 300) → p1=(200, 250) → p2=(210, 150)  (steep rise after joint)
    const c = new CurveGround(
      [
        { x: 100, y: 300 },
        { x: 200, y: 250 },
        { x: 210, y: 150 },
      ],
      14,
    );

    it('groundYBelow and solidAt agree at the joint x', () => {
      // At x=200 (the joint), both should see solid at the line y=250.
      expect(c.solidAt(200, 250)).toBe(true);
      expect(c.groundYBelow(200, 0)).toBe(243); // line - half = 243
    });

    it('groundYBelow returns a top in the ±half endcap past a segment end', () => {
      // x=204 is past segment 1's strict xMax=200 but inside the ±7
      // endcap (covers 193..207). Should return p1's y (250) clamped.
      // Segment 2 also covers this x: yLine at x=204 = 250 + (4/10)*(150-250) = 210.
      // Min top = 210 - 7 = 203.
      const result = c.groundYBelow(204, 0);
      // Should be ≤ 250-7=243 (segment 1's endcap) AND ≤ 210-7=203
      // (segment 2). Min is 203.
      expect(result).toBe(203);
    });

    it('groundYBelow returns a finite value at x past the last segment if within endcap', () => {
      // x=215 is past segment 2's xMax=210 but inside the ±7 endcap
      // (covers 203..217). Should return p2.y - half = 143 (clamped t=1).
      expect(c.groundYBelow(215, 0)).toBe(143);
      expect(c.solidAt(215, 150)).toBe(true);
    });

    it('groundYBelow returns Infinity past the endcap', () => {
      expect(c.groundYBelow(218, 0)).toBe(Number.POSITIVE_INFINITY);
      expect(c.solidAt(218, 150)).toBe(false);
    });
  });
});
