# Flash/ActionScript → HTML5/TypeScript Conversion Plan

> A working planning document for porting a legacy AS3/MXML (Flex-era) game to a modern web stack using Claude Code as the primary porting assistant.

---

## 0. How to use this document

This is a **template to be filled in**, not a finished plan. Sections marked with `[FILL IN]` are project-specific. The plan assumes:

- The source is a code-heavy AS3 game (with MXML for some UI), not a timeline-driven Flash CC project.
- You will use **Claude Code** in a local repo to do the bulk of the conversion, with this document (or a `CLAUDE.md` derived from it) as standing context.
- Quality target: feature-faithful first, then modernize.

---

## 1. Project overview

**Game name:** **Waker** (project codename was "Woosh2"; an earlier build with the abstract art set is referred to as "Whoosh")
**Original launch year / last update:** ~2008–2012 (built against Adobe Flex SDK 3.0.0 / Flash Player 10)
**Genre / scope:** educational, physics, platformer — the player draws velocity / displacement / mixed graphs whose curve becomes a solid platform terrain
**Why port now:** want people to still be able to play and show past work

**Success criteria** (pick what applies):

- [x] Plays in modern Chrome/Safari/Firefox at original framerate
- [x] Mobile-playable would be a bonus, but not essential (touch input, responsive)
- [x] Should look and feel like the original, but doesn't need pixel perfection
- [ ] Save data migration from old SharedObject format _(N/A — game uses no SharedObject persistence)_
- [ ] Maintainable in TypeScript by future contributors
- [ ] Open source release / accessible bundle size

**Explicit non-goals:**

- [x] We will not preserve Flex MXML data binding semantics — UI is rebuilt in plain HTML/DOM
- [ ] No multiplayer in v1 _(N/A — game is single-player only)_

---

## 2. Source code audit (Discovery phase)

Before writing any TypeScript, build a complete picture of what exists. Most porting failures come from skipping this step.

### 2.1 Inventory

Generated 2026-05-07 from the source tree.

**File counts (under `src/`):**

| Type            |                              Count | Notes                                                           |
| --------------- | ---------------------------------: | --------------------------------------------------------------- |
| `.as`           |                                 64 | Includes 25 inside vendored `gs/` (Greensock TweenMax, ~10.092) |
| `.mxml`         |                                 63 | All Flex 3.0 MXML, mostly `<mx:Canvas>` subclasses              |
| `.swc`          |          0 in `src/`; 1 in `libs/` | `GaverRingtone1_sf.swc` (Sonoflash procedural-tone library)     |
| `.swf` (assets) | 198 total / 99 inside `src/story/` | Most are MovieClip animations, not just static art              |
| `.png`          |       158 / 81 inside `src/story/` | Includes alpha-channel **collision masks** for ground geometry  |
| `.jpg`          |          2 / 1 inside `src/story/` | Menu background                                                 |
| `.mp3`          |        85 / 50 inside `src/story/` | SFX, dialogue VO, end-game BGM                                  |

**Total lines of AS3 / MXML in `src/`:** **~15,435 LoC** (including the vendored `gs/` Greensock copy).

**Story asset weight (under `src/story/`):** **~14.9 MB** total — `.swf` 6.5 MB, `.mp3` 6.7 MB, `.png` 1.7 MB.

**Package tree** — flat, no `com.*` namespacing for game code:

```
src/
├─ Woosh2.mxml                  ← Application entry (splash screens, intro cutscene gate)
├─ game.mxml                    ← Main gameplay container (player, level, GUI, main loop)
├─ menu.mxml                    ← Top-level state machine (menuState / playState / instructions / credits)
├─ levelManager.mxml            ← Switch statement that maps level IDs ("d1","v2","m3"...) to classes
├─ level.mxml                   ← Base class with imperative builders: setGround/setExit/addGraph/addSwitch
├─ levels/                      ← 19 subclass MXMLs: displacement0–3, velocity0–3, mixed0–3, cutscene*, etc.
├─ levels_backup/               ← Old level versions, can probably be discarded
├─ avatar.mxml, avatarImage.mxml ← Player sprite + collision-corner aura images
├─ movements.mxml               ← Frame-by-frame physics + pixel-collision response
├─ controlScheme.as             ← Key handlers (in-game + options) and tunable speed/gravity constants
├─ genericGraph.mxml            ← Per-graph drawing canvas (uses Graphics.lineTo for the curve)
├─ obstacles.mxml               ← Procedural placement of graph obstacles
├─ obstaclesClass.mxml, switchObject.mxml, spikeClass.mxml, spikeObstacle.mxml, platform.mxml, activationOrb.mxml
├─ gui.mxml, imgButton.mxml, difficulty_selector.mxml, soundOptions.mxml, anotherLvl.mxml ← UI
├─ AssetManager.as              ← ~250 [Embed] declarations indexing all bitmaps/SWF/MP3 assets
├─ soundManager.mxml            ← BGM/SFX/VO + Sonoflash GaverRingTone1 control
├─ Settings.as, Color.as, CustomEvent.as, pairObject.as ← Small utility / global-state classes
├─ GambitLib/                   ← Vendored: HitTest (true alpha-mask pixel collision)
├─ gs/                          ← Vendored: Greensock TweenMax + 25 plugins + 13 easing classes
├─ abstract/                    ← Alternate (non-narrative) art set — duplicate of /story/
└─ story/                       ← 231 narrative-version assets (bgm, cutscenes, sfx, sprites, gui)
```

**External `.swc` / `.swf` libraries referenced:**

| Library                                                                                                     | Where                                 | Replacement plan                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `gs.TweenMax` (vendored AS3 source in `src/gs/`)                                                            | global tweens, glow filters           | **GSAP 3** (web port has near-identical API)                 |
| `GambitLib.HitTest` (vendored AS3 source in `src/GambitLib/`)                                               | pixel-perfect collision throughout    | **Custom port to OffscreenCanvas + getImageData** (see §2.4) |
| `com.sonoflash.*` / `GaverRingTone1` (`libs/GaverRingtone1_sf.swc`)                                         | procedural tone tied to graph drawing | **Custom Web Audio synth** (see §6 risk)                     |
| `mx.controls.Image`, `mx.core.UIComponent`, `mx.collections.ArrayCollection`, `mx.events.IndexChangedEvent` | core display & state                  | Replaced wholesale by PixiJS / DOM / TS arrays               |

**No usage of:** `flash.net.SharedObject`, `URLLoader`, `URLRequest`, `NetConnection`, `Socket`, `WebSocket`, `ExternalInterface`, `describeType`, Stage3D, Starling, Box2D, AIR-only APIs. (Verified by grep across `src/`.) **No save data, no networking, no JS bridge, no reflection.** This is a major simplification.

**Build configuration:**

- `.actionScriptProperties` / `.flexProperties` / `.project` — Adobe Flash Builder 3 project files
- `team5.build` — Apache Ant script invoking `mxmlc.exe` from **Flex SDK 3.0.0** (`C:\Program Files\Adobe\Flex Builder 3\sdks\3.0.0\bin`)
- HTML wrapper template in `html-template/` is the stock Flex `AC_FL_RunContent` embed — **discard**
- Compiler args of note: `-use-network=false`, `htmlPlayerVersion=10.0.0` → targets Flash Player 10, no network access, no AIR.

### 2.2 Dependency analysis

Concrete classification for _this_ project:

| Library type       | Used here?                                                                                                                                      | Replacement strategy                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer / display | **Flash native + Flex `mx:Canvas` + MovieClip SWFs.** No Starling/Stage3D.                                                                      | **PixiJS v8** — display-list metaphor maps cleanly onto the existing scene-graph                                                                  |
| Tweening           | **Greensock TweenMax** (vendored AS3, `src/gs/`)                                                                                                | **GSAP 3** — drop-in mental-model replacement; `glowFilter` plugin → Pixi filter shim                                                             |
| Physics            | **None.** Hand-rolled gravity, fixed gameplay constants (gravity=2, jump=14.5, walk=6, run=12 px/frame), per-pixel collision response loop      | Keep the same algorithms in TS — no physics engine needed                                                                                         |
| Audio              | **Native `flash.media.Sound` + Sonoflash `GaverRingTone1`** procedural synthesizer                                                              | **Howler.js** for SFX/BGM/VO + **custom Web Audio synth** for the parameterized tone modulated while drawing graphs (§6 risk)                     |
| Networking         | **None.**                                                                                                                                       | N/A                                                                                                                                               |
| Utility            | `flash.geom.Point`, `flash.geom.Rectangle`, `mx.collections.ArrayCollection`                                                                    | Plain TS objects / arrays                                                                                                                         |
| Flex framework     | **mx.controls.Image**, **mx.core.UIComponent**, **mx.collections.ArrayCollection**, mxml states, `[Bindable]` (10 sites), no spark.\*           | Re-implemented as Pixi containers + DOM — no Royale needed                                                                                        |
| Pixel collision    | **`GambitLib.HitTest.pixelsOverlap`** — rasterizes both `DisplayObject`s to `BitmapData`, AND-s their alpha masks, scans for any non-zero pixel | **Custom OffscreenCanvas re-implementation** — the algorithm is ~60 lines and ports cleanly, but every callsite needs to migrate to the new types |

### 2.3 AS3 / Flash feature usage map

