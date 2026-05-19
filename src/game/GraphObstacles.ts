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
}

const OBSTACLE_SIZE = 20;
const BOTTOM_MARGIN = 50; // legacy: don't place in the bottom 50 px

function edgeBuffer(d: Difficulty): number {
  return d === 1 ? 60 : d === 2 ? 55 : 50;
}

function minDistance(d: Difficulty): number {
  return d === 1 ? 110 : d === 2 ? 100 : 90;
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

  return placed;
}
