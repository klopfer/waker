import { describe, it, expect } from 'vitest';
import { RectGround } from '../../src/game/RectGround.js';

describe('RectGround', () => {
  it('groundYBelow returns top y when column passes through the rect and y >= searchFromY', () => {
    const r = new RectGround(100, 200, 60, 30);
    expect(r.groundYBelow(120, 200)).toBe(200);
    expect(r.groundYBelow(120, 100)).toBe(200);
    expect(r.groundYBelow(120, 0)).toBe(200);
  });

  it('groundYBelow returns +Infinity when searchFromY is below the top (avatar walking under)', () => {
    const r = new RectGround(100, 200, 60, 30);
    expect(r.groundYBelow(120, 201)).toBe(Number.POSITIVE_INFINITY);
    expect(r.groundYBelow(120, 250)).toBe(Number.POSITIVE_INFINITY);
  });

  it('groundYBelow returns +Infinity when column misses the rect', () => {
    const r = new RectGround(100, 200, 60, 30);
    expect(r.groundYBelow(99, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(r.groundYBelow(160, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('solidAt is true strictly inside the rect, false on right/bottom edges (strict-less)', () => {
    const r = new RectGround(100, 200, 60, 30); // covers x ∈ [100, 160), y ∈ [200, 230)
    expect(r.solidAt(100, 200)).toBe(true);
    expect(r.solidAt(130, 215)).toBe(true);
    expect(r.solidAt(159, 229)).toBe(true);
    expect(r.solidAt(160, 215)).toBe(false);
    expect(r.solidAt(130, 230)).toBe(false);
    expect(r.solidAt(99, 215)).toBe(false);
    expect(r.solidAt(130, 199)).toBe(false);
  });

  it('overlapsBox uses strict-less semantics (edge-touch = no overlap)', () => {
    const r = new RectGround(100, 200, 60, 30); // x ∈ [100, 160), y ∈ [200, 230)
    // Fully inside
    expect(r.overlapsBox(110, 210, 20, 10)).toBe(true);
    // Touching right edge (other.x = 160 = rect right): no overlap.
    expect(r.overlapsBox(160, 210, 20, 10)).toBe(false);
    // Touching left edge (other.x + other.w = 100 = rect left): no overlap.
    expect(r.overlapsBox(80, 210, 20, 10)).toBe(false);
    // Touching top: no overlap.
    expect(r.overlapsBox(110, 170, 20, 30)).toBe(false);
    // Touching bottom: no overlap.
    expect(r.overlapsBox(110, 230, 20, 30)).toBe(false);
    // 1px overlap from the right.
    expect(r.overlapsBox(159, 210, 20, 10)).toBe(true);
  });

  it('mutating x/y/w/h changes ground queries (used by MovingPlatform)', () => {
    const r = new RectGround(0, 0, 10, 10);
    expect(r.solidAt(5, 5)).toBe(true);
    r.x = 100;
    r.y = 100;
    expect(r.solidAt(5, 5)).toBe(false);
    expect(r.solidAt(105, 105)).toBe(true);
  });
});
