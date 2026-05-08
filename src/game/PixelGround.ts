import type { GroundProvider } from './Movements.js';

const ALPHA_THRESHOLD = 128;

/**
 * Reads the alpha channel of a level's collision PNG and exposes a per-column
 * "next opaque pixel y, at or below the search start y" lookup. Searching
 * downward (rather than always returning the topmost pixel) means the avatar
 * can walk *under* a higher platform — the column has an opaque pixel at the
 * platform's top, but if the avatar is below that y we want the floor below,
 * not the platform above.
 *
 * Out-of-bounds x and columns with no opaque pixel at or below `searchFromY`
 * both return +Infinity (no floor here — avatar would fall forever).
 */
export class PixelGround implements GroundProvider {
  readonly width: number;
  readonly height: number;
  private readonly alpha: Uint8ClampedArray;

  constructor(imageData: ImageData) {
    this.width = imageData.width;
    this.height = imageData.height;
    this.alpha = new Uint8ClampedArray(this.width * this.height);
    const data = imageData.data;
    for (let i = 0; i < this.alpha.length; i++) {
      this.alpha[i] = data[i * 4 + 3] ?? 0;
    }
  }

  groundYBelow(x: number, searchFromY: number): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return Number.POSITIVE_INFINITY;
    const startY = Math.max(0, Math.floor(searchFromY));
    for (let y = startY; y < this.height; y++) {
      if ((this.alpha[y * this.width + ix] ?? 0) > ALPHA_THRESHOLD) return y;
    }
    return Number.POSITIVE_INFINITY;
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
