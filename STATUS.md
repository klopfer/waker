# Session handoff status

Last updated: 2026-05-20. Pick this up cold by reading top-to-bottom.

This file is the "what to do next" doc. It captures live context that
isn't in the plan or the calibration doc — recent decisions, next
steps, open questions.

When something here becomes stale or wrong, update it. When you finish
a "next step," check it off and add a new one. Keep it short.

---

## 1. What's playable right now

```bash
npm install   # if first time
npm run dev   # http://localhost:5173
```

**World 1 is complete and chained**: boots into `displacement0` (the
tutorial); beating the exit advances on SPACE to `displacement1` → `2`
→ `3`. After d3 the SPACE press currently restarts d3 (legacy next is
`cutsceneVelocity`, not wired yet).

**World 2 (velocity) started**: `velocity0` is playable and calibrated
(reach it via the `V0` debug picker button). It is **not yet chained**
from d3 — and v1/v2/v3 aren't built. Velocity orbs plot the avatar's
`vx`, use the gold/red `velOrb` art, and have no origin holder (they
rest on the ground).

Controls:

- Arrows: walk left / right
- `S` or `Shift`: sprint
- `Space` or `↑`: jump
- `D`: pick up / drop the orb
- `R`: restart current level (emergency escape if you wedge yourself)

Plus three debug UIs on screen:
- Bottom-right: `♪ MUSIC` / `♪ SFX` mute toggles (Pixi-side, will move
  to the HTML overlay in Phase 5).
- Bottom-left: `DEBUG: [D0] [D1] [D2] [D3] [V0]` level picker buttons
  (jump to any level for testing; **temporary**, remove before release).
- Bottom-left next to picker: `DIFF: EASY/MEDIUM/HARD` button that
  cycles difficulty and reloads the current level — used to verify
  hard-mode spike placements without waiting for the Phase 5 menu.

**Tests**: `npm run test` → 137/137 passing.
**Build**: `npm run build` → ~668 KB bundle / 283 KB gzipped.

---

## 2. Where we are in the broader plan

The plan is `flash-to-html5-conversion-plan.md`, 7 phases. Current
status:

| # | Phase | Status |
| --- | --- | --- |
| 0 | Discovery + repo reorg + CLAUDE.md | ✅ done |
| 1 | Vite + PixiJS scaffold + smoke test | ✅ done |
| 2 | JPEXS asset extraction + curation | ✅ done — 181 manifest entries, ~14 MB committed |
| 3 | Engine layer (FixedStep, Input, HitTest, Audio, GraphTone, AssetLoader, MovieClipShim) | ✅ done — 8/8 modules + avatar |
| 4 | **Game logic port** | 🟡 in progress — world 1 complete, worlds 2+3 pending |
| 5 | UI port (menu, options, HUD) | ⏳ |
| 6 | Testing + polish (cross-browser, mobile, perf) | ⏳ |
| 7 | Release prep | ⏳ |

### Phase 4 progress

Mapped against the plan's `§14 Module porting order`:

| Order | Module | Status |
| --- | --- | --- |
| 1 | `types.ts` + `state.ts` (Color, Settings, etc.) | ✅ partial — `engine/types.ts` exists; Color/Settings still inline |
| 2 | `HitTest.ts` | ✅ done |
| 3 | `AssetManager` → `engine/AssetLoader.ts` + manifest | ✅ done |
| 4 | `Audio.ts` + `GraphTone.ts` | ✅ done — wired into Level via startAudio() on first user gesture |
| 5 | `Input.ts` | ✅ done |
| 6 | `Avatar.ts` + `AvatarSprites.ts` | ✅ done |
| 7 | `GraphObstacles.ts` (procedural spike placement) | ⏳ not started — needed for hard-mode levels |
| 8 | `Graph.ts` | ✅ done |
| 9 | `Orb.ts` | ✅ done |
| 10 | `Switch.ts`, `MovingPlatform.ts`, `Spike.ts` | ✅ done (D1+D2); D3 polish (squish pushback + hit flash) still pending |
| 11 | `Level.ts` (base class) + `LevelConfig` data | ✅ done — multi-orb refactor; per-level files are pure data literals |
| 12 | `Movements.ts` | ✅ done + extensively calibrated (v1–v18) — see `docs/calibration.md` §9 |
| 13 | Per-level files in `src/levels/` | 🟡 5 of 11 wired (d0, d1, d2, d3, **v0**); velocity1–3, mixed*, cutscenes pending |
| 14 | `LevelManager.ts` | ✅ done — handles win-overlay SPACE transitions + debug `advanceTo` for the level picker |
| 15 | HUD (in-game pause/hint/HUD) | ⏳ — `src/ui/MuteControls.ts` + `LevelPicker.ts` are Pixi-side placeholders; Phase 5 moves to HTML overlay |
| 16 | Menus (Menu, Options, Instructions, Credits) | ⏳ |
| 17 | `Woosh2.mxml` (splash + intro cutscene gate) → main.ts | ⏳ |
| 18 | Delete vendored `gs/` (TweenMax) | n/a — not imported |

