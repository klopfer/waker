import { describe, it, expect } from 'vitest';
import { placeGraphObstacles } from '../../src/game/GraphObstacles.js';

const RECT = { x: 100, y: 200, width: 300, height: 300 };

describe('placeGraphObstacles', () => {
  it('returns empty when numberObstacles <= 0', () => {
    expect(
      placeGraphObstacles({
        graphRect: RECT,
        numberObstacles: 0,
        difficulty: 2,
        seed: 1,
      }),
    ).toEqual([]);
  });

  it('returns deterministic placements for the same seed', () => {
    const a = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 3,
      difficulty: 2,
      seed: 42,
    });
    const b = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 3,
      difficulty: 2,
      seed: 42,
    });
    expect(a).toEqual(b);
  });

  it('returns different placements for different seeds', () => {
    const a = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 3,
      difficulty: 2,
      seed: 1,
    });
    const b = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 3,
      difficulty: 2,
      seed: 2,
    });
    expect(a).not.toEqual(b);
  });

  it('all placements lie inside the graph rect (minus edge buffer and bottom margin)', () => {
    const placements = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 5,
      difficulty: 2,
      seed: 99,
    });
    const minX = RECT.x + 55; // medium edge buffer
    const maxX = RECT.x + RECT.width - 55 - 20; // - size 20
    const minY = RECT.y;
    const maxY = RECT.y + RECT.height - 50 - 20; // bottom margin + size
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(minX);
      expect(p.x).toBeLessThanOrEqual(maxX);
      expect(p.y).toBeGreaterThanOrEqual(minY);
      expect(p.y).toBeLessThanOrEqual(maxY);
    }
  });

  it('enforces minimum distance between obstacles (medium = 100 px)', () => {
    const placements = placeGraphObstacles({
      graphRect: RECT,
      numberObstacles: 5,
      difficulty: 2,
      seed: 7,
    });
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const dx = placements[i]!.x - placements[j]!.x;
        const dy = placements[i]!.y - placements[j]!.y;
        const dist2 = dx * dx + dy * dy;
        expect(dist2).toBeGreaterThanOrEqual(100 * 100);
      }
    }
  });

  it('may return fewer than requested when the rect is too small', () => {
    const tinyRect = { x: 0, y: 0, width: 200, height: 80 };
    // medium edge buffer 55 + size 20 = 75 px each side → 200-110=90 wide
    // 80 height - 50 bottom - 20 size = 10 vertical room. Should still fit 1.
    // Requesting 10 obstacles — only 1 or 2 will fit (min dist 100 between).
    const placements = placeGraphObstacles({
      graphRect: tinyRect,
      numberObstacles: 10,
      difficulty: 2,
      seed: 3,
      attempts: 100,
    });
    expect(placements.length).toBeLessThan(10);
  });

  it('returns empty when the rect is too small to fit any obstacle', () => {
    expect(
      placeGraphObstacles({
        graphRect: { x: 0, y: 0, width: 60, height: 60 },
        numberObstacles: 1,
        difficulty: 2,
        seed: 1,
      }),
    ).toEqual([]);
  });
});
