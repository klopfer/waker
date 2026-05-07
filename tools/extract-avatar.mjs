#!/usr/bin/env node
/* eslint-disable */
// Extracts the avatar's per-state animations from the SWFs in legacy/avatar-states/,
// composites each into a sprite-sheet PNG under src/assets/sprites/avatar/, and
// writes a manifest.json so the engine can load them.
//
// State strategy (verified against the SWFs by audit):
//   idle-left/right   : sprite mode  (animation lives inside a DefineSprite)
//   run-right         : frame mode   (10-frame composited main timeline)
//   walk-right        : frame mode   (44-frame composited main timeline)
//   jumpup-right      : sprite mode  (short loop in DefineSprite)
//   jumpdown-right    : sprite mode  (short loop in DefineSprite)
//
// Left-facing variants of run/walk/jump are produced as flipHorizontal references
// (no extra files; the engine flips with PIXI.Sprite.scale.x = -1).

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(REPO_ROOT, 'legacy', 'avatar-states');
const OUT_DIR = join(REPO_ROOT, 'src', 'assets', 'sprites', 'avatar');
const EXTRACT_ROOT = join(REPO_ROOT, 'src', 'assets', '_extracted', 'avatar-states');

const FFDEC_PATH = process.env.FFDEC_PATH ?? 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'C:\\ffmpeg\\bin\\ffmpeg.exe';

const STATES = {
  'idle-left':      { swf: 'idle-left.swf',      mode: 'sprite' },
  'idle-right':     { swf: 'idle-right.swf',     mode: 'sprite' },
  'run-right':      { swf: 'run-right.swf',      mode: 'frame'  },
  'walk-right':     { swf: 'walk-right.swf',     mode: 'frame'  },
  'jumpup-right':   { swf: 'jumpup-right.swf',   mode: 'sprite' },
  'jumpdown-right': { swf: 'jumpdown-right.swf', mode: 'sprite' },
};

const FLIPS = {
  'run-left':      'run-right',
  'walk-left':     'walk-right',
  'jumpup-left':   'jumpup-right',
  'jumpdown-left': 'jumpdown-right',
};

const toPosix = (p) => p.split(sep).join(posix.sep);

function runJpexs(args) {
  return spawnSync(FFDEC_PATH, args, { encoding: 'utf-8', windowsHide: true });
}

function listPngs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^\d+\.png$/i.test(n));
}

function readPngDims(path) {
  const b = readFileSync(path);
  return {
    w: b[16] * 16777216 + b[17] * 65536 + b[18] * 256 + b[19],
    h: b[20] * 16777216 + b[21] * 65536 + b[22] * 256 + b[23],
  };
}

function extractFrames(state, cfg) {
  const swfFull = join(SOURCE_DIR, cfg.swf);
  if (!existsSync(swfFull)) {
    console.warn(`  ! source not found: ${swfFull}`);
    return null;
  }
  const stateExtractDir = join(EXTRACT_ROOT, state);
  if (existsSync(stateExtractDir)) rmSync(stateExtractDir, { recursive: true, force: true });
  mkdirSync(stateExtractDir, { recursive: true });

  if (cfg.mode === 'frame') {
    const r = runJpexs(['-format', 'frame:png', '-export', 'frame', stateExtractDir, swfFull]);
    if (r.status !== 0 && r.status !== null) {
      console.warn(`  ! JPEXS frame export exit ${r.status}: ${r.stderr.slice(0, 300)}`);
      return null;
    }
    const frames = listPngs(stateExtractDir).sort((a, b) => parseInt(a) - parseInt(b));
    if (frames.length === 0) {
      console.warn('  ! no frames produced');
      return null;
    }
    return { dir: stateExtractDir, frames };
  }

  // sprite mode: pick the largest non-empty sprite folder
  const r = runJpexs(['-format', 'sprite:png', '-export', 'sprite', stateExtractDir, swfFull]);
  if (r.status !== 0 && r.status !== null) {
    console.warn(`  ! JPEXS sprite export exit ${r.status}: ${r.stderr.slice(0, 300)}`);
    return null;
  }
  const dirs = readdirSync(stateExtractDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const path = join(stateExtractDir, d.name);
      return { name: d.name, path, count: listPngs(path).length };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  if (dirs.length === 0) {
    console.warn('  ! no non-empty sprite folders');
    return null;
  }
  const chosen = dirs[0];
  console.log(`  picked sprite ${chosen.name} (${chosen.count} frames)`);
  const frames = listPngs(chosen.path).sort((a, b) => parseInt(a) - parseInt(b));
  return { dir: chosen.path, frames };
}

function packSheet(state, framesDir, frames) {
  const firstPath = join(framesDir, frames[0]);
  const dims = readPngDims(firstPath);
  const cols = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / cols);
  const sheetPath = join(OUT_DIR, `${state}.png`);

  const r = spawnSync(
    FFMPEG_PATH,
    [
      '-y',
      '-loglevel', 'error',
      '-i', join(framesDir, '%d.png'),
      '-vf', `tile=${cols}x${rows}:padding=0:margin=0`,
      '-frames:v', '1',
      '-update', '1',
      sheetPath,
    ],
    { encoding: 'utf-8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );

  if (r.status !== 0 && r.status !== null) {
    console.warn(`  ! ffmpeg exit ${r.status}: ${r.stderr.slice(-300)}`);
    return null;
  }

  return {
    sheet: toPosix(relative(OUT_DIR, sheetPath)),
    frameCount: frames.length,
    frameWidth: dims.w,
    frameHeight: dims.h,
    cols,
    rows,
    sheetWidth: dims.w * cols,
    sheetHeight: dims.h * rows,
  };
}

function ensureBins() {
  if (!existsSync(FFDEC_PATH)) throw new Error(`JPEXS not found at ${FFDEC_PATH}`);
  if (!existsSync(FFMPEG_PATH)) throw new Error(`ffmpeg not found at ${FFMPEG_PATH}`);
  if (!existsSync(SOURCE_DIR)) throw new Error(`Source dir not found: ${SOURCE_DIR}`);
}

function main() {
  ensureBins();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(EXTRACT_ROOT, { recursive: true });

  console.log(`Source:  ${toPosix(relative(REPO_ROOT, SOURCE_DIR))}`);
  console.log(`Output:  ${toPosix(relative(REPO_ROOT, OUT_DIR))}\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    states: {},
  };

  const stateNames = Object.keys(STATES);
  for (let i = 0; i < stateNames.length; i++) {
    const name = stateNames[i];
    const cfg = STATES[name];
    console.log(`[${i + 1}/${stateNames.length}] ${name}  (${cfg.mode} mode)`);

    const extracted = extractFrames(name, cfg);
    if (!extracted) continue;
    const packed = packSheet(name, extracted.dir, extracted.frames);
    if (!packed) continue;

    manifest.states[name] = packed;
    console.log(
      `  → ${packed.sheet}  ${packed.frameCount}f  ${packed.frameWidth}x${packed.frameHeight}  grid ${packed.cols}x${packed.rows}  sheet ${packed.sheetWidth}x${packed.sheetHeight}`,
    );
  }

  for (const [variant, source] of Object.entries(FLIPS)) {
    if (manifest.states[source]) {
      manifest.states[variant] = { ...manifest.states[source], flipHorizontal: true };
      console.log(`  ${variant} = ${source} (flipHorizontal)`);
    }
  }

  const manifestPath = join(OUT_DIR, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${toPosix(relative(REPO_ROOT, manifestPath))}`);
  console.log(`States: ${Object.keys(manifest.states).join(', ')}`);
}

main();