---

## 3. What this session accomplished (2026-05-18)

Started the day with displacement0 as the only wired level. Ended with
world 1 complete + a major collision-system improvement.

**Shipped (in order):**

- **Win detection** — exit-portal bbox overlap → "Level Complete /
  press SPACE" overlay, restart on SPACE.
- **Audio** — Howler BGM + SFX + Web-Audio GraphTone wired into Level
  on first user gesture.
- **Level abstraction** — `game/Level.ts` owns all per-level Pixi
  objects + tick logic. `LevelConfig` interface, `src/levels/*.ts`
  pure-data files. `main.ts` shrunk 785 → 102 lines.
- **D1 Spike** — procedural Pixi.Graphics art (`tempObs/Portal.png`
  was rasterized as fully-opaque). Static + horizontally/vertically
  oscillating motion variants.
- **Mute controls** — Pixi-side `♪ MUSIC` / `♪ SFX` toggles in
  bottom-right.
- **D2 Switch + MovingPlatform** — procedural panel + procedural
  rectangle platforms with `RectGround` AABB ground provider. Avatar
  rides platforms (carry logic), feet-inset on squish bbox so landing
  doesn't false-stop the platform.
- **E1 LevelManager + displacement1** — first transition wiring; SPACE
  on win overlay loads next level + starts its audio.
