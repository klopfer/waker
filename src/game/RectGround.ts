import type { GroundProvider } from './Movements.js';

/**
 * AABB-shaped `GroundProvider`. Mutable position so a moving platform can
 * update its location each tick and the avatar's physics will see the new
 * AABB on the next ground query. All four sides are solid:
 *   - groundYBelow → top y if the column passes through the rect
 *   - solidAt → true for any point strictly inside the rect
 *
 * Side / head collisions in `Movements.ts` work through `solidAt`, so a
 * RectGround correctly blocks the avatar from walking through the
 * platform's sides or jumping through its bottom.
 */
export class RectGround implements GroundProvider {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  groundYBelow(x: number, searchFromY: number): number {
    if (x < this.x || x >= this.x + this.w) return Number.POSITIVE_INFINITY;
    return this.y >= searchFromY ? this.y : Number.POSITIVE_INFINITY;
  }

  solidAt(x: number, y: number): boolean {
    return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h;
  }

  /** True if another AABB overlaps this rect (strict-less semantics, edge-touch = no overlap). */
  overlapsBox(bx: number, by: number, bw: number, bh: number): boolean {
    return bx < this.x + this.w && bx + bw > this.x && by < this.y + this.h && by + bh > this.y;
  }
}
