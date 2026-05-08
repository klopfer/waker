#!/usr/bin/env node
/* eslint-disable */
// Some JPEXS-extracted SWF sprites have a uniform sentinel color filling the
// non-glyph area where the original Flash compositor treated that color as
// transparent. PNG extraction loses that — every pixel is opaque — so the
// "halo" reads on screen as a colored box around the actual glyph. This
// post-processes a known list of those PNGs in-place: any pixel within
// `tolerance` (Manhattan RGB distance) of the sentinel color gets alpha=0.
//
// Idempotent: re-running on a color-keyed PNG is a no-op for the keyed
// pixels (their alpha is already 0; the RGB check still matches but setting
// alpha=0 again changes nothing).

import fs from 'node:fs';
import { PNG } from 'pngjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {Array<{file: string, key: [number, number, number], tolerance?: number, label: string}>} */
const TARGETS = [
  {
    file: 'src/assets/graph/displacementOrb/justORB.png',
    key: [0x00, 0x33, 0x00],
    label: 'displacement orb core',
  },
  {
    file: 'src/assets/graph/displacementOrb/orbEFFECT.png',
    key: [0x00, 0x33, 0x00],
    label: 'displacement orb effect (orbiting triangles)',
  },
  {
    // Origin uses a wider tolerance because the antialiased edges of the
    // (partial-ring) glyph leave a few px of intermediate dark-blue values
    // that the strict-20 default left as a faint purple speckle.
    // 35 still won't touch the pure-black glyph (#000000 is dist 51 from
    // the sentinel).
    file: 'src/assets/graph/displacementOrb/origin.png',
    key: [0x00, 0x00, 0x33],
    tolerance: 35,
    label: 'displacement origin (stand)',
  },
];

const DEFAULT_TOLERANCE = 20; // Manhattan RGB distance

function processPng({ file, key, tolerance = DEFAULT_TOLERANCE, label }) {
  return new Promise((resolve, reject) => {
    const full = join(REPO_ROOT, file);
    fs.createReadStream(full)
      .pipe(new PNG())
      .on('parsed', function () {
        let keyed = 0;
        const data = this.data;
        for (let i = 0; i < data.length; i += 4) {
          const dr = Math.abs(data[i] - key[0]);
          const dg = Math.abs(data[i + 1] - key[1]);
          const db = Math.abs(data[i + 2] - key[2]);
          if (dr + dg + db <= tolerance) {
            data[i + 3] = 0;
            keyed++;
          }
        }
        const total = this.width * this.height;
        const pct = ((keyed / total) * 100).toFixed(1);
        const keyHex =
          '#' + key.map((v) => v.toString(16).padStart(2, '0')).join('');
        console.log(
          `  ${file.padEnd(50)}  key=${keyHex}  ${keyed}/${total} px keyed (${pct}%)  [${label}]`,
        );
        this.pack()
          .pipe(fs.createWriteStream(full))
          .on('finish', resolve)
          .on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('color-keying SWF-derived PNGs that have sentinel-color halos:');
  for (const t of TARGETS) await processPng(t);
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