- **E2 multi-orb refactor + displacement2 + displacement3** —
  `LevelConfig.orbs: OrbSetupConfig[]` (was singletons). d2 + d3 each
  have two orbs (d3's second orb floats in mid-air, by legacy design).
- **Tunneling fix** — `groundYBelow` returns the band's top when the
  search start is INSIDE the band; `body.step` searches from
  `min(state.y, y_new)`. Stops the "jumped sideways INTO a curve"
  fall-through.
- **Debug level picker** — bottom-left `DEBUG: [D0] [D1] [D2] [D3]`.
- **R restart hotkey** — emergency escape from any state.
- **The d3 anti-alias saga** — see calibration.md §9 v15–v18 for the
  full play-by-play. Summary: the painted floor's anti-aliased top
  edge was tripping side-collision false-positives. The HUD-driven
  diagnosis revealed alpha=133 at one column vs alpha=75 at the
  neighboring column (binary threshold = 128). Final fix:
  `SIDE_BOTTOM_INSET = 4` lifts the lowest sample above the
  anti-alias band, which then unblocks the `isWallAt` overlap rule
  so curves at body height actually trap.

**Key recent commits** (newest first):

```
0fbac1e remove debug HUD + diagnose exports
efc5070 fix d3 stuck: SIDE_BOTTOM_INSET=4 + re-add overlap wall rule
971ac8c debug HUD: per-tick side-collision + step-up diagnostics
bf886d7 revert isWallAt body-overlap rule
8111bd7 isWallAt: treat body-overlap as wall (first attempt)
21e1741 d3 g1 yOffset 60 → 75
532f8db SIDE_TOP_MARGIN 8 → 10
84ff314 displacement3 polish: side-margin + raised g1 + R hotkey
1c3ed48 step E2: displacement2 + displacement3 + multi-orb refactor
9cb05de step E1: LevelManager + displacement1 + win transitions
0f012c2 step D2: Switch + MovingPlatform
c4f3eae step D1: Spike hazard
aa05d71 step C: refactor level wiring into game/Level.ts
9ffb254 step B: wire audio + GraphTone
be1e18e step A: win detection
```

---

## 3.1 What the 2026-05-20 session accomplished

Started E3 (velocity world). Shipped `velocity0` end-to-end + fixed a
cluster of side-collision bugs the world-2 geometry exposed.

**Shipped (newest first):**

- **Held-orb height** — `ORB_HELD_OFFSET_Y` -75 → -38. The old value
  was a retired-scale-0.3 constant; the orb floated a body-height above
  the head (lined up with the platform above on v0). Now rides on the
  head, matching legacy `invOrb.y = player.y`. Affects both worlds.
- **Step-up wall gate (v19b)** — step-up was committing `x = state.x +
  vx` and skipping side-push, so the avatar burrowed into walls on
  sloped/curved approaches (right wall: only tail showing; left wall:
  climbed then fell through the top; steep graph curves: phased
  through). Gated step-up on a clear leading-edge head band. Regression
  test verified to fail without the gate.
- **Edge-wall climb (v19a)** — the 3-sample ground catch picked a
  full-height edge wall's band-top (y≈0) and snapped the avatar to the
  screen top. Now rejects samples > `STEP_UP` above the feet.
- **velocity0** — two velocity orbs (gold/red `velOrb` art, no origin
  holder), hard-mode spikes, boundary clamp matching the legacy
  hard-stop. Calibrated to feel parallel to the original. See
  `docs/calibration.md` §7 (velocity0) + §9 v19.
- **Color-keyed** `velocityOrb/justORB.png` + `orbEFFECT.png`
  (white-sentinel `NEAR_WHITE` predicate in `tools/color-key-assets.mjs`).

**Commits:** `9bc44b0` (held-orb), `90c686d` (step-up gate),
`d7e73cc` (edge-wall + vel-orb art), `551f2de` (E3 start).

---

## 4. Next steps (priority order)

Suggested order — feel free to deviate.

### A. Win detection at the exit portal ✅ done (be1e18e)
### B. Audio integration ✅ done (9ffb254)
### C. Level abstraction ✅ done (aa05d71)
### D. Hazards ⚙️ partial
- **D1 Spike** ✅ done
- **D2 Switch + MovingPlatform** ✅ done (basic; squish-pushback
  deferred to D3)
- **D3 polish** — `obstaclesClass.mxml`-style player pushback when
  squished between platform + wall; programmatic red bloom at avatar
  on spike hit. Defer until a level actually needs the polish.
### E. Per-level files ⚙️ partial
- **E1 displacement1** ✅ done
- **E2 displacement2 + 3 + multi-orb** ✅ done
- **E3 velocity world ⚙️ in progress.** `valueMode: 'velocity'` flag
  done; `velocity0` shipped + calibrated. **Next: velocity1, 2, 3**,
  then chain d3 → v0.
  - **velocity1** (`legacy/src/levels/velocity1.mxml`) — `bgWorld2_2`;
    ground `levelv1_collision` (hard) vs `levelv1_easy_collision`
    (easy/medium) — note the per-difficulty collision swap, a first
    for the port (so far difficulty only added spikes). 1 velocity
    graph `addGraph(1,0,340,227,15,180,180,4,380,440,…)`. nextLvl=v2.
  - **velocity2** (`leveltv_collision`, `bgWorld2_t`) — 1 velocity
    graph w/ deadzones, scale=22; hard=7 spikes / medium=2 / easy=0.
    nextLvl=v3.
  - **velocity3** (`levelv3_collision`/`_medium`/`_easy`, `bgWorld2_3`)
    — **TWO graphs of different type**: one velocity `addGraph(1,…)`
    AND one displacement `addGraph(0,…)` in the same level (the port's
    first mixed-mode level — confirms the per-orb `valueMode` flag
    composes). nextLvl=cutsceneMixed.
  - **Per-level porting recipe**: read the `.mxml`, pngjs-sweep the new
    collision PNG(s) for floor/platform/wall bands, translate
    `addGraph`/`addSpike`/`setEntrance`/`setExit` to a `LevelConfig`,
    add a `VX` debug-picker button in `main.ts`, playtest-calibrate.
  - **Watch for**: velocity2's graph deadzones (graph regions where
    the curve is suppressed) — may need a `Graph` feature not yet
    built. Check `velocity2.mxml`'s addGraph arg list before starting.
