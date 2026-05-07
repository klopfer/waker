#!/usr/bin/env node
/* eslint-disable */
// Curates the final asset tree under src/assets/ from a mix of:
//   - direct copies from legacy/src/story/ (anything already .mp3 / .png / .jpg)
//   - JPEXS-extracted outputs in src/assets/_extracted/ (PNG / MP3 from .swf)
//   - already-built outputs (cutscene MP4s, avatar sprite sheets) — left untouched
//
// Authoritative source of truth: parses [Embed(source="..." [, symbol="..."])]
// declarations out of legacy/src/AssetManager.as. Every embed gets one entry in
// src/assets/manifest.json keyed by the AS3 const name (e.g. "bgmWorld1").
//
// Run order assumes:
//   1. npm run extract:swf        (populates _extracted/)
//   2. npm run extract:cutscenes  (writes cutscenes/*.mp4)
//   3. npm run extract:avatar     (writes sprites/avatar/*.png)
//   4. npm run curate             (this script — pulls everything together)

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_MANAGER = join(REPO_ROOT, 'legacy', 'src', 'AssetManager.as');
const LEGACY_STORY = join(REPO_ROOT, 'legacy', 'src', 'story');
const EXTRACTED = join(REPO_ROOT, 'src', 'assets', '_extracted');
const OUT = join(REPO_ROOT, 'src', 'assets');
const MANIFEST_PATH = join(OUT, 'manifest.json');

const toPosix = (p) => p.split(sep).join(posix.sep);

// --------------------------------------------------------------------------
// 1. parse AssetManager.as — produce { embedName, source, symbol } for each Embed
// --------------------------------------------------------------------------

function parseAssetManager() {
  const text = readFileSync(ASSET_MANAGER, 'utf-8');
  // strip multi-line comments and // line comments to keep the regex simple
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const re =
    /\[Embed\s*\(\s*([^)]*?)\s*\)\s*\][^\[]*?public\s+static\s+const\s+(\w+)\s*:\s*Class/g;
  const out = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const params = m[1];
    const name = m[2];
    const sourceMatch = /source\s*=\s*"([^"]+)"/.exec(params);
    const symbolMatch = /symbol\s*=\s*"([^"]+)"/.exec(params);
    if (!sourceMatch) continue;
    const src = sourceMatch[1].replace(/^\/?story\//, '');
    out.push({ embedName: name, source: src, symbol: symbolMatch?.[1] ?? null });
  }
  return out;
}

// --------------------------------------------------------------------------
// 2. routing: legacy embed source -> destination under src/assets/, plus how
//    to find the actual byte source (legacy direct copy or extracted output).
// --------------------------------------------------------------------------

const ALREADY_BUILT = new Set([
  'introCutScene',
  'endingCutSceneClass',
  'levelCompleteClass',
  'levelCompleteCutSceneClass',
]);

const PREBUILT_OVERRIDES = {
  introCutScene:               { url: 'cutscenes/intro.mp4',           type: 'video' },
  endingCutSceneClass:         { url: 'cutscenes/ending.mp4',          type: 'video' },
  levelCompleteClass:          { url: 'cutscenes/levelcomplete.mp4',   type: 'video' },
  levelCompleteCutSceneClass:  { url: 'cutscenes/levelcomplete-cs.mp4',type: 'video' },
};

const EXT_LOOKUP = {
  '.mp3': 'audio',
  '.wav': 'audio',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.mp4': 'video',
};

function classifyDest(source) {
  // returns { dst, type } where dst is relative to src/assets/
  // Strategy: keep the legacy source path verbatim under src/assets/, with a
  // few small renames for SWFs that become PNGs/MP3s.
  const ext = extname(source).toLowerCase();
  let dst = source;
  if (ext === '.swf') {
    // Decide whether this SWF becomes audio or image after extraction
    const audioPaths = [
      /^bgm\//i,
      /^sfx\/graph\/graph_draw\.swf$/i,
      /^sfx\/player\/player_sprint\.swf$/i,
      /^sfx\/player\/player_walk\.swf$/i,
    ];
    const isAudio = audioPaths.some((re) => re.test(source));
    dst = source.replace(/\.swf$/i, isAudio ? '.mp3' : '.png');
  }
  return { dst, type: EXT_LOOKUP[extname(dst).toLowerCase()] ?? 'unknown' };
}

