# Waker

HTML5/TypeScript port of **Waker** (project codename *Woosh2*), an educational physics platformer originally built in Flash/Flex by [MIT Gambit Game Lab](https://gambit.mit.edu) circa 2008–2012. The player picks up "orbs" and *draws* velocity / displacement / mixed graphs whose curves solidify into platforms.

> **Status: early port.** Discovery and planning are complete. The foundation (Vite + PixiJS + engine leaves), the full asset pipeline (JPEXS → MP4/PNG/MP3 + curation), and the first visual milestone (the avatar walks across the canvas with idle/run state switching) are committed. See [`flash-to-html5-conversion-plan.md`](flash-to-html5-conversion-plan.md) for the full plan and phase-by-phase status.

---

## Directory layout

```
waker/
├── README.md                          ← you are here
├── CLAUDE.md                          ← per-session conventions for Claude Code
├── flash-to-html5-conversion-plan.md  ← authoritative plan + decisions log
│
├── legacy/                            ← original AS3/MXML game (read-only)
│   ├── src/                              original Flex source: 64 .as + 63 .mxml
│   │   ├── Woosh2.mxml                   app entry (splash → menu → game)
│   │   ├── game.mxml, level.mxml         main loop + level base class
│   │   ├── movements.mxml                hand-rolled physics + pixel collision
│   │   ├── avatar*.mxml                  player sprite + corner-aura masks
│   │   ├── genericGraph.mxml             orb activation + curve drawing
│   │   ├── soundManager.mxml             BGM/SFX/VO + Sonoflash GaverRingTone1
│   │   ├── AssetManager.as               ~250 [Embed] declarations
│   │   ├── levels/                       19 .mxml level subclasses
│   │   ├── GambitLib/HitTest.as          alpha-mask pixel collision
│   │   ├── gs/                           vendored Greensock TweenMax (AS3)
│   │   └── story/                        narrative-art assets (~15 MB)
│   ├── libs/GaverRingtone1_sf.swc        Sonoflash procedural-tone library
│   ├── reference/
│   │   ├── waker.swf                     canonical original build (12 MB)
│   │   └── woosh-abstract-build.swf      same code, alternate /abstract/ art set
│   ├── possible-fla-assets/              Adobe Animate authoring sources (FLAs)
│   └── legacy-extras/{abstract, levels_backup}/
│
├── src/                               ← TypeScript port (work in progress)
│   ├── main.ts                           Pixi bootstrap + 24 Hz sim driver
│   ├── style.css                         800×600 letterbox CSS
│   ├── engine/                           framework — agnostic of game logic
│   │   ├── types.ts                        Color, Settings, PairObject, AABB helpers
│   │   ├── FixedStep.ts                    24 Hz accumulator with maxSteps cap
│   │   ├── Input.ts                        keyboard tri-state (pressed/down/released)
│   │   ├── HitTest.ts                      port of GambitLib.HitTest (pixel-perfect)
│   │   ├── Audio.ts                        Howler wrapper for BGM/SFX/VO
│   │   └── GraphTone.ts                    single-OscillatorNode pitch-tracking tone
│   ├── game/                             gameplay (Avatar, Level, Graph, Switch, Spike, Orb)
│   ├── levels/                           one .ts per legacy level
│   ├── ui/                               HTML+CSS overlay (Menu, Options, HUD)
│   └── assets/                           extracted+curated assets (manifest.json)
│
├── tests/                             ← Vitest specs
│   ├── smoke.test.ts                     baseline jsdom test
│   └── engine/*.test.ts                  unit tests for engine modules
│
├── tools/
│   ├── extract-swf.mjs                   JPEXS-driven SWF → PNG/MP3/MP4 pipeline
│   └── extract-swf.log                   last extraction run log
│
├── index.html                          Pixi canvas + UI overlay root
├── package.json                        npm scripts
├── vite.config.ts                      Vite + Vitest config
├── tsconfig.json                       strict TS, ES2022
├── eslint.config.js                    flat ESLint config
└── .prettierrc.json
```

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 — placeholder scene with arrow-key control
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run lint         # eslint
npm run build        # tsc check + production bundle
npm run extract:swf  # JPEXS pass over legacy/src/story/*.swf (set FFDEC_PATH if non-default)
```

---

## Architecture

### Stack

| Concern | Choice | Why |
|---|---|---|
| Renderer | **PixiJS v8** | display-list metaphor matches `mx:Canvas` + `MovieClip` 1:1; WebGL/WebGPU performance |
| Audio (loops, SFX, VO) | **Howler.js** | format fallback, mobile unlock, sprite playback |
| Graph-drawing tone | **single Web Audio `OscillatorNode`** | original used the proprietary Sonoflash `GaverRingTone1` synth; the simplified spec is "pitch tracks line direction" — one oscillator suffices |
| Tweening | **GSAP 3** | drop-in mental model from the original Greensock TweenMax |
| Build / dev | **Vite** + Vitest + Playwright | fast HMR, jsdom-backed unit tests, Playwright reserved for visual regression |
| UI layer | **plain HTML + CSS** over the canvas | Flex MXML data-binding doesn't survive a port cleanly; rebuilding gives keyboard nav + responsive layout for free |

### Key decisions (from the plan, §12)

- **Fixed 24 Hz simulation step** decoupled from `requestAnimationFrame`. All original physics constants (`GRAVITY=2`, `JUMPSPEED=14.5`, `MAXFALLINGSPEED=-12`, `MAXRUNSPEED=12`, `WALKINGSPEED=6`) are preserved verbatim because they're tuned for 24 fps frames.
- **Pixel-perfect collision is faithful.** The original `GambitLib.HitTest.pixelsOverlap` rasterized both display objects to `BitmapData` and AND-ed their alpha channels. The port (`src/engine/HitTest.ts`) does the same with `OffscreenCanvas` + `getImageData`, with an AABB pre-filter and static masks baked once at level load.
- **Levels as TS modules**, one per file, calling builder methods (`level.addGraph(...)`, `level.addSwitch(...)`) on a base `Level` class — same numbers, same ordering as the original MXML. No JSON DSL in v1.
- **MovieClip-style assets** (cutscenes, win animations, sprite sheets) are extracted from the original SWFs via [JPEXS Free Flash Decompiler](https://github.com/jindrapetrik/jpexs-decompiler) and ffmpeg into PNG / MP4 / MP3 — see `tools/extract-swf.mjs`.
- **`legacy/` is read-only.** The original AS3/MXML lives there as the canonical reference. The port lives in `src/`.

---

## Port process

The plan is in seven phases (full text in [`flash-to-html5-conversion-plan.md` §13](flash-to-html5-conversion-plan.md)):

| # | Phase | Status |
|---|---|---|
| 0 | Discovery + repo reorg + `CLAUDE.md` | ✅ done |
| 1 | Vite + PixiJS scaffold + smoke test | ✅ done |
| 2 | JPEXS asset extraction + curation (181 entries, 13.8 MB committed) | ✅ done — `extract:swf`, `extract:cutscenes`, `extract:avatar`, `curate` |
| 3 | Engine layer (FixedStep, Input, HitTest, Audio, GraphTone, AssetLoader, MovieClipShim) | 🟡 8/8 modules done — avatar wired into smoke scene, idle / run / face L+R switch by arrow keys |
| 4 | Game logic port — module by module in dependency order ([§14](flash-to-html5-conversion-plan.md)) | ⏳ |
| 5 | UI port — DOM overlay (menu, options, instructions, credits, HUD) | ⏳ |
| 6 | Testing + polish (cross-browser, mobile, perf) | ⏳ |
| 7 | Release prep | ⏳ |

**Latest milestone:** `npm run dev` shows Waker idling on a ground line; arrow keys move him across the canvas with run animations playing at 24 fps. Bundle is 300 KB (95 KB gzipped) plus assets.

Conversion log entries land in `CONVERSION_LOG.md` (one per ported module) once Phase 4 starts.

---

## Credits

- Original game by **[MIT Gambit Game Lab](https://gambit.mit.edu)** ("ccnet-build-team-5") and **Poof Productions**.
- Port and tooling by Eric Klopfer with [Claude Code](https://claude.com/claude-code).