- **Chain d3 → v0** — currently both are unchained (SPACE restarts).
  Two options: (a) wire `displacement3.nextLevel = velocity0` directly
  for a playable through-line NOW, or (b) wait for the cutscene slot
  (`cutsceneVelocity`) and route d3 → cutscene → v0. Recommend (a) as
  a stopgap with a `// TODO: insert cutsceneVelocity` note, so the
  worlds connect before Phase 5.
- **E4 mixed world** — mixed0–3. Combines displacement + velocity
  orbs; switches + moving platforms used heavily. velocity3 already
  proves the two orb types coexist in one level.
- **E5 cutscenes** — drop-in `<video>` players for the curated MP4s
  (`intro`, `levelcomplete`, `ending`). Already extracted under
  `src/assets/cutscenes/`.
### F. LevelManager + UI shell
- LevelManager exists; needs the **menu** layer (main menu, level
  select, options, instructions, credits) — Phase 5 / §14 items 15–16.
- Eventually replace `src/ui/MuteControls.ts` and `src/ui/LevelPicker.ts`
  with the proper HTML+CSS overlay.
### G. Difficulty selector ⚙️ debug-UI version done
- ✅ Each `src/levels/*.ts` exports a `LevelBuilder` function
  `(difficulty) => LevelConfig`. Hard-mode spikes from the legacy
  `displacement*.mxml` are wired (per-level: d0 has 1 static, d1
  has 1 horizontal, d2 has 2, d3 has 2).
- ✅ `LevelManager` tracks `currentDifficulty` + exposes
  `setDifficulty(d)` that re-runs the current builder + reloads.
- ✅ Debug `DIFF: EASY/MEDIUM/HARD` button cycles the difficulty
  on click.
- ⏳ Phase 5 work: real menu UI + persistence. The current button
  is a dev shortcut; the proper menu lands with §16.
### H. Phase 5/6 polish
Cross-browser pass, mobile touch controls, perf, accessibility, bundle
audit.

---

## 4.1 Missing features (gameplay built, these are not)

The core gameplay loop (move, orb pickup, graph draw, hazards,
switches, platforms, win/transition) is built and proven across 5
levels. What's still absent, roughly in dependency order:

| Feature | Where it lives in the plan | Notes |
| --- | --- | --- |
| **Remaining levels** | §14 item 13 | velocity1–3, mixed0–3 (7 levels). Pure data + calibration; engine should not need changes except possibly velocity2 graph deadzones. |
| **Per-difficulty collision swap** | (new, velocity1) | velocity1 is the first level that loads a *different collision PNG* per difficulty (`levelv1_collision` vs `levelv1_easy_collision`). `LevelConfig.groundKey` will need to be difficulty-aware — easiest via the `LevelBuilder(difficulty)` already in place (just return a different `groundKey`). |
| **Cutscenes** | §14 item 13 / Phase 5, plan §432 | `intro`, `pre_world1/2`, `levelcomplete`, `ending`. Drop-in `<video>` over the canvas. Cutscene "levels" (`introCutScene`, `cutsceneDisplacement/Velocity/Mixed`, `gameending`) are slots in the level chain. Needed to connect worlds the "real" way. |
| **Main menu + level select** | §14 item 16 / Phase 5 | Replaces the temporary Pixi level/diff pickers. Plain HTML+CSS overlay (decision D4). Includes the Ctrl+Shift+F12-style debug jump if we want parity. |
| **Options / Instructions / Credits** | §14 item 16 / Phase 5 | HTML overlay screens. |
| **Pause menu (Esc)** | §14 item 5 (`game/PauseMenuController`) | Esc is captured by Input but does nothing yet. |
| **In-game HUD / hint signs / win animation** | §14 item 15 | Hint signs + the win animation stay as Pixi children (decision D4); only the menu chrome is DOM. |
| **Splash / intro gate** | §14 item 17 (`Woosh2.mxml` → `main.ts`) | Title → splash → intro cutscene → first level. Ported LAST. |
| **Settings persistence** | Phase 5 | Difficulty, mute, progress (localStorage). Currently in-memory only. |
| **Difficulty selector UI** | §14 item 16 | Logic done (`LevelBuilder` + `setDifficulty`); needs the real menu (current button is a dev shortcut). |
| **Mobile / touch controls** | Phase 6, plan §11 | Stretch; orb+draw is thumb-awkward. Likely post-1.0. |
| **D3 hazard polish** | §4 D3 below | Squish-pushback when wedged between platform + wall; red bloom on spike hit. Deferred until a level needs it. |

