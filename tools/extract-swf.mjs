#!/usr/bin/env node
/* eslint-disable */
// Extracts assets from every SWF under legacy/src/story/** using JPEXS Free Flash Decompiler
// (ffdec-cli.exe). Writes outputs under src/assets/_extracted/<relpath>/ and emits a typed
// src/assets/manifest.json mapping the legacy source path to its produced files.
//
// Usage:
//   node tools/extract-swf.mjs [--limit N] [--only <glob-substring>] [--dry-run]
//
// Override the JPEXS path with FFDEC_PATH env var. Default is the standard install location.

import { spawnSync } from 'node:child_process';
import {
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, dirname, basename, extname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(REPO_ROOT, 'legacy', 'src', 'story');
const OUT_DIR = join(REPO_ROOT, 'src', 'assets');
const EXTRACT_ROOT = join(OUT_DIR, '_extracted');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');

const FFDEC_PATH = process.env.FFDEC_PATH ?? 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { limit: Infinity, only: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--only') out.only = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: extract-swf.mjs [--limit N] [--only <substring>] [--dry-run]');
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

function findSwfs(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && name.toLowerCase().endsWith('.swf')) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

/**
 * Classify by source path; informs which JPEXS extraction modes to invoke.
 * @returns {'audio' | 'cutscene' | 'background' | 'sprite'}
 */
function classify(relPath) {
  const p = toPosix(relPath).toLowerCase();
  if (
    p.startsWith('bgm/') ||
    p.endsWith('/player_sprint.swf') ||
    p.endsWith('/player_walk.swf') ||
    p === 'sfx/graph/graph_draw.swf'
  ) {
    return 'audio';
  }
  if (p.startsWith('cutscenes/')) return 'cutscene';
  if (p.startsWith('background/')) return 'background';
  return 'sprite';
}

/** Run ffdec-cli with the given args; return stdout/stderr/exit. */
function runJpexs(jpexsArgs) {
  const r = spawnSync(FFDEC_PATH, jpexsArgs, {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error,
  };
}

function listOutputs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function classifyOutputType(outputs) {
  const exts = new Set(outputs.map((o) => extname(o).toLowerCase()));
  if (exts.has('.mp3') || exts.has('.wav') || exts.has('.flac')) return 'audio';
  const images = outputs.filter((o) => /\.(png|jpe?g|gif)$/i.test(o));
  if (images.length === 0) return 'unknown';
  if (images.length === 1) return 'image';
  if (images.length <= 30) return 'spritesheet';
  return 'sequence';
}

function ensureFfdec() {
  if (!existsSync(FFDEC_PATH)) {
    throw new Error(
      `JPEXS CLI not found at ${FFDEC_PATH}. Set FFDEC_PATH env var to the full path of ffdec-cli.exe.`,
    );
  }
}

function processSwf(swfFull, idx, total) {
  const rel = relative(SOURCE_DIR, swfFull);
  const relPosix = toPosix(rel);
  const klass = classify(rel);
  const outDir = join(EXTRACT_ROOT, rel.replace(/\.swf$/i, ''));

  console.log(
    `[${String(idx + 1).padStart(3)}/${total}] ${klass.padEnd(10)} ${relPosix}`,
  );

  if (args.dryRun) {
    return { source: relPosix, classGuess: klass, outputs: [], outputType: 'dry-run' };
  }

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const exportTypes = klass === 'audio' ? 'sound' : 'frame,image,sound';

  const r = runJpexs(['-export', exportTypes, outDir, swfFull]);
  if (r.error) {
    console.warn(`  ! spawn error: ${r.error.message}`);
  }
  if (r.status !== 0 && r.status !== null) {
    console.warn(`  ! exit ${r.status}; stderr head: ${r.stderr.slice(0, 200)}`);
  }

  const outputs = listOutputs(outDir).map((p) => toPosix(relative(OUT_DIR, p)));
  const outputType = classifyOutputType(outputs);

  if (outputs.length === 0) {
    console.warn(`  ! no outputs produced for ${relPosix}`);
  }

  return { source: relPosix, classGuess: klass, outputs, outputType };
}

function main() {
  ensureFfdec();

  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`Source dir not found: ${SOURCE_DIR}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(EXTRACT_ROOT, { recursive: true });

  let swfs = findSwfs(SOURCE_DIR);
  if (args.only) {
    const needle = args.only.toLowerCase();
    swfs = swfs.filter((p) => toPosix(p).toLowerCase().includes(needle));
  }
  if (Number.isFinite(args.limit)) swfs = swfs.slice(0, args.limit);

  console.log(
    `Found ${swfs.length} SWF(s) under ${toPosix(relative(REPO_ROOT, SOURCE_DIR))}` +
      (args.dryRun ? '  [dry-run, no extraction]' : ''),
  );
  if (!args.dryRun) console.log(`Using JPEXS at: ${FFDEC_PATH}`);

  const entries = [];
  for (let i = 0; i < swfs.length; i++) {
    entries.push(processSwf(swfs[i], i, swfs.length));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRoot: toPosix(relative(REPO_ROOT, SOURCE_DIR)),
    outputRoot: toPosix(relative(REPO_ROOT, OUT_DIR)),
    jpexsPath: args.dryRun ? null : FFDEC_PATH,
    entries,
  };

  if (!args.dryRun) {
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\nWrote ${toPosix(relative(REPO_ROOT, MANIFEST_PATH))}`);
  }

  // Summary
  const counts = entries.reduce((acc, e) => {
    acc[e.outputType] = (acc[e.outputType] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nOutput type summary:');
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
}

main();
