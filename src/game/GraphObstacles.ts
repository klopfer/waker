// Port of `legacy/src/obstacles.mxml` proceduralGeneration.
// Procedurally places obstacle markers inside a graph rect. Each
// resulting position is suitable for instantiating a static Spike
// (which provides the collision + render).
//
// Determinism: callers supply a `seed`. The same seed + config always
// produces the same placements — useful for testing and so that
// difficulty toggling doesn't reshuffle obstacle layouts within a
// session.
//
// Legacy semantics preserved:
//   - HORIZONTALEDGE buffer on the sides (50/55/60 by difficulty).
//   - MIN_DIST_BETWEEN_2_OBJECT enforced (90/100/110 by difficulty).
//   - Bottom 50 px of graph rect excluded (avatar walking room).
//   - Each obstacle gets up to `attempts` random tries; if all fail
//     by min-distance violation, the obstacle is skipped.

import type { Difficulty } from '../engine/types.js';

export interface GraphRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObstaclePlacement {
  x: number;
  y: number;
}

export interface PlacementConfig {
  graphRect: GraphRect;
  numberObstacles: number;
  difficulty: Difficulty;
  attempts?: number;
  seed: number;
  /**
   * Optional per-obstacle Y nudges, applied AFTER placement is sorted
   * top-to-bottom by Y. yOffsets[0] adjusts the top-most obstacle,
   * yOffsets[1] the next, etc. Positive = move down, negative = up.
   *
   * Used to tune procedurally-placed obstacles into positions that
   * play better than the raw RNG output without losing determinism
   * (the SEED + RNG still pick the (x, y) starting point; the nudge
   * just shifts the result deterministically).
   *
   * Indices past `yOffsets.length` get no nudge; missing yOffsets
   * (undefined param) means no nudges anywhere.
   */
  yOffsets?: readonly number[] | undefined;
  /** Same as `yOffsets` but for the X axis. Positive = right, negative = left. */
  xOffsets?: readonly number[] | undefined;
}

const OBSTACLE_SIZE = 20;
const BOTTOM_MARGIN = 50; // legacy: don't place in the bottom 50 px

function edgeBuffer(d: Difficulty): number {
  return d === 1 ? 60 : d === 2 ? 55 : 50;
}

function minDistance(d: Difficulty): number {
  return d === 1 ? 110 : d === 2 ? 100 : 90;
}

/**
 * Convenience wrapper that places the MAX-count obstacles once with
 * a fixed difficulty, then returns just the first `count` (sorted
 * top→bottom by Y). This guarantees that easy/medium/hard see the
 * SAME first N positions — easy d1 uses the top slot from medium d1,
 * hard d1 adds a 3rd slot below medium's two, etc.
 *
 * `yOffsetsPerSlot` is applied per (sorted) slot, so the same offset
 * lands on the same visual position regardless of how many obstacles
 * the current difficulty actually shows.
 */
export function obstaclesForDifficulty(
  graphRect: GraphRect,
  seed: number,
  hardCount: number,
  count: number,
  yOffsetsPerSlot?: readonly number[],
  xOffsetsPerSlot?: readonly number[],
): ObstaclePlacement[] {
  if (count <= 0 || hardCount <= 0) return [];
  const all = placeGraphObstacles({
    graphRect,
    numberObstacles: hardCount,
    difficulty: 2, // fixed: keeps positions consistent across difficulties
    seed,
    yOffsets: yOffsetsPerSlot,
    xOffsets: xOffsetsPerSlot,
  });
  return all.slice(0, Math.min(count, all.length));
}

/** Mulberry32 PRNG — small, fast, good distribution for placement. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeGraphObstacles(cfg: PlacementConfig): ObstaclePlacement[] {
  if (cfg.numberObstacles <= 0) return [];

  const edge = edgeBuffer(cfg.difficulty);
  const minDist = minDistance(cfg.difficulty);
  const attempts = cfg.attempts ?? 50;

  const widthForObs = cfg.graphRect.width - 2 * edge;
  const heightForObs = cfg.graphRect.height - BOTTOM_MARGIN;
  if (widthForObs - OBSTACLE_SIZE <= 0 || heightForObs - OBSTACLE_SIZE <= 0) {
    return [];
  }

  const placed: ObstaclePlacement[] = [];
  // Track local coords for min-distance checks; emit world coords.
  const placedLocal: { x: number; y: number }[] = [];

  const rng = mulberry32(cfg.seed);
  let remaining = cfg.numberObstacles;

  while (remaining > 0) {
    let success = false;
    for (let tries = attempts; tries > 0 && !success; tries--) {
      const localX = rng() * (widthForObs - OBSTACLE_SIZE) + edge;
      const localY = rng() * (heightForObs - OBSTACLE_SIZE);

      let tooClose = false;
      for (const other of placedLocal) {
        const dx = localX - other.x;
        const dy = localY - other.y;
        if (dx * dx + dy * dy < minDist * minDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        placedLocal.push({ x: localX, y: localY });
        placed.push({
          x: cfg.graphRect.x + localX,
          y: cfg.graphRect.y + localY,
        });
        success = true;
      }
    }
    if (!success) break; // ran out of attempts; stop trying further obstacles
    remaining--;
  }

  // Apply per-obstacle Y + X nudges, sorted top-to-bottom by raw Y so
  // offsets[0] always lands on the topmost obstacle regardless of
  // placement order. Sort happens once even if both arrays are set.
  const hasOffsets =
    (cfg.yOffsets && cfg.yOffsets.length > 0) ||
    (cfg.xOffsets && cfg.xOffsets.length > 0);
  if (hasOffsets) {
    placed.sort((a, b) => a.y - b.y);
    for (let i = 0; i < placed.length; i++) {
      if (cfg.yOffsets && i < cfg.yOffsets.length) {
        placed[i]!.y += cfg.yOffsets[i] ?? 0;
      }
      if (cfg.xOffsets && i < cfg.xOffsets.length) {
        placed[i]!.x += cfg.xOffsets[i] ?? 0;
      }
    }
  }

  return placed;
}
