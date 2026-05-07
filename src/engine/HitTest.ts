import { aabbIntersection, aabbOverlap, type AABB } from './types.js';

export interface PixelMask {
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface PixelHittable {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  mask?: PixelMask;
}

export function hittableBounds(h: PixelHittable): AABB {
  return { x: h.worldX, y: h.worldY, width: h.width, height: h.height };
}

export function pixelsOverlap(a: PixelHittable, b: PixelHittable): boolean {
  const ab = hittableBounds(a);
  const bb = hittableBounds(b);
  if (!aabbOverlap(ab, bb)) return false;

  const inter = aabbIntersection(ab, bb);
  if (inter.width <= 0 || inter.height <= 0) return false;

  if (!a.mask && !b.mask) return true;
  if (a.mask && b.mask) return doubleAlphaScan(a, b, inter);
  return singleAlphaScan(a.mask ? a : b, inter);
}

function singleAlphaScan(h: PixelHittable, inter: AABB): boolean {
  const m = h.mask;
  if (!m) return true;
  const sx = Math.floor(inter.x - h.worldX);
  const sy = Math.floor(inter.y - h.worldY);
  const ex = Math.min(m.width, sx + Math.ceil(inter.width));
  const ey = Math.min(m.height, sy + Math.ceil(inter.height));
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  for (let y = y0; y < ey; y++) {
    const rowStart = y * m.width;
    for (let x = x0; x < ex; x++) {
      if ((m.alpha[rowStart + x] ?? 0) > 0) return true;
    }
  }
  return false;
}

function doubleAlphaScan(a: PixelHittable, b: PixelHittable, inter: AABB): boolean {
  const ma = a.mask!;
  const mb = b.mask!;
  const aOffX = Math.floor(inter.x - a.worldX);
  const aOffY = Math.floor(inter.y - a.worldY);
  const bOffX = Math.floor(inter.x - b.worldX);
  const bOffY = Math.floor(inter.y - b.worldY);
  const w = Math.ceil(inter.width);
  const ht = Math.ceil(inter.height);
  for (let dy = 0; dy < ht; dy++) {
    const ay = aOffY + dy;
    const by = bOffY + dy;
    if (ay < 0 || ay >= ma.height || by < 0 || by >= mb.height) continue;
    const aRow = ay * ma.width;
    const bRow = by * mb.width;
    for (let dx = 0; dx < w; dx++) {
      const ax = aOffX + dx;
      const bx = bOffX + dx;
      if (ax < 0 || ax >= ma.width || bx < 0 || bx >= mb.width) continue;
      if ((ma.alpha[aRow + ax] ?? 0) > 0 && (mb.alpha[bRow + bx] ?? 0) > 0) return true;
    }
  }
  return false;
}

export function bakeMaskFromImageData(data: ImageData): PixelMask {
  const len = data.width * data.height;
  const alpha = new Uint8ClampedArray(len);
  for (let i = 0, j = 3; i < len; i++, j += 4) {
    alpha[i] = data.data[j] ?? 0;
  }
  return { alpha, width: data.width, height: data.height };
}

export function bakeMaskFromImage(
  source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
): PixelMask {
  const w = 'naturalWidth' in source && source.naturalWidth ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source && source.naturalHeight ? source.naturalHeight : source.height;
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(source as CanvasImageSource, 0, 0);
  return bakeMaskFromImageData(ctx.getImageData(0, 0, w, h));
}
