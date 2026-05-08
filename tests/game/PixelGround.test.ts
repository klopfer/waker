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

describe('PixelGround', () => {
  it('returns Infinity for fully transparent columns', () => {
    const g = new PixelGround(makeImageData(8, 8, []));
    expect(g.groundYAt(3)).toBe(Number.POSITIVE_INFINITY);
  });

  it('finds the topmost opaque pixel per column', () => {
    const g = new PixelGround(
      makeImageData(8, 8, [
        [0, 7],
        [1, 6],
        [2, 5],
        [3, 4],
        [4, 4],
      ]),
    );
    expect(g.groundYAt(0)).toBe(7);
    expect(g.groundYAt(1)).toBe(6);
    expect(g.groundYAt(2)).toBe(5);
    expect(g.groundYAt(3)).toBe(4);
    expect(g.groundYAt(4)).toBe(4);
    expect(g.groundYAt(5)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns Infinity for out-of-bounds x', () => {
    const g = new PixelGround(makeImageData(8, 8, [[3, 5]]));
    expect(g.groundYAt(-1)).toBe(Number.POSITIVE_INFINITY);
    expect(g.groundYAt(8)).toBe(Number.POSITIVE_INFINITY);
    expect(g.groundYAt(100)).toBe(Number.POSITIVE_INFINITY);
  });

  it('floors fractional x to the column index', () => {
    const g = new PixelGround(makeImageData(8, 8, [[3, 5]]));
    expect(g.groundYAt(3.0)).toBe(5);
    expect(g.groundYAt(3.6)).toBe(5);
    expect(g.groundYAt(2.99)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats the topmost pixel found as the ground (overhangs ignored)', () => {
    const g = new PixelGround(
      makeImageData(8, 8, [
        [4, 2],
        [4, 6],
      ]),
    );
    expect(g.groundYAt(4)).toBe(2);
  });

  it('uses a >128 alpha threshold (semi-transparent edges ignored)', () => {
    const w = 4,
      h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    data[(0 * w + 1) * 4 + 3] = 100;
    data[(1 * w + 1) * 4 + 3] = 200;
    const g = new PixelGround({ data, width: w, height: h, colorSpace: 'srgb' } as ImageData);
    expect(g.groundYAt(1)).toBe(1);
  });
});
