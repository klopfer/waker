# Project conventions for Claude Code

## Goal

Port **Waker** (project codename "Woosh2") from AS3/MXML in `legacy/src/` to TypeScript + PixiJS in `src/`. Visual parity is "feels like the original," not pixel-perfect.

The authoritative plan is [`flash-to-html5-conversion-plan.md`](flash-to-html5-conversion-plan.md). When this file and the plan disagree, the plan wins — update the plan rather than diverge.

## Stack (locked in §12 of the plan)

- TypeScript strict mode, ES modules
- PixiJS v8 + `@pixi/filter-glow` for rendering
- Howler.js for BGM / SFX / VO
- One Web Audio `OscillatorNode` for the graph-drawing tone (D3 — no Tone.js)
- GSAP 3 for tweening (replaces vendored `gs/TweenMax`)
- Vite + Vitest + Playwright + ESLint + Prettier
- Fixed 24 Hz simulation step decoupled from `requestAnimationFrame`

## Don'ts

- Don't add React / Vue / Svelte. UI is plain HTML+CSS over the canvas.
- Don't add Tone.js or other audio libs beyond Howler + raw Web Audio.
- Don't preserve Flex MXML data-binding semantics; use plain DOM.
- Don't use CommonJS; ES modules only.
- Don't edit anything under `legacy/` — it is the read-only baseline.
- Don't introduce new dependencies without flagging it first.
- Don't port modules out of the order in §14 of the plan.

## Layout

- `legacy/src/` — original AS3/MXML; read-only reference.
- `legacy/reference/waker.swf` — canonical build for Ruffle visual diffs.
- `legacy/reference/woosh-abstract-build.swf` — same code with the alternate `/abstract/` art set; archive only.
- `legacy/possible-fla-assets/` — FLA archive (Animate not required for the port; reference only).
- `legacy/legacy-extras/abstract/` — alternate art set (matches `woosh-abstract-build.swf`).
- `legacy/legacy-extras/levels_backup/` — older level versions; ignore for the port.
- `src/engine/` — framework: GameLoop, AssetLoader, Input, Audio, HitTest, FixedStep, MovieClipShim, GraphTone.
- `src/game/` — gameplay: Game, Avatar, Movements, Level, Graph, Switch, Spike, Orb, GraphObstacles, MovingPlatform.
- `src/levels/` — one .ts per original level (matching `legacy/src/levels/`).
- `src/ui/` — HTML overlay: Menu, Options, Instructions, Credits, Hud.
- `src/assets/` — post-extraction PNG/WebP/MP3/MP4 + `manifest.json`.
- `tools/` — build scripts (e.g. `extract-swf.mjs` JPEXS-driven asset pipeline).

## Translation glossary (Flash → Web)

| AS3 / Flash                                                  | Replacement                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `mx:Canvas`, `Sprite`, `MovieClip`, `DisplayObjectContainer` | `PIXI.Container`                                                                          |
| `Bitmap`, `BitmapData`, `mx.controls.Image`                  | `PIXI.Sprite` + `PIXI.Texture` (or `OffscreenCanvas` for pixel access)                    |
| `Shape`, `Graphics`                                          | `PIXI.Graphics`                                                                           |
| `Stage`                                                      | `PIXI.Application`                                                                        |
| `Event.ENTER_FRAME`                                          | `engine/FixedStep` (24 Hz simulation) + `requestAnimationFrame` for render                |
| `Event`, `EventDispatcher`                                   | typed emitter or `EventTarget`                                                            |
| `Timer`, `flash.utils.getTimer()`                            | frame counters; `performance.now()` only at boundaries                                    |
| `flash.media.Sound` / `SoundChannel` / `SoundTransform`      | `Howl` instances (BGM / SFX / VO)                                                         |
| `GaverRingTone1` (Sonoflash synth)                           | one `OscillatorNode` whose `frequency` is set per-tick from the curve y-value             |
| `Vector.<T>` / `mx.collections.ArrayCollection`              | `T[]`                                                                                     |
| `flash.geom.Point`, `Rectangle`                              | `{x,y}` / `PIXI.Point`, `PIXI.Rectangle`                                                  |
| `int`, `uint`, `Number`                                      | `number`                                                                                  |
| `[Embed(source="...")]`                                      | Vite import: `import url from './x.png'`                                                  |
| `[Bindable]` properties                                      | explicit setters; no reactive store                                                       |
| `GambitLib.HitTest.pixelsOverlap`                            | `engine/HitTest.ts` (OffscreenCanvas + AABB pre-filter; static masks baked at level load) |
| `gs.TweenMax.to(...)`                                        | `gsap.to(...)`                                                                            |
| `cursorManager.setCursor`                                    | CSS `cursor: url(...)`                                                                    |
| `trace()`                                                    | `console.log`                                                                             |

## Physics constants (preserve verbatim from `legacy/src/movements.mxml`)

At a 24 Hz fixed timestep, the original tuning is preserved as-is:

```
GRAVITY         = 2
JUMPSPEED       = 14.5
MAXFALLINGSPEED = -12
MAXRUNSPEED     = 12     (8 * 1.5 gameSpeed)
WALKINGSPEED    = 6      (4 * 1.5)
RUNSPEED        = 0.3    (0.2 * 1.5)
RUNBRAKE        = 1.5    (1 * 1.5)
```

## Per-module porting protocol

1. Read the source `.as` / `.mxml` in `legacy/src/`.
2. Restate, in 3–5 lines, what the class is responsible for.
3. List the Flash/Flex APIs it touches and the planned web replacements.
4. Write the TS module in `src/` under the equivalent path.
5. Add or update a Vitest test for any non-trivial logic.
6. Append an entry to `CONVERSION_LOG.md` (source path → dest path, deviations, tricky bits).

Order is fixed in §14 of the plan (leaves first).

## Style

- PascalCase classes, camelCase members, SCREAMING_SNAKE for constants.
- File-per-class; file name matches class.
- Public API always typed; no implicit `any`.
- Default to no comments. Add one only when the WHY is non-obvious.