---

## 5. Known asset issues (fix when relevant)

- ~~`spikeyObjects` (`tempObs/Portal.png`) has no transparent pixels~~
  **Resolved by going procedural.** `src/game/Spike.ts` draws the
  spike directly with `Pixi.Graphics` (dark blob silhouette + rotating
  brown spiral). No asset needed.
- ~~`tempObs/obs_*.png` have the same opaque-bbox issue~~ **Resolved
  by going procedural.** `src/game/MovingPlatform.ts` draws the
  platforms as `Pixi.Graphics` rectangles with a top highlight + bolt
  decorations.
- ~~Switch art (`switch_mode_*.png`)~~ **Resolved by going procedural.**
  `src/game/Switch.ts` draws a two-state panel with a green/orange
  indicator dot.
- **Painted-floor PNGs are anti-aliased.** Caused the d3 stuck saga;
  fix landed in v18 (`SIDE_BOTTOM_INSET=4`). When porting future levels,
  trust that the anti-alias band can extend 1-2 px above/below the
  "true" floor top — don't tighten side-sample range without leaving
  this slop.

---

## 6. Open questions / pending decisions

Stuff to think about before the relevant phase, not now:

- **Audio synth fidelity**: The legacy `GaverRingTone1` (Sonoflash)
  is a proprietary FM synth. Plan §10 Q3 calls for a single
  `OscillatorNode` approximation. Currently shipped; revisit if it
  feels flat — add a second oscillator + LFO for vibrato.
- **Mobile target**: Plan §11 Q1 left mobile as stretch. The orb +
  draw mechanic is thumb-control awkward. Probably defer to post-1.0.
- **Tutorial bg vs procedural prompts**: `LevelConfig.showHelpPrompts`
  defaults to false (no prompts). displacement0 doesn't need them
  (bg has them baked in); displacement1+ doesn't need them (player
  has learned). Future tutorial-style levels can opt in.
- **D3 next-level chain**: legacy displacement3 → `cutsceneVelocity`
  → velocity0. We don't have cutscene wiring yet; for now d3's
  `nextLevel` is unset (SPACE restarts d3). velocity0 now exists, so
  the stopgap (`d3.nextLevel = velocity0` directly, with a TODO for
  the cutscene) is unblocked — see §4 E3 "Chain d3 → v0". When
  cutscenes land, route d3 → cutsceneVelocity → v0.
- **`LevelManager.advanceTo` made public** for the debug level
  picker. When the picker is removed, decide whether to re-private it.

---

## 7. Map of the docs

| File | What it's for |
| --- | --- |
| `README.md` | "What is this project" — public-facing, mostly stable. |
| `flash-to-html5-conversion-plan.md` | The full conversion plan (7 phases, module porting order, decisions log). |
| `docs/calibration.md` | All physics + scaling constants, derivations, history. **Read this before tuning anything** in `Movements.ts` or per-level constants. |
| `CLAUDE.md` | Per-session conventions for Claude Code (style, do/don't, glossary). |
| **`STATUS.md`** (this file) | Live "what to do next" context. Update when you finish a chunk. |

---

## 8. Local-only artifacts (not in git)

- `legacy/screenshots/*.png` — Ruffle screenshots of the original
  game at known game states (cloud platforms, mid-jump, graph drawing,
  spike art, etc.). Used for calibration measurements. Re-create by
  opening `legacy/reference/waker.swf` in Ruffle at native size.
- Any local PixelGround scratch files in `tools/` — recreate with the
  pngjs sweep pattern (see `tools/measure-screenshots.mjs` for an
  example).

---

## 9. Pickup checklist

When starting a fresh session, run these in order:

```bash
git pull
npm install               # if dependencies changed
npm run typecheck
npm run lint
npm run test              # should be 137/137
npm run dev               # confirm world 1 still plays end-to-end
```

If all 5 pass and the level chain plays (use the debug level picker
to spot-check each), you're good to start on §4 above. If anything
fails, that's the first thing to fix.
