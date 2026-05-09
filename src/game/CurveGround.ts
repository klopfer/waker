import type { GroundProvider } from './Movements.js';

export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * GroundProvider over a polyline curve in world space (the curve a player
 * draws by holding an activation orb). The curve has a thickness so it
 * renders as a 14-px-tall band around the polyline; collision queries
 * treat that band as the solid body.
 *
 * `groundYBelow` returns the TOP of the curve's solid body (the line y
 * minus thickness/2), NOT the line center. This is the conventional
 * "floor" definition: the avatar's feet land on the top edge of the
 * curve, not at its center, mirroring how `solidAt` reports the band
 * as solid in [line_y - thickness/2, line_y + thickness/2].
 *
 * Returning line center (without subtracting thickness/2) was the
 * pre-2026-05-09 behavior; that placed the avatar's feet at the line,
 * with body extending from feet UP through 35 px — partially inside
 * the curve's solid band — which made side-collision samples overlap
 * the curve and produced the "slide-back / fall-through at slope
 * discontinuities" bug the user reported.
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
    const half = this.thickness / 2;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p0 = this.points[i]!;
      const p1 = this.points[i + 1]!;
      const xMin = Math.min(p0.x, p1.x);
      const xMax = Math.max(p0.x, p1.x);
      if (x < xMin || x > xMax) continue;
      const dx = p1.x - p0.x;
      const t = dx === 0 ? 0 : (x - p0.x) / dx;
      const yLine = p0.y + t * (p1.y - p0.y);
      const yTop = yLine - half;
      if (yTop >= searchFromY && yTop < best) best = yTop;
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
