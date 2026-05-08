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

/**
 * @typedef {(r: number, g: number, b: number) => boolean} PixelPredicate
 *
 * Extra "kill this pixel" predicate that runs IN ADDITION to the
 * sentinel-distance check. Used when the antialiased ramp around the
 * sentinel reaches into territory that overlaps with the GLYPH's
 * Manhattan distance from the sentinel. (Origin: pure-black glyph is
 * Manhattan-51 from sentinel; antialiased ramp reaches ~50, so widening
 * tolerance can't separate them — we have to discriminate by direction.)
 */

/** Origin's halo is on the blue axis. Any opaque pixel where blue
 *  dominates by 2× over either of R/G AND blue is > 20 is on the
 *  sentinel ramp, never on the pure-black glyph (which has B=0). */
const BLUE_RAMP = (r, g, b) => b > 20 && b > 2 * Math.max(r, g);

/** @type {Array<{file: string, key: [number, number, number], tolerance?: number, predicate?: PixelPredicate, label: string}>} */
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
    // Origin: sentinel #000033 + pure-black glyph #000000 lie on the same
    // blue axis only 51 Manhattan-units apart. Antialiased ramp pixels
    // (e.g. #0a103e, #0c1340, #1019…) sit between them. Tolerance alone
    // can't separate "halo edge" from "glyph edge" — they overlap. So we
    // also kill any "blue-dominant" pixel via BLUE_RAMP, which preserves
    // pure black (B=0) but eats the entire blue ramp.
    file: 'src/assets/graph/displacementOrb/origin.png',
    key: [0x00, 0x00, 0x33],
    tolerance: 35,
    predicate: BLUE_RAMP,
    label: 'displacement origin (stand)',
  },
];

const DEFAULT_TOLERANCE = 20; // Manhattan RGB distance

function processPng({ file, key, tolerance = DEFAULT_TOLERANCE, predicate, label }) {
  return new Promise((resolve, reject) => {
    const full = join(REPO_ROOT, file);
    fs.createReadStream(full)
      .pipe(new PNG())
      .on('parsed', function () {
        let keyed = 0;
        const data = this.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue; // already keyed (idempotent)
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const dr = Math.abs(r - key[0]);
          const dg = Math.abs(g - key[1]);
          const db = Math.abs(b - key[2]);
          const bySentinel = dr + dg + db <= tolerance;
          const byPredicate = predicate ? predicate(r, g, b) : false;
          if (bySentinel || byPredicate) {
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