function findExtractedSource(source) {
  // For a legacy SWF, find the right extracted output file under _extracted/
  const baseDir = join(EXTRACTED, source.replace(/\.swf$/i, ''));
  if (!existsSync(baseDir)) return null;

  // Prefer audio (MP3) when present, regardless of classification.
  // For SWFs extracted in audio-only mode (`-export sound`), MP3s land directly
  // in baseDir; for SWFs extracted in mixed mode, they're in baseDir/sounds/.
  const directMp3s = readdirSync(baseDir).filter((n) => n.toLowerCase().endsWith('.mp3'));
  if (directMp3s.length > 0) {
    return join(baseDir, directMp3s.sort()[0]);
  }
  const soundsDir = join(baseDir, 'sounds');
  if (existsSync(soundsDir)) {
    const mp3s = readdirSync(soundsDir).filter((n) => n.toLowerCase().endsWith('.mp3'));
    if (mp3s.length > 0) {
      return join(soundsDir, mp3s.sort()[0]);
    }
  }

  // For images: prefer frames/1.png, else images/<smallest> as a fallback
  const framesDir = join(baseDir, 'frames');
  if (existsSync(framesDir)) {
    const frames = readdirSync(framesDir).filter((n) => /\.png$/i.test(n));
    if (frames.length > 0) {
      // For multi-frame "sequence" outputs (gambitLogo etc.) take the LAST frame
      // so we get the fully-faded-in / final pose for static use.
      const sorted = frames.sort((a, b) => parseInt(a) - parseInt(b));
      const pick = sorted[sorted.length - 1];
      return join(framesDir, pick);
    }
  }

  const imagesDir = join(baseDir, 'images');
  if (existsSync(imagesDir)) {
    const files = readdirSync(imagesDir).filter((n) => /\.(png|jpg|jpeg)$/i.test(n));
    if (files.length > 0) {
      // Pick the largest — typically the actual rendered art rather than a
      // tiny embedded UI element.
      const withSize = files
        .map((n) => ({ n, size: statSync(join(imagesDir, n)).size }))
        .sort((a, b) => b.size - a.size);
      return join(imagesDir, withSize[0].n);
    }
  }

  return null;
}

function findLegacySource(source) {
  const p = join(LEGACY_STORY, source);
  return existsSync(p) ? p : null;
}

// --------------------------------------------------------------------------
// 3. copy + manifest
// --------------------------------------------------------------------------

function copyOne(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

function purgeStaleAssets() {
  // Remove any previously-curated content so we don't accumulate stale files,
  // but preserve _extracted/ (intermediates), cutscenes/ (prebuilt), and
  // sprites/ (avatar sheets).
  const preserve = new Set(['_extracted', 'cutscenes', 'sprites', 'manifest.types.ts']);
  if (!existsSync(OUT)) return;
  for (const name of readdirSync(OUT)) {
    if (preserve.has(name)) continue;
    const full = join(OUT, name);
    rmSync(full, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(ASSET_MANAGER)) throw new Error(`Missing ${ASSET_MANAGER}`);
  if (!existsSync(EXTRACTED)) {
    throw new Error(`Missing ${EXTRACTED} — run \`npm run extract:swf\` first.`);
  }

  const embeds = parseAssetManager();
  console.log(`Parsed ${embeds.length} embeds from AssetManager.as.`);

  purgeStaleAssets();

  const manifestEntries = {};
  const skipped = [];
  const counts = { audio: 0, image: 0, video: 0, unknown: 0 };

  for (const e of embeds) {
    if (PREBUILT_OVERRIDES[e.embedName]) {
      const o = PREBUILT_OVERRIDES[e.embedName];
      manifestEntries[e.embedName] = { ...o, source: e.source, symbol: e.symbol };
      counts[o.type] = (counts[o.type] ?? 0) + 1;
      continue;
    }

    const { dst, type } = classifyDest(e.source);
    const dstFull = join(OUT, dst);

    let srcFull = null;
    const ext = extname(e.source).toLowerCase();

    if (ext === '.swf') {
      srcFull = findExtractedSource(e.source);
    } else {
      srcFull = findLegacySource(e.source);
    }

    if (!srcFull) {
      skipped.push({ embedName: e.embedName, source: e.source, reason: 'no source file found' });
      continue;
    }

    copyOne(srcFull, dstFull);
    manifestEntries[e.embedName] = {
      url: toPosix(dst),
      type,
      source: e.source,
      symbol: e.symbol,
    };
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    counts,
    skipped: skipped.length,
    skippedDetails: skipped,
    byEmbedName: manifestEntries,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  console.log(
    `\nCurated ${Object.keys(manifestEntries).length} entries:\n  ` +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join('  '),
  );
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  ${s.embedName.padEnd(28)}  ${s.source}  (${s.reason})`);
  }
  console.log(`\nWrote ${toPosix(relative(REPO_ROOT, MANIFEST_PATH))}`);
}

main();
