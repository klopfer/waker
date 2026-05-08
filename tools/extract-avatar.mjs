#!/usr/bin/env node
/* eslint-disable */
// Extracts the avatar's per-state animations from SWFs into sprite-sheet PNGs
// under src/assets/sprites/avatar/, plus a manifest.json the engine can load.
//
// idle / walk / run all come from avatarSheet.swf — we pin one DefineSprite
// each by ID. jumpup / jumpdown come from per-state SWFs in
// legacy/avatar-states/ and auto-pick the largest sprite. Left-facing variants
// are flipHorizontal aliases of the right-facing sheets — no duplicate files;
// the engine renders them with PIXI.Sprite.scale.x = -1 + anchor compensation.
//
// See "Lessons learned from the avatar extraction" in
// flash-to-html5-conversion-plan.md §15 for the rationale behind every choice
// here (why sprite mode beats frame mode, why we pin by sprite name, how to
// audit a new animation SWF, why uniform scale beats fixed width/height).

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
const PER_STATE_DIR = join(REPO_ROOT, 'legacy', 'avatar-states');
const AVATAR_SHEET = join(REPO_ROOT, 'legacy', 'src', 'story', 'sprite', 'avatarSheet.swf');
const OUT_DIR = join(REPO_ROOT, 'src', 'assets', 'sprites', 'avatar');
const EXTRACT_ROOT = join(REPO_ROOT, 'src', 'assets', '_extracted', 'avatar-states');

const FFDEC_PATH = process.env.FFDEC_PATH ?? 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'C:\\ffmpeg\\bin\\ffmpeg.exe';

// Right-facing base states. Left-facing variants are produced as flipHorizontal
// aliases (no separate file; engine sets PIXI.Sprite.scale.x = -1 at render).
//
// idle/walk/run share avatarSheet.swf because its DefineSprites have the
// tightest character bounds with transparent backgrounds. The audit showed:
//   DefineSprite_153  208 frames  236x157  -> idle
//   DefineSprite_38    44 frames  302x115  -> walk
//   DefineSprite_176   10 frames  333x268  -> run
//
// jumpup/jumpdown stay on the per-state SWFs (avatarSheet doesn't have
// dedicated jump sprites — it composes them from the multi-pose static
// frames).
const STATES = {
  'idle-right':     { swf: AVATAR_SHEET, spriteName: 'DefineSprite_153' },
  'walk-right':     { swf: AVATAR_SHEET, spriteName: 'DefineSprite_38'  },
  'run-right':      { swf: AVATAR_SHEET, spriteName: 'DefineSprite_176' },
  'jumpup-right':   { swf: join(PER_STATE_DIR, 'jumpup-right.swf'),   spriteName: null },
  'jumpdown-right': { swf: join(PER_STATE_DIR, 'jumpdown-right.swf'), spriteName: null },
};

const FLIPS = {
  'idle-left':     'idle-right',
  'walk-left':     'walk-right',
  'run-left':      'run-right',
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
  if (!existsSync(cfg.swf)) {
    console.warn(`  ! source not found: ${cfg.swf}`);
    return null;
  }
  const stateExtractDir = join(EXTRACT_ROOT, state);
  if (existsSync(stateExtractDir)) rmSync(stateExtractDir, { recursive: true, force: true });
  mkdirSync(stateExtractDir, { recursive: true });

  // Always sprite mode: tight bounds, transparent backgrounds.
  const r = runJpexs(['-format', 'sprite:png', '-export', 'sprite', stateExtractDir, cfg.swf]);
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
    .filter((d) => d.count > 0);
  if (dirs.length === 0) {
    console.warn('  ! no non-empty sprite folders');
    return null;
  }

  let chosen;
  if (cfg.spriteName) {
    chosen = dirs.find((d) => d.name === cfg.spriteName || d.name.startsWith(cfg.spriteName));
    if (!chosen) {
      console.warn(
        `  ! sprite "${cfg.spriteName}" not found. Available: ${dirs.map((d) => d.name).join(', ')}`,
      );
      return null;
    }
    console.log(`  picked sprite ${chosen.name} (${chosen.count} frames)`);
  } else {
    chosen = dirs.sort((a, b) => b.count - a.count)[0];
    console.log(`  auto-picked largest sprite ${chosen.name} (${chosen.count} frames)`);
  }

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
  if (!existsSync(AVATAR_SHEET)) throw new Error(`avatarSheet.swf not found at ${AVATAR_SHEET}`);
  if (!existsSync(PER_STATE_DIR)) throw new Error(`per-state dir not found at ${PER_STATE_DIR}`);
}

function main() {
  ensureBins();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(EXTRACT_ROOT, { recursive: true });

  console.log(`Sheet:   ${toPosix(relative(REPO_ROOT, AVATAR_SHEET))}`);
  console.log(`Per-state SWFs: ${toPosix(relative(REPO_ROOT, PER_STATE_DIR))}`);
  console.log(`Output:  ${toPosix(relative(REPO_ROOT, OUT_DIR))}\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    states: {},
  };

  const stateNames = Object.keys(STATES);
  for (let i = 0; i < stateNames.length; i++) {
    const name = stateNames[i];
    const cfg = STATES[name];
    const tag = cfg.spriteName ? `pin=${cfg.spriteName}` : 'auto-pick';
    console.log(`[${i + 1}/${stateNames.length}] ${name}  ${tag}`);

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
