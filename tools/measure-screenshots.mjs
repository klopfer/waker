// Measures avatar position + nearby platform-y in each reference screenshot
// by subtracting the bg+ground compositing from the screenshot. Pixels that
// differ markedly from the bg are the avatar / orb / drawn graph.
import { PNG } from 'pngjs';
import fs from 'node:fs';

const FILES = [
  'cloud1.png','cloud2.png','cloud3.png','cloud4.png',
  'ground.png','walking.png',
  'jump from left platform.png','jump straight up from below.png',
  'graph low point.png',
];

const SCALE = 1.4675;
const w2 = (p) => Math.round(p / SCALE);

// Load bg + ground compositing as a single 800x600 reference image.
const bg = PNG.sync.read(fs.readFileSync('src/assets/background/levelTD_bg.png'));
const gnd = PNG.sync.read(fs.readFileSync('src/assets/collision/levelTD_ground.png'));

// Sample bg+ground at a given (worldX, worldY): if ground alpha > 16, it's
// near-black (the platform), else use bg.
function bgGroundColor(worldX, worldY) {
  const x = Math.max(0, Math.min(799, Math.round(worldX)));
  const y = Math.max(0, Math.min(599, Math.round(worldY)));
  const gi = (y * 800 + x) * 4;
  if (gnd.data[gi + 3] > 16) {
    return [gnd.data[gi], gnd.data[gi + 1], gnd.data[gi + 2]];
  }
  const bi = (y * 800 + x) * 4;
  return [bg.data[bi], bg.data[bi + 1], bg.data[bi + 2]];
}

// Find avatar by scanning the screenshot and computing per-pixel delta from
// the bg. Cluster the densest blob of large-delta pixels and return its
// bbox + centroid.
function findAvatarByDiff(png) {
  const w = png.width, h = png.height, d = png.data;
  // Bin the screenshot into 8x8 blocks and count high-delta pixels per block.
  const BLOCK = 8;
  const cols = Math.ceil(w / BLOCK), rows = Math.ceil(h / BLOCK);
  const count = new Int32Array(cols * rows);
  for (let y = 0; y < h - 80; y++) {
    const wy = y / SCALE;
    for (let x = 0; x < w; x++) {
      const wx = x / SCALE;
      const [br, bg_, bb] = bgGroundColor(wx, wy);
      const i = (y * w + x) * 4;
      const dr = d[i] - br, dg = d[i+1] - bg_, db = d[i+2] - bb;
      const delta = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
      if (delta > 100) {
        const cx = Math.floor(x / BLOCK), cy = Math.floor(y / BLOCK);
        count[cy * cols + cx]++;
      }
    }
  }
  // Find connected components of "hot" blocks (count > 6 = at least 6 of 64
  // pixels in the block are clearly non-bg).
  const visited = new Uint8Array(count.length);
  let bestBlob = null;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx;
      if (visited[idx] || count[idx] < 6) continue;
      const queue = [[cx, cy]];
      const blob = [];
      while (queue.length) {
        const [bx, by] = queue.shift();
        const k = by * cols + bx;
        if (visited[k]) continue;
        visited[k] = 1;
        if (count[k] < 4) continue;
        blob.push({ cx: bx, cy: by, n: count[k] });
        for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = bx + ddx, ny = by + ddy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) queue.push([nx, ny]);
        }
      }
      if (blob.length === 0) continue;
      // Score by total non-bg pixels
      const total = blob.reduce((s, b) => s + b.n, 0);
      if (!bestBlob || total > bestBlob.total) {
        let minX = w, maxX = 0, minY = h, maxY = 0;
        for (const b of blob) {
          const px = b.cx * BLOCK, py = b.cy * BLOCK;
          if (px < minX) minX = px; if (px + BLOCK > maxX) maxX = px + BLOCK;
          if (py < minY) minY = py; if (py + BLOCK > maxY) maxY = py + BLOCK;
        }
        bestBlob = { total, minX, maxX, minY, maxY };
      }
    }
  }
  return bestBlob;
}

console.log('file                              | screenshot bbox L R T B    | size hxw  | feetY | world(feet, h, w)');
console.log('-'.repeat(140));
for (const f of FILES) {
  const png = PNG.sync.read(fs.readFileSync(`legacy/screenshots/${f}`));
  const blob = findAvatarByDiff(png);
  if (!blob) { console.log(f.padEnd(34), 'no avatar'); continue; }
  const ah = blob.maxY - blob.minY, aw = blob.maxX - blob.minX;
  console.log(
    f.padEnd(34),
    `| L=${String(blob.minX).padStart(4)} R=${String(blob.maxX).padStart(4)} T=${String(blob.minY).padStart(4)} B=${String(blob.maxY).padStart(4)}`,
    `| ${String(ah).padStart(3)}h ${String(aw).padStart(3)}w`,
    `| ${String(blob.maxY).padStart(4)}`,
    `| world: feet=${w2(blob.maxY)} top=${w2(blob.minY)} h=${w2(ah)} w=${w2(aw)} cx=${w2(Math.round((blob.minX + blob.maxX)/2))}`
  );
}
