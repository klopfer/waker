import type { GroundProvider } from './Movements.js';

/**
 * Combines several GroundProviders into one. groundYBelow returns the
 * minimum y across all layers (closest floor below the search start);
 * solidAt is true if any layer reports solid.
 *
 * Layers can be added or removed at runtime — used to drop a solidified
 * graph-curve into the level's ground stack when the player releases an orb.
 */
export class CompositeGround implements GroundProvider {
  private readonly layers: GroundProvider[] = [];

  add(layer: GroundProvider): void {
    if (!this.layers.includes(layer)) this.layers.push(layer);
  }

  remove(layer: GroundProvider): void {
    const i = this.layers.indexOf(layer);
    if (i !== -1) this.layers.splice(i, 1);
  }

  has(layer: GroundProvider): boolean {
    return this.layers.includes(layer);
  }

  groundYBelow(x: number, searchFromY: number): number {
    let best = Number.POSITIVE_INFINITY;
    for (const layer of this.layers) {
      const y = layer.groundYBelow(x, searchFromY);
      if (y < best) best = y;
    }
    return best;
  }

  solidAt(x: number, y: number): boolean {
    for (const layer of this.layers) if (layer.solidAt(x, y)) return true;
    return false;
  }
}
