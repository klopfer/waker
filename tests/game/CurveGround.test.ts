import { describe, it, expect } from 'vitest';
import { CurveGround } from '../../src/game/CurveGround.js';

describe('CurveGround', () => {
  it('returns Infinity with fewer than 2 points', () => {
    expect(new CurveGround([]).groundYBelow(100, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(new CurveGround([{ x: 100, y: 200 }]).groundYBelow(100, 0)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('linearly interpolates y between points', () => {
    // Diagonal: (0, 100) -> (100, 200)
    const c = new CurveGround([
      { x: 0, y: 100 },
      { x: 100, y: 200 },
    ]);
    expect(c.groundYBelow(0, 0)).toBe(100);
    expect(c.groundYBelow(50, 0)).toBe(150);
    expect(c.groundYBelow(100, 0)).toBe(200);
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
    expect(c.groundYBelow(50, 200)).toBe(Number.POSITIVE_INFINITY); // curve is above
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

  it('handles multi-segment curves', () => {
    // V-shape: (0,200) -> (50,100) -> (100,200)
    const c = new CurveGround([
      { x: 0, y: 200 },
      { x: 50, y: 100 },
      { x: 100, y: 200 },
    ]);
    expect(c.groundYBelow(0, 0)).toBe(200);
    expect(c.groundYBelow(25, 0)).toBe(150);
    expect(c.groundYBelow(50, 0)).toBe(100);
    expect(c.groundYBelow(75, 0)).toBe(150);
    expect(c.groundYBelow(100, 0)).toBe(200);
  });
});
