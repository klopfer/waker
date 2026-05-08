import { describe, it, expect } from 'vitest';
import { PixelGround } from '../../src/game/PixelGround.js';

// jsdom doesn't expose the ImageData constructor; PixelGround only reads
// .data / .width / .height so a plain duck-typed object suffices for tests.
function makeImageData(
  w: number,
  h: number,
  opaquePixels: ReadonlyArray<[number, number]>,
): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of opaquePixels) data[(y * w + x) * 4 + 3] = 255;
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

describe('PixelGround.groundYBelow', () => {
  it('returns Infinity for fully transparent columns', () => {
    const g = new PixelGround(makeImageData(8, 8, []));
    expect(g.groundYBelow(3, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('finds the next opaque pixel at or below the search y', () => {
    // Two-platform column: opaque at y=2 and y=6.
    const g = new PixelGround(makeImageData(8, 8, [[3, 2], [3, 6]]));
    // Searching from above the top platform: returns top (2).
    expect(g.groundYBelow(3, 0)).toBe(2);
    // Searching at the top platform: returns 2 (still on it).
    expect(g.groundYBelow(3, 2)).toBe(2);
    // Searching just below the top platform: skips it, finds 6.
    expect(g.groundYBelow(3, 3)).toBe(6);
    // Searching below the bottom platform: nothing further.
    expect(g.groundYBelow(3, 7)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns Infinity for out-of-bounds x', () => {
    const g = new PixelGround(makeImageData(8, 8, [[3, 5]]));
    expect(g.groundYBelow(-1, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(g.groundYBelow(8, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('floors fractional x to the column index', () => {
    const g = new PixelGround(makeImageData(8, 8, [[3, 5]]));
    expect(g.groundYBelow(3.0, 0)).toBe(5);
    expect(g.groundYBelow(3.6, 0)).toBe(5);
    expect(g.groundYBelow(2.99, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('clamps negative search-from-y to 0', () => {
    const g = new PixelGround(makeImageData(8, 8, [[3, 5]]));
    expect(g.groundYBelow(3, -100)).toBe(5);
  });

  it('walking under a high platform: returns the floor, not the platform top', () => {
    // x=4 column has a "platform" at y=2 and a "floor" at y=7. An avatar at
    // y=7 (on the floor) should keep seeing 7, not snap up to 2.
    const g = new PixelGround(makeImageData(8, 8, [[4, 2], [4, 7]]));
    expect(g.groundYBelow(4, 7)).toBe(7);
    expect(g.groundYBelow(4, 5)).toBe(7);
  });

  it('uses a >128 alpha threshold (semi-transparent edges ignored)', () => {
    const w = 4, h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    data[(0 * w + 1) * 4 + 3] = 100;
    data[(1 * w + 1) * 4 + 3] = 200;
    const g = new PixelGround({ data, width: w, height: h, colorSpace: 'srgb' } as ImageData);
    expect(g.groundYBelow(1, 0)).toBe(1);
  });
});