| Feature                                                    | Use level                                                                                                                    | Notes / example call sites                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flash.display.MovieClip`                                  | **Heavy**                                                                                                                    | All cutscenes, level-complete animations, BGM "music" SWFs, glow effects, hint signs are SWF MovieClips. `gotoAndStop`, `nextFrame`, `framesLoaded`, `play()` used throughout `Woosh2.mxml` and `level.mxml` |
| `flash.display.Graphics`                                   | **Heavy**                                                                                                                    | `genericGraph.mxml` — `terrainMain.graphics.lineTo(timer, value)` draws the curve in real time, then the rendered shape becomes the platform                                                                 |
| `flash.display.BitmapData`                                 | **Heavy (indirect)**                                                                                                         | Inside `GambitLib.HitTest` — rasterize-and-AND for pixel collision                                                                                                                                           |
| `flash.events.*`                                           | **Light**                                                                                                                    | One custom event (`CustomEvent.ON_ENTRANCE_SET`); 9 `dispatchEvent` calls (most are inside vendored TweenMax). No bubbling reliance.                                                                         |
| `flash.events.Event.ENTER_FRAME`                           | **Heavy**                                                                                                                    | 5 `addEventListener(Event.ENTER_FRAME, ...)` sites driving the splash, the main game loop, the win countdown, etc. **Frame-locked logic everywhere.**                                                        |
| `flash.geom.Point`, `Rectangle`                            | **Light**                                                                                                                    | `playerVel`, `playerAccel`, `previousPos`, occasional `systemManager.screen`                                                                                                                                 |
| `flash.geom.Matrix`, `ColorTransform`                      | **None directly**                                                                                                            | Used only inside `HitTest` rasterization                                                                                                                                                                     |
| `flash.media.Sound` / `SoundChannel` / `SoundTransform`    | **Heavy**                                                                                                                    | `soundManager.mxml` — BGM channel, VO channel, sprint/walk loops, fade via incrementing `SoundTransform.volume`                                                                                              |
| `flash.net.*`                                              | **None**                                                                                                                     | No SharedObject / URLLoader / Socket usage — confirmed by grep                                                                                                                                               |
| `flash.utils.Timer`, `getTimer`, `Dictionary`, `ByteArray` | **None**                                                                                                                     | Code uses frame counters instead of timers                                                                                                                                                                   |
| `flash.text.*`                                             | **Trivial**                                                                                                                  | One `<mx:Text id="tracer">` debug label; no embedded fonts                                                                                                                                                   |
| `flash.system.*`, `ExternalInterface`                      | **None**                                                                                                                     | No JS bridge, no capabilities sniffing                                                                                                                                                                       |
| Stage3D / Starling                                         | **None**                                                                                                                     | Pure 2D Flex display list                                                                                                                                                                                    |
| E4X / `XML` literals                                       | **None**                                                                                                                     | No `<foo/>` literals, no e4x queries                                                                                                                                                                         |
| `Vector.<T>` typed arrays                                  | **None** — uses `mx.collections.ArrayCollection` and untyped `Array`                                                         | Direct port to `T[]`                                                                                                                                                                                         |
| `int` / `uint` / `Number`                                  | Mixed but **no bitwise tricks**                                                                                              | Collapse to `number`; spot-check arithmetic                                                                                                                                                                  |
| `[Embed]` metadata                                         | **Heavy** — ~250 sites in `AssetManager.as` alone                                                                            | Replace with Vite static imports                                                                                                                                                                             |
| `[Bindable]` / data binding                                | **Light** — 10 sites total (one-way, mostly volume/visibility flags)                                                         | Replace with explicit setter calls                                                                                                                                                                           |
| Reflection (`describeType`, `getDefinitionByName`)         | **None in game code** (one site inside `gs/TweenGroup.as`)                                                                   | Nothing to port                                                                                                                                                                                              |
| `cursorManager.setCursor` / `hideCursor`                   | **Light** — custom PNG cursor in `Woosh2.mxml`                                                                               | CSS `cursor: url(...)`                                                                                                                                                                                       |
| Flex states (`mx:State`, `currentState`)                   | **Heavy in UI** — 11 state blocks across `menu.mxml`, `imgButton.mxml`, `difficulty_selector.mxml`, `avatarImage.mxml`, etc. | Plain JS state machines / CSS classes                                                                                                                                                                        |

### 2.4 Behavioral / runtime audit

| Concern                             | Finding                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Target framerate**                | **24 fps is the implicit assumption** — the win-countdown comment says `"//24fps"`, and the BGM/animation timing in `Woosh2.mxml` (e.g. `if (animationTimer >= 68 ...)`) assume that cadence. Flex 3 default stage frame rate is also 24.                                                                                                                                               |
| **Frame-based vs. time-based**      | **Entirely frame-based.** Physics constants (`GRAVITY=2`, `JUMPSPEED=14.5`, `RUNSPEED=0.2*1.5`, `MAXFALLINGSPEED=-12`, `MAXRUNSPEED=12`) are pixels-per-frame at 24 fps. All timers (intro fade, win countdown, hint delay, hit-effect 12 frames) are frame counters, not ms. **Direct port must run a fixed 24 Hz simulation tick, decoupled from `requestAnimationFrame` rendering.** |
| **Save data**                       | **None.** No `SharedObject`, no localStorage equivalent. Difficulty + volume are session-only.                                                                                                                                                                                                                                                                                          |
| **Network**                         | **None.** `-use-network=false` compiler flag confirmed.                                                                                                                                                                                                                                                                                                                                 |
| **Pseudo-randomness**               | Used only for jump / land / menu-click sound variant pick, and for procedural placement of decorative graph obstacles in `obstacles.mxml`. No reliance on a specific seed for gameplay.                                                                                                                                                                                                 |
| **Pixel-precise interactions**      | **Pervasive.** `HitTest.pixelsOverlap` is used for: ground/platform collision (4 corners of the avatar against ~10 colliders/frame), graph-obstacle hits, switch activation, orb pickup, **and even button hit-testing in `imgButton.mxml`** (so non-rectangular bitmap buttons work correctly).                                                                                        |
| **Mouse vs. touch**                 | Desktop-only. Mouse-move triggers cursor reveal/hide; click on splash skips intro; in-game options use keyboard (arrows + Enter/Esc). No `MouseEvent.MOUSE_DOWN` for gameplay — gameplay is keyboard only (← → for walk, Shift/`S` for sprint, ↑/Space for jump, `D` to pick/drop, Esc for pause).                                                                                      |
| **Right-click / browser conflicts** | None handled. Browser context menu and standard shortcuts will work; consider preventing default for game-relevant keys (Space scrolls page, arrows scroll page).                                                                                                                                                                                                                       |
| **Cheat code**                      | `controlScheme.as` has a hardcoded "changyou" + PageUp cheat that warps the player to y=0. Harmless, can be preserved or stripped.                                                                                                                                                                                                                                                      |
| **Resolution**                      | **800 × 600.** `Woosh2.mxml` scales the inner `resizeCanvas` (id) to fit the window with `Math.min(scaleX, scaleY)`, capped at a minimum of 0.5×. Aspect-fit letterboxing — easy to replicate.                                                                                                                                                                                          |

---

## 3. Target stack

### 3.1 Language and build

- **Language:** TypeScript (strict mode). AS3 maps cleanly: classes, interfaces, packages → namespaces or ES modules, typed parameters, `private`/`protected`/`public`, and getters/setters all carry over.
- **Build tool:** Vite (fast, modern, asset handling out of the box). Webpack is the heavyweight alternative.
- **Package manager:** pnpm or npm.
- **Testing:** Vitest for unit, Playwright for end-to-end / visual regression.
- **Linting:** ESLint + `@typescript-eslint`, Prettier.
- **CI:** GitHub Actions running lint, typecheck, tests, and a build artifact upload.

### 3.2 Renderer choice

The two main candidates you mentioned, plus alternatives:

| Renderer               | API similarity to Flash                                                           | Performance             | Maintenance status                                        | Recommended when                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **PixiJS**             | Display-list metaphor (`Container`/`Sprite`/`Graphics`) — close but not identical | WebGL/WebGPU, very fast | Active, modern (v8+)                                      | Default choice; mobile or perf matters; modern dev experience                       |
| **CreateJS / EaselJS** | Closest API match to Flash (Sprite, MovieClip, Stage, Ticker)                     | Canvas2D, slower        | **Largely stagnant** — last meaningful releases years ago | Quick faithful port, prototyping, no perf budget; not ideal for long-term ownership |
| **Phaser 3**           | Full game framework, less Flash-like                                              | WebGL/Canvas, fast      | Active                                                    | If you'd rather rewrite around a framework than port file-by-file                   |
| **Three.js**           | 3D-first                                                                          | WebGL, fast             | Very active                                               | Only if game has 3D / Stage3D usage                                                 |

**Recommendation:** **PixiJS** for almost any game-sized project. The display-list mental model survives the port; the GPU rendering path absorbs the kind of bitmap-heavy work old AS3 games tend to do; and active maintenance matters when the port is going to live another 5+ years.

CreateJS is tempting for the API similarity, but you'd be inheriting a slowly-bit-rotting dependency. Use it only for a quick, throwaway port where parity with Flash semantics is more important than longevity.

### 3.3 Supporting libraries

| Concern                  | Recommended                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Audio                    | **Howler.js** (handles format fallback, mobile unlock, sprites)                                    |
| Tweening                 | **GSAP** (drop-in mental model from Greensock; if you used GS in AS3, the API is nearly identical) |
| Physics 2D               | **matter.js** (easy) or **planck.js** (Box2D-faithful) or **Rapier** (Rust, fastest)               |
| Input                    | Native DOM events; **hammer.js** if multi-touch gestures are heavy                                 |
| State / data             | Plain TS classes for game state; **Zustand** or **Valtio** if you want reactive state for UI       |
| Random / math            | **seedrandom** if you need deterministic RNG; **gl-matrix** for vector math                        |
| XML parsing              | **fast-xml-parser** (replacement for E4X)                                                          |
| Persistence              | `localStorage` for simple, **IndexedDB** (via **Dexie**) for larger save data                      |
| HTML UI (replacing MXML) | Plain TS + DOM, or **Preact** / **React** / **Svelte** if MXML had real component complexity       |

### 3.4 Asset pipeline

- **Images:** export to PNG/WebP; consider sprite atlases via TexturePacker or `@pixi/assets` packing tools.
- **Audio:** transcode to OGG + MP3 (or just MP3 if you want one format); Howler handles fallback.
- **Fonts:** `@font-face` web fonts; if the game depended on embedded fonts for layout, validate metrics carefully.
- **SWF assets:** if any animations exist only as SWF timelines (not code), export them via Adobe Animate's HTML5 Canvas export, or rebuild as sprite sheets / Spine / DragonBones / Lottie.

---

## 4. Conversion approach

### 4.1 Three paths (and why we'll blend them)

**Path A — Compile via Apache Royale.**
Apache Royale (the successor to Adobe Flex / FlexJS) compiles AS3 + MXML directly to JS/HTML5. It is a real project, but historically the output quality varies, the active community is small, and full Flex framework parity is incomplete. **Useful as a reference**, sometimes as a stopgap, rarely as a finished product. Worth trying on a single module to see what it produces — if your code is mostly logic with little Flash display API, it can give surprisingly usable output.

**Path B — Static AS3-to-TypeScript translation.**
Several community tools have existed (Jangaroo, the older `as3-to-typescript` projects, FlashDevelop converters). They do well on syntax (classes, types, packages) and poorly on Flash runtime calls. Output requires substantial cleanup. **Useful as a first-pass syntactic transformer.**

**Path C — Hand-port (AI-assisted) using AS3 as the spec.**
Read each AS3 module, then write the equivalent TypeScript using PixiJS and your chosen libraries. Slowest in raw lines/hour but produces clean, idiomatic, modern code. **This is where Claude Code shines** — it's well-suited to "translate this file, preserving behavior, swapping these APIs per the glossary."

**Pragmatic hybrid:**

1. Use a syntactic converter (or Claude Code with a strict prompt) to do the boilerplate transformation: package → module, `function`/`class`/`interface` punctuation, type annotations, getters/setters.
2. Hand-port (with Claude) the Flash-API-touching code, MXML UI, and anything stateful or rendering-related.
3. Reserve full rewrites for modules that are tangled, dead, or trivial enough that re-implementation is faster than translation.

### 4.2 Existing tools worth knowing

- **Apache Royale** — https://royale.apache.org — AS3+MXML to JS/HTML5 compiler. Try a sample module; keep expectations modest.
- **Jangaroo** — older AS3-to-JS compiler; unmaintained but historically reliable for pure-logic AS3.
- **Haxe** — not a converter, but a language with AS3-like syntax that compiles to JS. Some teams have done partial Haxe ports as an intermediate stop. Probably overkill for one project.
- **Adobe Animate HTML5 Canvas export** — only useful for FLA timeline assets; produces CreateJS-based output.
- **swf2js / Ruffle** — runtime emulators, **not converters**. Good for archival playback, not for producing maintainable source.

### 4.3 Recommended workflow with Claude Code

1. **Set up `CLAUDE.md` at the repo root.** Include: project goals, target stack, the translation glossary (§6), naming conventions, "don'ts" (e.g., "do not introduce React unless I ask"), and the path of this planning doc.
2. **Build a `/legacy/` directory** containing the original `.as` and `.mxml` source, read-only. The new TS lives in `/src/`.
3. **Maintain `CONVERSION_LOG.md`** with one entry per ported module: source path, dest path, date, notes on tricky bits, deviations from original.
4. **Port in vertical slices**, not breadth-first. A vertical slice = one playable feature end-to-end. Better to have menu-screen working completely than 60% of every module ported.
5. **Test harness before logic.** Stand up a `vitest` suite around the _original_ expected behavior (you describe it; Claude writes the test) before porting the implementation. This catches drift.
6. **Small commits, one module per commit** when feasible. AS3 → TS diffs are large; reviewability matters.
7. **Snapshot screenshots** of the original for visual reference. Playwright can capture and diff the new build against these.
8. **Use Claude Code subagents** (or split sessions) for parallel work on independent subsystems (audio, input, save/load), but keep rendering on a single pair of hands until the display abstraction stabilizes.
9. **Re-prompt with the glossary often.** If a session drifts and starts inventing API translations, paste the glossary back in.

---

## 5. The MXML question

MXML is the part of a Flex codebase with no clean modern equivalent. Decide early how to handle it.

**Three options:**

1. **Treat MXML as if it were JSX.** Hand-translate each MXML component to a TS class or a Preact/React/Svelte component. Data binding (`{expression}`) becomes reactive state. Layout containers (`HBox`, `VBox`) become flexbox CSS.
2. **Treat MXML as throwaway scaffolding.** Re-design the UI in plain HTML/CSS, treating the MXML only as a behavioral spec ("the settings dialog has these controls and this validation"). Fastest if the original UI is dated anyway.
3. **Compile MXML via Apache Royale.** Royale specifically targets MXML. If your MXML use is heavy and Flex-idiomatic, this can save real work — at the cost of a less idiomatic web result.

For most games, **option 2** wins. Game UI is usually a small fraction of the codebase, and MXML's data-binding model rarely survives translation cleanly enough to be worth preserving structurally.

---

## 6. Translation glossary (Flash → Web)

Keep this in `CLAUDE.md` so every Claude Code session sees it.

| AS3 / Flash                                     | TypeScript / Web                                                             | Notes                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Sprite`, `MovieClip`, `DisplayObjectContainer` | `PIXI.Container`                                                             | Animation frames need explicit replacement (sprite sheet, Spine, etc.) |
| `Bitmap`, `BitmapData`                          | `PIXI.Sprite` + `PIXI.Texture`, or `OffscreenCanvas` for direct pixel access |
| `Shape`, `Graphics`                             | `PIXI.Graphics`                                                              | API is similar (`.beginFill`, `.drawRect`, etc.)                       |
| `Stage`                                         | `PIXI.Application` + DOM canvas                                              |
| `Event`, `EventDispatcher`                      | `EventTarget` (built-in) or a typed emitter (e.g., `mitt`, `eventemitter3`)  | Bubbling generally not preserved automatically                         |
| `Event.ENTER_FRAME`                             | `PIXI.Ticker` callback or `requestAnimationFrame` loop                       | Switch to delta-time logic                                             |
| `Timer`                                         | `setInterval` / `setTimeout`, or a tick-driven scheduler                     |
| `URLLoader`, `URLRequest`                       | `fetch()`                                                                    |
| `Socket`, `XMLSocket`                           | `WebSocket`                                                                  |
| `NetConnection` (AMF)                           | Replace with JSON over fetch/WebSocket; or `amf.js` if you must keep AMF     |
| `flash.media.Sound`, `SoundChannel`             | `Howl` instances (Howler.js)                                                 |
| `SharedObject`                                  | `localStorage` for small JSON; `IndexedDB` (via Dexie) for larger            |
| `Vector.<T>`                                    | `T[]`                                                                        |
| `Dictionary`                                    | `Map<K, V>`                                                                  |
| `int`, `uint`, `Number`                         | `number` (audit any bitwise math for unsigned semantics)                     |
| `String`, `Boolean`                             | `string`, `boolean`                                                          |
| `flash.geom.Point`                              | Custom `{x, y}` interface, `PIXI.Point`, or `gl-matrix` `vec2`               |
| `flash.geom.Rectangle`                          | `PIXI.Rectangle` or custom                                                   |
| `flash.geom.Matrix`                             | `PIXI.Matrix`                                                                |
| `ByteArray`                                     | `Uint8Array` / `ArrayBuffer` + `DataView`                                    |
| `XML` (E4X)                                     | Parse with `fast-xml-parser`; rewrite E4X queries as object access           |
| `Object` (untyped bag)                          | `Record<string, unknown>` (then narrow)                                      |
| `[Embed(source="...")]`                         | Bundler import: `import imageUrl from './foo.png'`                           |
| `[Bindable]` properties                         | Reactive store (Zustand/Valtio) or framework state                           |
| `getDefinitionByName` / reflection              | Explicit registry / map                                                      |
| `flash.utils.getTimer()`                        | `performance.now()`                                                          |
| `flash.system.Capabilities`                     | Browser feature detection / `navigator.*`                                    |
| `ExternalInterface.call`                        | Direct JS call (you're already in JS)                                        |
| `trace()`                                       | `console.log` (consider a leveled logger)                                    |
| Package `com.foo.bar`                           | ES module path `src/foo/bar/...`                                             |

---

## 7. Phased plan

### Phase 0 — Discovery (1–2 weeks)

- Complete §2 audit
- Stand up empty TS/Vite project with chosen libs
- Try Apache Royale on one module as a sanity check
- Decide MXML strategy

**Exit criteria:** This document is fully filled in. No `[FILL IN]` left in §1–§3.

### Phase 1 — Foundation (1–2 weeks)

- Build pipeline, lint, typecheck, test runner all green on a hello-world
- `PIXI.Application` boots, draws a sprite, plays a sound (Howler), reads a key
- Asset import convention established
- `CLAUDE.md`, glossary, and `CONVERSION_LOG.md` in place

**Exit criteria:** "Hello game" — title screen draws, plays a sound, responds to input.

### Phase 2 — Core systems

- Input abstraction (keyboard, mouse, touch unified)
- Audio system wrapping Howler
- Save/load (localStorage or IndexedDB) with migration path from SharedObject AMF if needed
- Networking layer (if any)
- Tweening / animation loop
- Scene/state machine if the game uses one

**Exit criteria:** All non-rendering services available as clean TS APIs.

### Phase 3 — Asset pipeline

- All images converted, sprite-sheeted where useful
- All audio converted to OGG+MP3
- Fonts loaded
- Asset manifest / preloader matches original load behavior

### Phase 4 — Game logic port

- Port modules in dependency order, leaves first
- Maintain `CONVERSION_LOG.md` discipline
- Ship vertical slices: title → main menu → one playable level → save → resume

### Phase 5 — UI port (MXML replacement)

- Per §5 strategy
- Accessibility pass (keyboard navigation, screen reader landmarks for menus) — Flash had none of this; this is your chance

### Phase 6 — Testing & polish

- Visual regression suite (Playwright + screenshot diff vs. original recordings)
- Cross-browser pass: Chrome, Safari, Firefox, plus iOS Safari and Chrome Android
- Performance pass: profile on mid-range mobile, hit framerate budget

### Phase 7 — Release prep

- Bundle size audit
- Loading screens / progressive asset loading
- Analytics if desired
- Hosting / distribution

---

## 8. Risk register

| Risk                                                           | Likelihood | Impact            | Mitigation                                                                            |
| -------------------------------------------------------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------- |
| Frame-rate-dependent logic produces drift on web               | High       | High              | Audit and refactor to delta-time early; write tests around physics/timing             |
| Pixel-perfect rendering differences (anti-aliasing, blending)  | High       | Medium            | Decide early: parity vs. "feels right." Capture original screenshots for diff testing |
| Audio latency / mobile unlock issues                           | Medium     | Medium            | Howler.js handles most; build a "tap to start" gate                                   |
| MXML data binding loss causes UI bugs                          | Medium     | Medium            | Pick framework (or plain DOM) deliberately; don't half-port                           |
| Hidden Flex framework dependencies                             | Medium     | High              | List every `mx.*` / `spark.*` import in audit; decide replace-or-skip per import      |
| Save data migration breaks existing players                    | Low–Medium | High (if applies) | Write a one-time AMF reader (e.g., `amf.js`) and migrate to JSON on first launch      |
| Performance regression on mobile                               | Medium     | High              | Profile early on a real low-end device, not just desktop devtools throttling          |
| Stage3D / Starling code requires architectural rewrite         | Variable   | High              | If heavy, plan PixiJS-based rendering early; don't try to emulate Stage3D             |
| Apache Royale output looked promising but breaks on edge cases | Medium     | Medium            | Don't commit to Royale for the whole codebase; use it as a tool, not a product        |

---

## 9. Pre-flight checklist

Filled in 2026-05-07.

- [x] Total `.as` file count: **64** (39 game + 25 vendored Greensock)
- [x] Total `.mxml` file count: **63**
- [x] Total LoC (AS3 + MXML): **~15,435** (incl. vendored gs/)
- [x] Flex SDK version: **3.0.0** (Flash Builder 3)
- [x] AIR target: **No** — pure Flash Player 10 SWF
- [x] Third-party SWCs and versions: **`GaverRingtone1_sf.swc`** (Sonoflash procedural-tone library, SonoflashUI bundled in `libs/SonoflashUI_GaverRingtone_sf.swf`)
- [x] Original target framerate: **24 fps** (Flex 3 default; confirmed by inline comments and tuning)
- [x] Original target resolution / aspect ratio: **800 × 600 (4:3)** with aspect-fit letterboxing
- [x] Mobile target: **None** in original (Flash Player desktop only) — port should keep responsive scaling but mobile is a stretch goal
- [x] Networking: **None**
- [x] Save data: **None** — no SharedObject, no persistence, options reset per session
- [x] DRM / online auth: **None**
- [x] Build process: **Flash Builder 3 + Ant** (`team5.build` invokes `mxmlc` from SDK 3.0.0)
- [ ] Source control status: **Not in git yet** (working dir is not a repo). One of the first acts of Phase 1 is `git init` + import `legacy/`.
- [ ] Original game still buildable today? **Unknown** — Flash Builder 3 / Flex SDK 3.0.0 are no longer easily installable. There is a compiled `bin-debug/` from a past build, which can serve as a runtime reference inside the Ruffle emulator (https://ruffle.rs) if needed for visual diffing.
- [ ] Asset license clearance: **TBD by user** — the project header references "Gambit Game Lab" / "Poof Productions" / "ccnet-build-team-5", suggesting an MIT/student-team origin; needs confirmation before any public hosting.
- [x] Telemetry / analytics in original: **None**

---

## 10. Open questions

These surfaced during the discovery audit. Each has a **proposed answer** based on what's in the code; please confirm or override.

### Q1. Renderer: PixiJS vs. plain Canvas/DOM

Most of the game is small (≤30 sprites on screen, 4:3 at 800×600, no Stage3D) and could run fine on plain HTML5 Canvas2D. PixiJS gives us a real display list, filters, and a future-proof foundation, at the cost of one big dependency.

**Proposed:** **PixiJS v8.** The display-list metaphor (`Container`/`Sprite`/`Graphics`) maps almost line-for-line onto `mx:Canvas` + `Image` + `MovieClip` usage, and we already need `Graphics.lineTo` (graphs) and a glow-filter equivalent (TweenMax glowFilter plugin for displacement-pair feedback). PixiJS gives all three out of the box.

### Q2. SWF asset conversion strategy — the biggest unknown

There are **99 `.swf` files inside `src/story/`** and the codebase loads them as `MovieClip` objects, calling `play()`, `gotoAndStop()`, `nextFrame()`, `framesLoaded`. They fall into roughly three buckets:

| Bucket                                                 | Examples                                                                                                             | Likely conversion                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single-frame static art** (used as if it were a PNG) | `Glow_Effect_reddishorange.swf`, `displaceOrigin.swf`, `placeholder_entrance.png`-equivalent SWFs, level backgrounds | Re-export as PNG/WebP (one frame)                                                                                                                                  |
| **Short looped/animated sprites**                      | `graphSpark.swf`, `Blink.swf`, orb effects, avatar sprite sheet `avatarSheet.swf`                                    | Sprite-sheet (TexturePacker) or short PNG sequence                                                                                                                 |
| **Long pre-rendered cutscenes**                        | `intro.swf`, `pre_world1.swf`, `ending.swf`, `levelcomplete.swf` (~24 fps, dozens of frames each)                    | **Best option: render to MP4/WebM** during build and play via `<video>`. Alternative: extract frames to a sprite atlas (huge), or use a SWF→Lottie/Spine pipeline. |
| **Audio-as-SWF**                                       | `bgm/world01.swf`, `bgm/menu.swf`, `sfx/graph/graph_draw.swf` etc.                                                   | These are MP3 streams wrapped in SWF for AS3 Embed semantics — extract to MP3/OGG via JPEXS or `swfextract`.                                                       |

**Proposed:** Set up a **one-time build-script that decompiles every `src/story/*.swf` via [JPEXS Free Flash Decompiler](https://github.com/jindrapetrik/jpexs-decompiler)** (CLI mode), classifies each into one of the three buckets, and emits PNG/WebP/MP4/MP3 alongside a JSON manifest mapping the original Embed name → new web URL. We invest a couple of days in this script up front; afterwards the AssetManager port is mechanical.

**Question for you:** Do you have access to the original `.fla` source files? If so, that's the cleanest path (re-export via Adobe Animate / Animate's HTML5 Canvas export). If not, we go with the JPEXS pipeline.

### Q3. Sonoflash / GaverRingTone1 — the hardest dependency

The `varSnd` synthesizer is **not** a library you can swap; it's a compiled `.swc` that exposes a parameterized tone (`PNAME_PULSERATE`, `PNAME_DAMPING`, `PNAME_TONE0/1`, `PNAME_SHIFT0/1`). The game **modulates these parameters every frame** while a graph is being drawn — the sound is _part of the gameplay feedback_, mapping the player's velocity / displacement to pitch and pulse rate.

Three options:

1. **Faithful replacement (recommended):** Implement an equivalent in [Tone.js](https://tonejs.github.io) using two FM synths + an LFO modulated by the same `pulseRate`/`damping`/`shift` inputs. ~1–2 days of audio R&D to dial in something that _feels right_ but won't be sample-identical.
2. **Recording fallback:** Pre-render representative tones to a small library of OGG samples and crossfade based on the parameter values. Cheap, but loses the continuous-modulation feel.
3. **Drop the dynamic tone entirely** — replace with a static "graph drawing" loop. Simplest, but a clear gameplay-feel regression.

**Proposed:** Option 1 with Option 2 as a fallback if it's not landing.

**Question for you:** How load-bearing is this sound experience to you? If it's the educational hook (sonification of physics), we put serious effort into Option 1. If it was just polish, Option 3 saves a week.

### Q4. MXML strategy — confirming Option 2 from §5

The MXML in this codebase is **mostly imperative AS3 inside `<mx:Script>` blocks**, with `<mx:Canvas>` as a glorified container. The Flex-y bits (`[Bindable]`, `mx:State`, button rollover states) are real but isolated to ~10 files.

**Proposed:** **Option 2 — treat MXML as throwaway scaffolding.** We rebuild the menu/options/HUD as plain HTML+CSS overlaid above the Pixi canvas. This actually _upgrades_ the UI (responsive, keyboard-accessible) and avoids carrying Flex idioms into the new codebase.

For the in-level UI (hint sign, win animation, pause overlay), it's likely cleaner to keep those as Pixi children of the game canvas so they can scale/translate with the gameplay viewport. Final call to be made per-component during Phase 5.

### Q5. Frame-locked physics — fixed-tick or convert to delta-time?

Every physics constant in the game is calibrated for 24 fps (`GRAVITY=2 px/frame`, `JUMPSPEED=14.5 px/frame`, etc.). On a 144 Hz display under naïve `requestAnimationFrame`, the avatar would jump 6× higher.

**Proposed:** **Run a fixed 24 Hz simulation step** decoupled from rendering. Inside the `requestAnimationFrame` callback, accumulate elapsed time and run `update()` whatever number of times the accumulator allows (the standard "fixed-timestep with interpolation" pattern). This preserves all original tuning constants without one-by-one reinterpretation.

### Q6. Pixel collision — how faithful?

`HitTest.pixelsOverlap` is correct but **slow** — every frame the collision step rasterizes ~10 colliders × 4 player corners = 40 BitmapData operations against the player image. On Flash Player 10 this was already on the edge of the 24 fps budget.

**Proposed:** Port the algorithm faithfully to OffscreenCanvas + `getImageData`, but **bake the static collision masks once at level load** (the ground PNG and graph polygons don't change). Only do per-frame rasterization for moving objects (avatar corner aura images). This keeps collision behavior identical while cutting work by ~10×.

### Q7. Level data — keep imperative or convert to JSON?

Each of the 19 levels is a small MXML class whose `initLvl()` calls `super.addGraph(0, 0, 308, 200, 400, 300, 300, 100, 200, 430, 0, 200, 438, 3, 20)` etc. Two viable ports:

a) **TS modules**, one per level, each calling `level.addGraph(...)` — minimal restructuring, easy to diff against the original.
b) **JSON DSL** + a single loader. Cleaner separation of data and code; opens the door to a level editor later. But it's strictly more work _for v1_.

**Proposed:** **Start with (a)**, ship the port, then refactor to (b) only if a community or mod-maker wants it. (a) preserves the original numbers and call ordering, which makes it easier to verify visually.

### Q8. Source control before we touch anything

The working directory is not currently a git repo. **Strongly recommended** to `git init`, commit the existing AS3 source as the immutable `legacy/` baseline, and do all new work on a `port` branch. Confirm OK to do this in Phase 0.

### Q9. Ruffle as a side-by-side reference

[Ruffle](https://ruffle.rs) is a Rust-based SWF emulator that runs in the browser. The compiled `bin-debug/Woosh2.swf` (or wherever the original built artifact is) could be loaded into Ruffle as a **runtime reference** — handy for visual / audio comparison while we port. Compatibility isn't perfect (especially for the Sonoflash SWC), but for the rendering/UI it's usually good.

**Proposed:** Embed Ruffle in a "reference" page during development. Decision can wait until Phase 1.

### Q10. `abstract/` vs `story/` asset folders

The repo has two parallel art sets (`src/abstract/` and `src/story/`) — `AssetManager.as` says "find `/story/` and replace with `/story/`" to toggle between them. Currently every Embed points to `/story/`.

**Question for you:** Is the `abstract/` set still needed? It looks like an early prototype version that was kept as a backup. Same for `src/levels_backup/`. **Proposed:** archive both into the `legacy/` baseline and ignore them in the port unless you say otherwise.

---

---

## 12. Confirmed decisions

Locked in on 2026-05-07 based on user answers to §10. **§3 and §5 above are superseded by these where they conflict.**

| #       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | **Renderer: PixiJS v8.** Use `Container`/`Sprite`/`Graphics`. Use Pixi's built-in `GlowFilter` (or `@pixi/filter-glow`) instead of TweenMax's GlowFilterPlugin.                                                                                                                                                                                                                                                                         |
| **D2**  | **No central `.fla` archive available.** User has some prototype `.fla` files; we'll evaluate them once filenames are matched (see §15). Default plan: **JPEXS Free Flash Decompiler CLI** to extract every `src/story/*.swf` into PNG / WebP / MP3 / MP4 outputs + JSON manifest.                                                                                                                                                      |
| **D3**  | **Sound spec dramatically simplified.** The graph-drawing tone only needs to **rise in pitch when the line goes up and fall when the line goes down.** Not a faithful Sonoflash port. ⇒ **Single Web Audio `OscillatorNode`** with `frequency` set each tick from the current y-value of the curve, plus a small gain envelope on start/stop. ~2 hours of work, no Tone.js dependency required. Howler.js still handles BGM / SFX / VO. |
| **D4**  | **UI: plain HTML + CSS overlay** above the Pixi canvas. The whole menu / options / instructions / credits / pause / confirmation / sound-options layer is rebuilt in DOM; the in-level overlays (hint sign, win animation, hit-effect) stay as Pixi children. No React/Vue/Svelte.                                                                                                                                                      |
| **D5**  | **Fixed 24 Hz simulation step**, decoupled from `requestAnimationFrame`. Accumulator pattern. All original physics constants (`GRAVITY=2`, `JUMPSPEED=14.5`, `MAXFALLINGSPEED=-12`, `MAXRUNSPEED=12`, `WALKINGSPEED=6`, `RUNSPEED=0.3`, `RUNBRAKE=1.5`) preserved verbatim.                                                                                                                                                             |
| **D6**  | **Faithful pixel-perfect collision.** Port `GambitLib.HitTest.pixelsOverlap` to OffscreenCanvas + `getImageData`. **Bake static masks once at level load** (the ground PNG and once-solidified graph polygons). Rasterize moving objects (avatar corner auras) per-tick. AABB pre-filter on every test.                                                                                                                                 |
| **D7**  | **Levels: one TS module per MXML level**, calling builder methods on a `Level` base class — same numbers, same call ordering as the original. No JSON DSL in v1.                                                                                                                                                                                                                                                                        |
| **D8**  | **`git init` immediately.** Create an immutable `legacy/` directory containing the current AS3 sources, commit it, then branch `port` for all new TS work.                                                                                                                                                                                                                                                                              |
| **D9**  | **Ruffle: keep as a sanity-checking aid where it works.** User reports the menu is broken in Ruffle for the full game SWF, but parts of individual SWFs may still play; we'll embed a "reference" page during dev for cutscene comparison only. The user has a full original `.swf` build artifact — useful for visual diffs.                                                                                                           |
| **D10** | **Archive `src/abstract/` and `src/levels_backup/`** into the `legacy/` baseline. They are leftover prototype / duplicate folders. Port targets only `src/story/` art and `src/levels/`.                                                                                                                                                                                                                                                |
| **D11** | **Game name: Waker** (project codename was "Woosh2" in the team5 era). Confirmed by SWF fingerprint analysis (2026-05-07): `waker.swf` matches `bin-debug/Woosh2.swf` in uncompressed size and content fingerprint to within 0.5%. The smaller `woosh.swf` is the same code built with the `/abstract/` art set. New repo folder name: **`waker`** (or `waker-html5`).                                                                  |

---

## 13. Phase-by-phase concrete plan

This supersedes the generic §7. Time estimates are rough; treat them as ordering hints, not commitments.

### Phase 0 — Discovery & repo setup _(1 day, mostly already done)_

- [x] Code audit completed → §2 of this doc
- [x] Open questions resolved → §10 / §12 of this doc
- [ ] **`git init`**, add a `.gitignore` (Vite, node_modules, build artifacts), commit the current tree under a `pre-port` tag
- [ ] **Move existing AS3 sources into `legacy/`** (`legacy/src/`, `legacy/libs/`, `legacy/html-template/`, `legacy/bin-debug/`, `legacy/team5.build`, `legacy/.actionScriptProperties`, `legacy/.flexProperties`, `legacy/.project`)
- [ ] **Move `src/abstract/` and `src/levels_backup/`** into `legacy/`
- [ ] **Drop original `Woosh2.swf`** (the user's full build artifact) into `legacy/reference/` for Ruffle/visual-diff use
- [ ] Generate `CLAUDE.md` at repo root from Appendix A, customized with this project's decisions

**Exit:** repo is committed, legacy is read-only, `CLAUDE.md` is in place.

### Phase 1 — Empty TS/Vite scaffold _(1–2 days)_

- [ ] `pnpm create vite woosh-html --template vanilla-ts` (use `pnpm` or `npm`; Vite is the default)
- [ ] Add deps: `pixi.js@^8`, `@pixi/filter-glow`, `gsap`, `howler`, `@types/howler`, `vitest`, `playwright`, `eslint`, `typescript-eslint`, `prettier`
- [ ] Configure ESLint strict + Prettier; `tsconfig` strict mode
- [ ] Folder layout:
  ```
  /legacy/                ← read-only AS3
  /src/
    main.ts               ← bootstrap (replaces Woosh2.mxml)
    engine/               ← framework: GameLoop, AssetLoader, Input, Audio, HitTest, FixedStep
    game/                 ← gameplay: Game, Avatar, Movements, Level (base), Graphs, Switches, Spikes
    levels/               ← one .ts per original level
    ui/                   ← HTML overlay: Menu, Options, Instructions, Credits, HUD
    assets/               ← post-extraction PNG/WebP/MP3/MP4 + manifest.json
  /tools/
    extract-swf.mjs       ← JPEXS-driven asset pipeline
  /tests/
  /index.html             ← Pixi canvas + UI overlay root
  ```
- [ ] `index.html` with `<canvas id="game">` and a sibling `<div id="ui-root">`; CSS that letterbox-fits 800×600
- [ ] **"Hello game"** smoke test: PixiJS boots, draws a placeholder rectangle, plays a placeholder beep on click, logs key presses
- [ ] CI: GitHub Actions running `tsc --noEmit`, `eslint`, `vitest`

**Exit:** `pnpm dev` opens a black 800×600 canvas with a placeholder, lint+typecheck green.

### Phase 2 — Asset extraction pipeline _(2–3 days)_

This is the biggest non-code chunk of work; doing it once cleanly makes everything downstream mechanical.

- [ ] Install JPEXS (CLI) — document required version in `tools/README.md`
- [ ] Build `tools/extract-swf.mjs`:
  - For each `legacy/src/story/**/*.swf`:
    - `ffdec.exe -export image,sprite,frame,sound,movie <out> <in>`
    - Inspect: 1 frame? → emit PNG. 2–~30 frames? → sprite-sheet (one PNG row, plus a JSON `{frames: number, fps: 24, width, height}`). 30+ frames? → emit MP4 _(via ffmpeg from PNG sequence)_ OR keep as sprite-sheet if ≤500 KB.
    - SWF that wraps a single MP3 (BGM/SFX) → extract MP3 directly.
  - Emit `src/assets/manifest.json` mapping the original Embed name → asset URL + type:
    ```json
    {
      "graphSpark": {
        "type": "spritesheet",
        "url": "/assets/fx/graphSpark.png",
        "frames": 8,
        "fps": 24,
        "w": 64,
        "h": 64
      },
      "introCutScene": { "type": "video", "url": "/assets/cutscenes/intro.mp4", "duration": 12.5 },
      "bgmWorld1": { "type": "audio", "url": "/assets/bgm/world01.mp3" },
      "leveld1_collision": { "type": "image", "url": "/assets/collision/leveld1.png" },
      "guiBtnStart": { "type": "image", "url": "/assets/gui/menu/start.png" }
    }
    ```
- [ ] Spot-check **20% of outputs** by eye against Ruffle previews where possible
- [ ] If user finds matching `.fla` files (§15), prefer those: open in Adobe Animate, export individual cutscenes to MP4 / sprite-sheet PNG

**Exit:** every Embed name in `legacy/src/AssetManager.as` has a corresponding entry in `manifest.json`.

### Phase 3 — Engine layer _(3–5 days)_

- [ ] **`engine/AssetLoader.ts`** — preload all manifest entries via `PIXI.Assets.load`, return a typed asset registry (replaces `AssetManager.as`)
- [ ] **`engine/Input.ts`** — keyboard state machine (just-pressed, held, just-released) for `←`, `→`, `↑`/Space, `D`, `S`/Shift, Esc, plus mouse for menu and cheat code. Prevents default scrolling on game-relevant keys.
- [ ] **`engine/FixedStep.ts`** — accumulator-pattern game loop running `update()` at 24 Hz, calling `render(alpha)` once per rAF with interpolation factor
- [ ] **`engine/HitTest.ts`** — port of `GambitLib.HitTest.pixelsOverlap`:
  - `bakeMask(displayObject) → ImageData` once at level load
  - `pixelsOverlap(maskA, transformA, maskB, transformB) → boolean` with AABB pre-filter, then per-pixel AND in the overlap rectangle only
  - Fallback to plain `getBounds().intersects()` if either object opts out of pixel-precision (cheap rectangles)
- [ ] **`engine/Audio.ts`** — wraps Howler for BGM/SFX/VO, with a separate `GraphTone` class that owns the single Web Audio `OscillatorNode` (D3): `start()`, `setFrequency(hz)` from y-value, `stop()` with linear gain ramp.
- [ ] **`engine/MovieClipShim.ts`** — small helper for sprite-sheet "MovieClips" with `play()`, `gotoAndStop(frame)`, `framesLoaded`, mimicking the API the level/game code relies on
- [ ] Vitest unit tests for FixedStep accumulator math and HitTest AABB+pixel correctness

**Exit:** all engine APIs typed and tested in isolation.

### Phase 4 — Game logic port _(7–10 days)_

Module-by-module; see §14 for order.

- [ ] Port one vertical slice end-to-end first: **menu → cutsceneIntro → displacement0**. Get it 100% before opening up the rest.
- [ ] Port remaining levels in dependency order
- [ ] Maintain `CONVERSION_LOG.md` with one entry per ported module (source, dest, deviations, tricky bits)
- [ ] Visual-diff every ported level against the original (Ruffle screenshot for the parts that work, full-SWF screenshot for the parts that don't)

**Exit:** all 19 levels playable end-to-end, win-screen returns to menu.

### Phase 5 — Polish _(3–5 days)_

- [ ] Cross-browser pass (Chrome / Firefox / Safari)
- [ ] Mobile pass: touch buttons for ←, →, jump, pick/drop, sprint; responsive scaling already handled by canvas letterbox
- [ ] Audio: confirm "tap to start" gate works for autoplay-blocked browsers
- [ ] Bundle size audit (`vite build --mode production` + `vite-bundle-visualizer`)
- [ ] Accessibility: keyboard-navigable menu, focus indicators, `aria-label` on UI buttons
- [ ] Performance: profile on a low-end Android Chrome; aim for 24 fps stable

**Exit:** ship-ready build, hostable on any static host.

### Phase 6 — Release prep _(1 day)_

- [ ] Loading screen with progress bar (Pixi has `PIXI.Assets.loadBundle` callbacks)
- [ ] `README.md` with playthrough GIF, controls, credit to original team
- [ ] Hosting (GitHub Pages / Netlify / Vercel — your call)

---

## 14. Module porting order

Top of list is leaves (no game-internal deps); each row depends only on rows above it.

| Order | Source files                                                                                                                               | Target                                                                                               | Why                                                |
| ----: | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
|     1 | `Color.as`, `Settings.as`, `pairObject.as`, `CustomEvent.as`                                                                               | `engine/types.ts` + `game/state.ts`                                                                  | Tiny, no deps                                      |
|     2 | `GambitLib/HitTest.as`                                                                                                                     | `engine/HitTest.ts`                                                                                  | Foundation for everything                          |
|     3 | `AssetManager.as` (Embeds → manifest)                                                                                                      | `engine/AssetLoader.ts` + `assets/manifest.json`                                                     | Everything else loads through this                 |
|     4 | `soundManager.mxml` + `GaverRingTone1` calls                                                                                               | `engine/Audio.ts` + `engine/GraphTone.ts`                                                            | Game and graphs reference it                       |
|     5 | `controlScheme.as` (key handlers part)                                                                                                     | `engine/Input.ts` + `game/PauseMenuController.ts`                                                    | Pause menu is intertwined with input; split it now |
|     6 | `avatarImage.mxml`, `avatar.mxml`                                                                                                          | `game/Avatar.ts` (sprite + 4 corner masks + state animation)                                         | Self-contained                                     |
|     7 | `obstacles.mxml`                                                                                                                           | `game/GraphObstacles.ts`                                                                             | Procedural placement, no other deps                |
|     8 | `genericGraph.mxml`                                                                                                                        | `game/Graph.ts`                                                                                      | Drawing + solidify, depends on HitTest + Audio     |
|     9 | `activationOrb.mxml`                                                                                                                       | `game/Orb.ts`                                                                                        | Drops via gravity, depends on level base           |
|    10 | `obstaclesClass.mxml`, `platform.mxml`, `switchObject.mxml`, `spikeClass.mxml`, `spikeObstacle.mxml`                                       | `game/Switch.ts`, `game/MovingPlatform.ts`, `game/Spike.ts`                                          | Hazards                                            |
|    11 | `level.mxml` (base class)                                                                                                                  | `game/Level.ts` (`addGraph`, `addSwitch`, `setExit`, `setEntrance`, `setHint`, `setBG`, `setGround`) | Used by every level                                |
|    12 | `movements.mxml` (physics + collision response)                                                                                            | `game/Movements.ts`                                                                                  | Depends on Avatar, Level, HitTest                  |
|    13 | `levels/displacement0..3.mxml`, `velocity0..3.mxml`, `mixed0..3.mxml`, `cutsceneIntro/Displacement/Velocity/Mixed.mxml`, `gameending.mxml` | `levels/*.ts`                                                                                        | Each is ~30 lines of `level.addGraph(...)` calls   |
|    14 | `levelManager.mxml`                                                                                                                        | `game/LevelManager.ts` (string → factory map)                                                        | Drives level transitions                           |
|    15 | `gui.mxml` (in-game pause/HUD/hint/confirm)                                                                                                | mostly `ui/Hud.ts` (DOM) + a Pixi child for hint sign                                                | Crosses Pixi/DOM boundary                          |
|    16 | `imgButton.mxml`, `difficulty_selector.mxml`, `soundOptions.mxml`, `anotherLvl.mxml`, `menu.mxml`                                          | `ui/Menu.ts`, `ui/Options.ts`, `ui/Instructions.ts`, `ui/Credits.ts`                                 | Plain DOM                                          |
|    17 | `Woosh2.mxml` (splash screens, intro cutscene gate)                                                                                        | `main.ts`                                                                                            | Orchestrates everything; port last                 |
|    18 | `gs/*` (vendored TweenMax)                                                                                                                 | **deleted** — replaced by `gsap` import                                                              | No port needed                                     |

---

## 15. SWF asset triage and `.fla` candidate list

If you can find `.fla` source files that match the names below, send them and I'll evaluate. The list is ordered by **how much we'd benefit from the original `.fla`** vs. settling for JPEXS-extracted output.

### Tier 1 — biggest payoff if you have these (long animated sequences)

These are multi-second pre-rendered animations. Re-exporting from the `.fla` (Adobe Animate → HTML5 Canvas or Animate → MP4) is dramatically cleaner than decompiling.

| SWF (legacy path)                           | Likely `.fla` name                                            | What it is                                     |
| ------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `src/story/cutscenes/intro.swf`             | `intro.fla` / `gameintro.fla` / `cutscene_intro.fla`          | Opening cutscene                               |
| `src/story/cutscenes/ending.swf`            | `ending.fla` / `endgame.fla` / `cutscene_ending.fla`          | Final cutscene                                 |
| `src/story/cutscenes/pre_world1.swf`        | `pre_world1.fla` / `cutscene1.fla` / `displacement_intro.fla` | Pre-world-1 cutscene                           |
| `src/story/cutscenes/pre_world2.swf`        | `pre_world2.fla` / `cutscene2.fla` / `velocity_intro.fla`     | Pre-world-2 cutscene                           |
| `src/story/cutscenes/pre_world3.swf`        | `pre_world3.fla` / `cutscene3.fla` / `mixed_intro.fla`        | Pre-world-3 cutscene                           |
| `src/story/misc/levelcomplete.swf`          | `levelcomplete.fla` / `wisp.fla` / `levelend.fla`             | Win animation (shown when player reaches exit) |
| `src/story/misc/levelcomplete_cutscene.swf` | `levelcomplete_cutscene.fla` / `levelend_cs.fla`              | Win animation for cutscene levels              |
| `src/story/splash/gambitlogo.swf`           | `gambit.fla` / `gambitlogo.fla`                               | Studio splash                                  |

### Tier 2 — high payoff (avatar + frequently-used animated effects)

| SWF                                                                          | Likely `.fla`                                                       | What it is                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/story/sprite/avatarSheet.swf`                                           | `avatar.fla` / `avatarSheet.fla` / `character.fla` / `playable.fla` | **Player sprite sheet** — multiple animation states (idle/walk/run/jump up/jump down × left/right). Almost certainly worth tracking down. |
| `src/story/graph/graphSpark.swf`                                             | `graphSpark.fla` / `spark.fla`                                      | Sparkles while drawing graph                                                                                                              |
| `src/story/graph/Blink.swf`, `Blink Tall.swf`, `Blink Wide.swf`              | `Blink.fla` / `graphFlash.fla`                                      | Graph countdown blink effect                                                                                                              |
| `src/story/graph/displacementOrb/orbEFFECT.swf`, `velocityOrb/orbEFFECT.swf` | `orb_effect.fla` / `displacementOrb.fla` / `velocityOrb.fla`        | Spinning triangles around the orb                                                                                                         |
| `src/story/misc/hitEffect.swf`                                               | `hitEffect.fla` / `redCircle.fla`                                   | Red circle that grows + fades when player hits a graph obstacle                                                                           |

### Tier 3 — medium payoff (looks like static or near-static art)

These are likely single-frame or very short loops; JPEXS extraction usually works fine, but `.fla` is nicer if available.

| Group                 | Examples                                                                                                   | Likely `.fla` candidates                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Level backgrounds     | `leveld1_bg.swf`, `levelv1_bg.swf`, `levelm1_bg.swf`, `levelTD_bg.swf` etc. (14 total)                     | `leveld1.fla`, `world1_bg.fla`, `bg_*.fla`      |
| Glow effects          | `Glow_Effect_reddishorange.swf`, `Glow_Red_dbl_height.swf`, `Glow_Yellow_*.swf`                            | `glow.fla` / `graph_bg.fla`                     |
| Orb origins / pickups | `displacementOrb/justORB.swf`, `velocityOrb/justORB.swf`, `ORBpicked L/R.swf`, `pointer.swf`, `origin.swf` | `orb.fla` / `pickup.fla`                        |
| Switch art            | `switch_mode_1.swf`, `switch_mode_2.swf`                                                                   | `switch.fla`                                    |
| Obstacles             | `Obstacle.swf`, `Portal.swf`, `obs_vert80.swf`, `obs_vert140.swf`, `obs_vert200.swf`, `obs_horz160.swf`    | `obstacle.fla` / `portal.fla`                   |
| Hint signs            | `hints/level_*_hint.swf`, `level_hintsign.swf`                                                             | `hints.fla` / `hint_sign.fla`                   |
| Help icons            | `help/+S.swf`, `D.swf`, `L.swf`, `R.swf`, `pointRIGHT.swf`, `spacebar.swf`                                 | `help.fla` / `controls.fla`                     |
| Menu screens          | `instructions_screen.swf`, `credits_screen.swf`, `settings_screen.swf`                                     | `menu.fla` / `instructions.fla` / `credits.fla` |
| Exits                 | `exit.swf`, `exitcutscene.swf`, `placeholder_exit.swf`                                                     | `exit.fla`                                      |

### Tier 4 — don't need `.fla` for these (audio wrapped in SWF)

JPEXS will extract the embedded MP3 cleanly:

`src/story/bgm/world01.swf`, `world02.swf`, `world03.swf`, `menu.swf`, `cutscene01.swf`, and `src/story/sfx/graph/graph_draw.swf`, `sfx/player/player_sprint.swf`, `sfx/player/player_walk.swf`. Your `endgame.mp3` is already an MP3.

### How to use this list

Just send me the names (or the files themselves) of any `.fla` you can locate. I'll cross-reference against the embed targets in `legacy/src/AssetManager.as` and report which extractions to swap.

If you find **none** — that's fine, the JPEXS pipeline (Phase 2) handles all of it; the `.fla` files are an optimization, not a blocker.

### Located `.fla` sources (2026-05-07)

User dropped `.fla` files in `legacy/possible-fla-assets/` (renamed during Phase 0 from the original `possible fla assets/`). Cross-referenced and confirmed:

| `.fla` (in `legacy/possible-fla-assets/`) | → SWF target                                                                                                                      | Confirmed by        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `intro.fla` (10.4 MB)                     | `legacy/src/story/cutscenes/intro.swf` (247 KB) — `AssetManager.introCutScene`                                                    | name + size ratio ✓ |
| `pre_world1.fla` (8.1 MB)                 | `cutscenes/pre_world1.swf` (242 KB) — `AssetManager.preDisplacementCutScene`                                                      | ✓                   |
| `pre_world2.fla` (5.4 MB)                 | `cutscenes/pre_world2.swf` (132 KB) — `AssetManager.preVelocityCutScene`                                                          | ✓                   |
| `pre_world3.fla` (8.5 MB)                 | `cutscenes/pre_world3.swf` (123 KB) — `AssetManager.preMixedCutScene`                                                             | ✓                   |
| `ending.fla` (4.7 MB)                     | `cutscenes/ending.swf` (206 KB) — `AssetManager.endingCutScene`                                                                   | ✓                   |
| `Levelcomplete.fla` (4.2 MB)              | `misc/levelcomplete.swf` (59 KB) — `AssetManager.levelComplete`                                                                   | ✓                   |
| `Blink.fla` (20 KB)                       | `graph/Blink.swf` (0.1 KB) — `AssetManager.graphFlash` _(also re-export at scale to cover `Blink Tall.swf` and `Blink Wide.swf`)_ | ✓                   |
| `graphSpark.fla` (30 KB)                  | `graph/graphSpark.swf` (0.6 KB) — `AssetManager.graphSpark`                                                                       | ✓                   |

**TBD — needs visual inspection in Adobe Animate:**

- `levelcompleteII.fla` (485 KB) — strongest candidate for `misc/levelcomplete_cutscene.swf` (currently a 0.7 KB stub in the source tree, referenced as `AssetManager.levelComplete_CutScene` for cutscene-level wins). If it's a distinct visual, this is our source.
- `levelcompleteII-2.fla` (256 KB) — likely an earlier draft of the above.
- `Levelcomplete + ending.fla` (11.6 MB) — possible master file containing both timelines; can ignore once the split FLAs are confirmed working.

**Older drafts (skip — we use the larger labeled versions):**

- `introwolabels.fla` (908 KB) — early intro without scene labels
- `Endingcutscene.fla` (256 KB) — early ending draft

**Still missing — falls through to JPEXS extraction:**

- `avatarSheet.fla` (Tier 2 — player sprite sheet; will be the trickiest extraction)
- `hitEffect.fla`, `orbEFFECT.fla` (Tier 2 small loops)
- `gambitlogo.fla` (small splash, easy to extract)
- All Tier 3 art (level backgrounds, glow effects, orb pickups, switches, obstacles, hint signs, help icons, menu screens)

### Larger archive located in MIT Dropbox (2026-05-07)

`C:\Users\Eric Klopfer\MIT Dropbox\Eric Klopfer\Game Preservation\Source\Flash\Waker\` contains the **complete authoring archive** — every cutscene FLA, the avatar sprite sheet sources, level backgrounds, orb art, glows, switches, etc. Notable finds:

| Path under `Waker/Art/`                                                       | What it is                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Characters/Character animation/AVATAR_Collision Detection/SPRITESHEETII.fla` | **Canonical avatar sprite sheet source** (with `SPRITESHEET.fla` as the original iteration)                                                                                                                                               |
| `Characters/Character animation/{Idle,Run,Walk,Jump}/`                        | Per-state avatar FLAs — `graftIDLEanimation.fla`, `graftRUNanimation.fla`, `graftJumpUP.fla`, `graftJumpDOWN.fla`, `graftJumptransition.fla`, with `withONLYorb` and `WITHOUTobject` variants matching the in-game avatar-with-orb states |
| `Characters/Character animation/Wisps/`                                       | Wisp animations (`wisp_stoned.fla`, `wisp_upontouching.fla`)                                                                                                                                                                              |
| `Environment concept/Interactive/`                                            | `graphSpark.fla`, `Blink.fla`, `Glow_Velo.fla`, `Disp orb + Origin.fla`, `Teleporter + Wisp.fla`, `VELO Orb pickedup.fla`, ORB / DISPLACEMENT PAD activational-object FLAs                                                                |
| `Environment concept/Abstract/` and `N Backgrounds/`                          | Multiple level background FLAs (W1, W2, W3 sets, multiple revisions)                                                                                                                                                                      |
| `Environment concept/Non-interactive/Abstract/level completion.fla`           | Possible source for `misc/levelcomplete.swf`                                                                                                                                                                                              |
| `CUTSCENE/`                                                                   | `intro.fla`, `pre_world1/2/3.fla`, `Levelcomplete + ending.fla` (duplicates of `legacy/possible-fla-assets/`)                                                                                                                             |
| `Abstract Cut Scenes/`                                                        | Older cutscene drafts                                                                                                                                                                                                                     |
| `For programmers/Art Sprite/{IDLE,JUMP,RUN} swf/`                             | **Per-state SWFs** ← can be JPEXS-extracted directly as a fallback if `legacy/src/story/sprite/avatarSheet.swf` doesn't decompose cleanly                                                                                                 |

### Operational note: no Adobe Animate available

User does not have Adobe Animate installed, so **`.fla` files cannot be re-exported by us directly.** This changes the asset-pipeline strategy:

- **Primary path: JPEXS extraction of `legacy/src/story/*.swf`** — unchanged from §13 Phase 2. Handles every asset the game actually references.
- **FLAs become reference-only.** They document the original artwork and timeline structure but don't feed the pipeline.
- **Per-state avatar SWFs** in `MIT Dropbox/.../For programmers/Art Sprite/{IDLE,JUMP,RUN} swf/` are a **direct fallback** if extracting the consolidated `avatarSheet.swf` produces a messy output — these per-state SWFs map 1:1 to the `currentState` values (`faceRight`, `runLeft`, `jumpUpRight`, etc.) in `avatarImage.mxml`.

**Escalation paths if JPEXS quality is insufficient for a given asset:**

1. **Animate 7-day free trial** — temporary install to re-export the problem cutscene(s) from FLA, then uninstall. Probably worth it for the four pre-world cutscenes (`intro.swf`, `pre_world1/2/3.swf`, `ending.swf`) if vector content rasterizes oddly.
2. **Per-state SWF substitution** for the avatar specifically (see above).
3. **`character walk sizes.fla` and similar exploration FLAs** are skipped — they were sizing/iteration files, not production sources.

### Lessons learned from the avatar extraction (apply to any future animation pull)

These bit us during the first Phase 3 milestone and burned ~30 minutes diagnosing each one. Future animation work — the wisp, the orb effects, switch art, the levelcomplete cutscene rerun, anything else with a frame-based MovieClip — should start from this checklist.

> **Meta-rule (every bug we hit reduced to this one):** **default to JPEXS sprite mode for everything visual.** Frame mode and tile crops composite onto the SWF's stage background (often opaque white or grey) and pad the output with the full stage dimensions around a small character figure. Sprite mode renders each `DefineSprite` onto a transparent canvas at its own tight bounding box. Use frame/tile mode *only* when no `DefineSprite` exists for what you need.

1. **Default to `-export sprite -format sprite:png`, not `-export frame`.** Frame mode composites the main timeline onto the SWF's stage background — which is *not* transparent in most of these SWFs (often a default grey). Sprite mode renders each `DefineSprite` onto a transparent canvas at its own tight bounding box, which is almost always what we want.

2. **Audit the SWF's sprites before extracting.** Run JPEXS sprite mode once and look at frame counts + dimensions per `DefineSprite_<id>` (or `DefineSprite_<id>_<class>` if the SWF was built with named symbols). The right one is usually obvious from the frame count alone — for the avatar, 44 frames was walk, 10 was run, 208 was idle, all in the consolidated `avatarSheet.swf`.

3. **Pin the chosen sprite by name, don't just take the largest.** "Largest by frame count" is right for single-purpose SWFs (per-state idle/run/jump) but wrong for consolidated sheets that pack several animations. The script supports `spriteName` to pick by class or `DefineSprite_<id>` directly.

4. **Compiled "stub" SWFs aren't self-contained.** SWFs in `For programmers/Art Sprite/` are 200-500 byte stubs that load external bitmaps at runtime — JPEXS extraction returns near-empty PNGs from them. The real self-contained SWFs are typically in the authoring folders (`Characters/Character animation/{Idle,Run,Jump,Walk}/`). Sanity-check by file size: < 1 KB is suspicious; the working ones are 5-50 KB.

5. **Same MD5 = same sprite, alias as `flipHorizontal`.** When the LEFT and RIGHT variants of a state extract to byte-identical PNGs, the artist authored one direction and intended a runtime flip. Drop the duplicate and represent the L variant as a `flipHorizontal: true` reference; the engine sets `PIXI.Sprite.scale.x = -1` at render time and adjusts anchor.x to keep position stable.

6. **Don't try to force every state to the same width or height.** Frame bounding boxes vary across states because the character pose varies (idle compact, walk wider, run widest, jump tallest). Use a single uniform `sprite.scale.set(s, s)` value and anchor the sprite at bottom-center (`anchor.set(0.5, 1)`) so feet stay grounded across state changes. Width/height clamping looks worse — it makes the run pose tiny and the idle huge.

7. **`libx264 + yuv420p` requires even dimensions.** When you're piping JPEXS PNG frames into ffmpeg for an MP4 (cutscenes), pad to even with `-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:black"`. JPEXS sprite renders are very often odd-dimensioned (intro was 822×623, ending 855×983) and ffmpeg silently produces a 0-byte file otherwise.

8. **Pick the LAST frame for "static" extraction of multi-frame splash logos.** `gambitlogo.swf` produces a 200-frame fade-in sequence; the canonical static still is the fully-faded-in last frame, not the empty first frame. The curate script already does this.

9. **For "held-pose" states with no real animation, look for a 1-frame DefineSprite in the consolidated sheet first; fall back to a tile crop only if none exists.** `graftJumpUP.swf` (the per-state authoring SWF) is the *with-orb* master and only has 2 internal frames — playing it at 24 fps gives a flicker that toggles the orb on and off twice per second. `avatarSheet.swf` packages the same poses two ways: 1-frame *named* `DefineSprite`s (sprite mode → transparent + tight bounds) AND a 400×1000 main-timeline composite (frame mode → opaque white background + 200×200 padded tiles). Always prefer the sprite-mode 1-frame DefineSprite — for jumps that meant `DefineSprite_180` (jumpup, 186×273) and `DefineSprite_184` (jumpdown, 183×299). Tile-mode crops should be a *last resort* when no named sprite exists, because they inherit the same opaque-stage-background problem that frame-mode animation crops have. `tools/extract-avatar.mjs` supports both via `spriteName: '...'` (preferred) and `tile: {x, y, w, h}` (fallback).

---

## 16. References

- **PixiJS v8:** https://pixijs.com
- **@pixi/filter-glow:** https://filters.pixijs.io
- **Howler.js:** https://howlerjs.com
- **GSAP:** https://gsap.com
- **JPEXS Free Flash Decompiler:** https://github.com/jindrapetrik/jpexs-decompiler
- **Ruffle (SWF emulator, reference only):** https://ruffle.rs
- **Vite:** https://vitejs.dev
- **Vitest:** https://vitest.dev
- **Playwright:** https://playwright.dev
- **Web Audio API (`OscillatorNode`):** https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode

---

## Appendix A — Suggested `CLAUDE.md` skeleton

A short version of this document, edited for direct prompting use, lives at the repo root. Suggested contents:

```
# Project conventions for Claude Code

## Goal
Port [GAME NAME] from AS3/MXML (in /legacy) to TypeScript + PixiJS (in /src),
preserving gameplay behavior. Visual parity is "feels the same," not pixel-perfect.

## Stack
- TypeScript strict mode, ES modules
- PixiJS v8 for rendering
- Howler.js for audio
- GSAP for tweening
- Vite + Vitest + Playwright

## Don'ts
- Don't add React / Vue / Svelte without asking.
- Don't reach for new dependencies without flagging it.
- Don't preserve Flex MXML data-binding semantics; use plain DOM.
- Don't write CommonJS; ES modules only.

## Translation glossary
[paste §6 here]

## Per-module porting protocol
1. Read the source `.as` file in /legacy.
2. Restate, in 3–5 lines, what the class is responsible for.
3. List Flash/Flex APIs it touches and the planned web replacements.
4. Write the TS module in /src under the equivalent path.
5. Add or update tests in /tests.
6. Append an entry to CONVERSION_LOG.md.

## Style
- Naming: PascalCase classes, camelCase members, SCREAMING_SNAKE for constants.
- File-per-class, file name matches class.
- Public API always typed; no implicit `any`.
```

---

## Appendix B — Things that look easy but aren't

A short list of papercuts to watch for:

- **Bitwise ops on `int` vs `uint`.** AS3 distinguishes; JS `number` doesn't. The `>>>` operator and explicit `| 0` truncation will rescue most cases.
- **Default values for class members.** AS3 zero-initializes; TS strict-init requires explicit defaults. Pre-emptively initialize all fields.
- **`Event.bubbles`.** Bubbling display-list events have no automatic equivalent. Most games don't depend on bubbling, but search the codebase for `bubbles = true` to be sure.
- **`stage.frameRate`.** A global property in Flash; in web, you control this via `requestAnimationFrame` cadence. Anything that read `stage.frameRate` becomes a config constant.
- **Frame-locked sounds.** Audio scheduled relative to enter-frame events drifts under variable web framerate. Schedule via Howler or Web Audio time, not frame count.
- **Color values.** AS3 uses 0xRRGGBB integers everywhere; PixiJS accepts the same in v8. Just be aware that any code mixing color ints with alpha needs review.
- **`describeType` reflection.** Often used for serialization. Replace with explicit serialization methods or a registry.
- **MXML `<mx:Repeater>` / `<s:DataGroup>` patterns.** These don't translate without choosing a framework. List every one and decide per case.
