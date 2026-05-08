import { describe, it, expect } from 'vitest';
import { CompositeGround } from '../../src/game/CompositeGround.js';
import { FlatGround } from '../../src/game/Movements.js';

describe('CompositeGround', () => {
  it('returns Infinity with no layers', () => {
    const c = new CompositeGround();
    expect(c.groundYBelow(100, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(c.solidAt(100, 100)).toBe(false);
  });

  it('returns the closest floor across layers', () => {
    const c = new CompositeGround();
    c.add(new FlatGround(500));
    c.add(new FlatGround(400));
    expect(c.groundYBelow(100, 0)).toBe(400);
  });

  it('skips layers above the search start', () => {
    const c = new CompositeGround();
    c.add(new FlatGround(500));
    c.add(new FlatGround(400));
    expect(c.groundYBelow(100, 450)).toBe(500); // 400 < 450 so skipped
  });

  it('solidAt is OR over layers', () => {
    const c = new CompositeGround();
    const lo: { groundYBelow: () => number; solidAt: (x: number, y: number) => boolean } = {
      groundYBelow: () => 500,
      solidAt: (_x, y) => y >= 500,
    };
    const hi: { groundYBelow: () => number; solidAt: (x: number, y: number) => boolean } = {
      groundYBelow: () => 400,
      solidAt: (_x, y) => y === 400,
    };
    c.add(lo);
    c.add(hi);
    expect(c.solidAt(0, 400)).toBe(true);
    expect(c.solidAt(0, 600)).toBe(true);
    expect(c.solidAt(0, 450)).toBe(false);
  });

  it('add+remove drops a layer', () => {
    const c = new CompositeGround();
    const a = new FlatGround(500);
    const b = new FlatGround(400);
    c.add(a);
    c.add(b);
    c.remove(b);
    expect(c.has(a)).toBe(true);
    expect(c.has(b)).toBe(false);
    expect(c.groundYBelow(0, 0)).toBe(500);
  });
});
