import { describe, it, expect } from 'vitest';
import {
  pixelsOverlap,
  type PixelMask,
  type PixelHittable,
} from '../../src/engine/HitTest.js';
import { aabbIntersection, aabbOverlap } from '../../src/engine/types.js';

function solidMask(w: number, h: number): PixelMask {
  return { alpha: new Uint8ClampedArray(w * h).fill(255), width: w, height: h };
}

function emptyMask(w: number, h: number): PixelMask {
  return { alpha: new Uint8ClampedArray(w * h), width: w, height: h };
}

function diagonalMask(size: number): PixelMask {
  const m = emptyMask(size, size);
  for (let i = 0; i < size; i++) m.alpha[i * size + i] = 255;
  return m;
}

describe('aabb helpers', () => {
  it('aabbOverlap detects overlap and separation', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
  });

  it('aabbIntersection returns overlap rect or zero-size', () => {
    const i = aabbIntersection({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 });
    expect(i).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    const j = aabbIntersection({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 });
    expect(j.width).toBe(0);
    expect(j.height).toBe(0);
  });
});

describe('pixelsOverlap', () => {
  it('returns false when AABBs do not overlap', () => {
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 8, height: 8, mask: solidMask(8, 8) };
    const b: PixelHittable = { worldX: 100, worldY: 100, width: 8, height: 8, mask: solidMask(8, 8) };
    expect(pixelsOverlap(a, b)).toBe(false);
  });

  it('returns true when both maskless AABBs overlap', () => {
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 10, height: 10 };
    const b: PixelHittable = { worldX: 5, worldY: 5, width: 10, height: 10 };
    expect(pixelsOverlap(a, b)).toBe(true);
  });

  it('returns true when one solid mask AABB-overlaps another with mask', () => {
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 8, height: 8, mask: solidMask(8, 8) };
    const b: PixelHittable = { worldX: 4, worldY: 4, width: 8, height: 8, mask: solidMask(8, 8) };
    expect(pixelsOverlap(a, b)).toBe(true);
  });

  it('returns false when AABBs overlap but masks are entirely transparent in the overlap', () => {
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 8, height: 8, mask: emptyMask(8, 8) };
    const b: PixelHittable = { worldX: 4, worldY: 4, width: 8, height: 8, mask: solidMask(8, 8) };
    expect(pixelsOverlap(a, b)).toBe(false);
  });

  it('returns false for diagonals that AABB-overlap but never share a pixel', () => {
    // A's NW->SE diagonal is at world {(0,0), (1,1), ..., (7,7)}.
    // B's SW->NE diagonal at world offset (4,0) is at {(11,0), (10,1), ..., (4,7)}.
    // No integer (i,i) point coincides with any (11-r, r) point in the AABB overlap,
    // so the alpha-AND scan should report no contact.
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 8, height: 8, mask: diagonalMask(8) };
    const flipped: PixelMask = emptyMask(8, 8);
    for (let i = 0; i < 8; i++) flipped.alpha[i * 8 + (7 - i)] = 255;
    const b: PixelHittable = { worldX: 4, worldY: 0, width: 8, height: 8, mask: flipped };
    expect(pixelsOverlap(a, b)).toBe(false);
  });

  it('returns true for diagonals that share at least one solid pixel', () => {
    const a: PixelHittable = { worldX: 0, worldY: 0, width: 8, height: 8, mask: diagonalMask(8) };
    // Same NW->SE diagonal in B, offset by (3, 3). Their world pixels overlap from (3,3)..(7,7).
    const b: PixelHittable = { worldX: 3, worldY: 3, width: 8, height: 8, mask: diagonalMask(8) };
    expect(pixelsOverlap(a, b)).toBe(true);
  });

  it('handles single-mask scan when only one operand has a mask', () => {
    const solidA: PixelHittable = { worldX: 0, worldY: 0, width: 4, height: 4, mask: solidMask(4, 4) };
    const aabbB: PixelHittable = { worldX: 2, worldY: 2, width: 4, height: 4 };
    expect(pixelsOverlap(solidA, aabbB)).toBe(true);

    const emptyA: PixelHittable = { worldX: 0, worldY: 0, width: 4, height: 4, mask: emptyMask(4, 4) };
    expect(pixelsOverlap(emptyA, aabbB)).toBe(false);
  });
});
