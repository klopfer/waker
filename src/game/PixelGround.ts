import type { GroundProvider } from './Movements.js';

const ALPHA_THRESHOLD = 128;

/**
 * Reads the alpha channel of a level's collision PNG and exposes the topmost
 * opaque-pixel y-coordinate per column as the ground level. Mirrors how the
 * legacy AS3 game treated the collision PNGs added to `level.collisionObjects`,
 * but specialized to a per-column lookup for the platforming case where we
 * just want "what's the floor under the avatar" rather than full pixel overlap.
 *
 * Out-of-bounds x columns and columns with no opaque pixel both return
 * +Infinity (no floor here — avatar would fall forever).
 */
export class PixelGround implements GroundProvider {
  readonly width: number;
  readonly height: number;
  private readonly columnTops: Float64Array;

  constructor(imageData: ImageData) {
    this.width = imageData.width;
    this.height = imageData.height;
    this.columnTops = new Float64Array(this.width);
    for (let x = 0; x < this.width; x++) this.columnTops[x] = Number.POSITIVE_INFINITY;

    const data = imageData.data;
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const alpha = data[(y * this.width + x) * 4 + 3] ?? 0;
        if (alpha > ALPHA_THRESHOLD) {
          this.columnTops[x] = y;
          break;
        }
      }
    }
  }

  groundYAt(x: number): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return Number.POSITIVE_INFINITY;
    return this.columnTops[ix] ?? Number.POSITIVE_INFINITY;
  }
}

export async function loadAlphaMask(url: string): Promise<ImageData> {
  return new Promise<ImageData>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
}

export async function loadPixelGround(url: string): Promise<PixelGround> {
  const data = await loadAlphaMask(url);
  return new PixelGround(data);
}
