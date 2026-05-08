import type { GroundProvider } from './Movements.js';

export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * GroundProvider over a polyline curve in world space (the curve a player
 * draws by holding an activation orb). For each column x where the curve
 * passes through, exposes a per-x y from linear interpolation between
 * adjacent points; solidAt reports points within `thickness/2` vertical
 * pixels of the curve (matching the original game's lineStyle width=14).
 *
 * The curve is meant to be one-y-per-x: graph drawing always advances time
 * (x) monotonically, so we don't need to worry about back-tracking.
 */
export class CurveGround implements GroundProvider {
  constructor(
    private readonly points: readonly CurvePoint[],
    private readonly thickness: number = 14,
  ) {}

  groundYBelow(x: number, searchFromY: number): number {
    if (this.points.length < 2) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p0 = this.points[i]!;
      const p1 = this.points[i + 1]!;
      const xMin = Math.min(p0.x, p1.x);
      const xMax = Math.max(p0.x, p1.x);
      if (x < xMin || x > xMax) continue;
      const dx = p1.x - p0.x;
      const t = dx === 0 ? 0 : (x - p0.x) / dx;
      const y = p0.y + t * (p1.y - p0.y);
      if (y >= searchFromY && y < best) best = y;
    }
    return best;
  }

  solidAt(x: number, y: number): boolean {
    if (this.points.length < 2) return false;
    const half = this.thickness / 2;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p0 = this.points[i]!;
      const p1 = this.points[i + 1]!;
      const xMin = Math.min(p0.x, p1.x);
      const xMax = Math.max(p0.x, p1.x);
      if (x < xMin - half || x > xMax + half) continue;
      const dx = p1.x - p0.x;
      const t = dx === 0 ? 0 : (x - p0.x) / dx;
      const yAt = p0.y + t * (p1.y - p0.y);
      if (Math.abs(y - yAt) <= half) return true;
    }
    return false;
  }
}
