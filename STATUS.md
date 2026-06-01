# Session handoff status

Last updated: 2026-05-22. Pick this up cold by reading top-to-bottom.

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

**Boots into the main menu** (`guiMenuBG` with Start / Instructions /
Settings / Credits). Start → intro video (first time) → the level chain
starting at `cutsceneDisplacement`. Instructions / Credits / Settings
open over the menu; click or Esc closes them. The full menu flow is
browser-verified (commit `78b1373`).

**World 1 is complete and chained**: `cutsceneDisplacement` →
`displacement0` (the tutorial) → `1` → `2` → `3`. Beating the exit plays
the "wisp obtained" `levelcomplete.mp4` cutscene (+ `sfxWin`), then
auto-advances (click/space skips). After d3 the chain runs
`cutsceneVelocity` → World 2. d0 has a spawn input-lock so the avatar
drops straight down (no drift onto an upper platform) when arriving from
the cutscene with an arrow held.

**World 2 (velocity) complete (build)**: `velocity0`→`1`→`2`→`3` are all
built and chained (`V0`–`V3` debug picker buttons). v0/v1 playtested
working; **v2/v3 are first-pass, pending playtest**. velocity3 is the
first MIXED-type level (a velocity orb + a displacement orb).

**World 3 (mixed) complete (build)**: `mixed0`→`1`→`2`→`3` built and
chained (`M0`–`M3` debug picker buttons). Browser-verified all four load
cleanly on easy and hard. **First-pass calibration** — uses legacy
coordinates verbatim; expect playtest tuning for orb/exit reachability,
graph-obstacle placement, switch-platform geometry, and hard-mode sweep
speeds. mixed3 (`Settings.gameEnds`) is terminal: `nextLevel` is unset
until the `gameending` video lands.

**Cutscenes** are no-orb "walk-across" levels (flat floor; auto-advance
on reaching the exit, no win overlay). `cutsceneDisplacement` /
`cutsceneVelocity` / `cutsceneMixed` are wired into the chain; `CD` /
`CV` / `CM` debug-picker buttons jump to each. They carry **voice-over
narration** (voCS1/2/3) over the `bgmCutscene01` music; the world-1
narration starts on the intro video, continues through the walk-across,
and is cut when d0 begins. `cutsceneVelocity` shows a pulsing **"Hold
SHIFT to sprint!"** caption (`cutSceneHint`) — sprint is essential for
plotting velocity graphs.
Velocity orbs plot the avatar's `vx`, use the gold/red `velOrb` art, and
have no origin holder. velocity1 is the first level with a
**per-difficulty collision swap** (hard vs easy PNG). v0's background is
a cool blue/lavender velocity scene (`bgWorld2_1`=`levelv1_bg`) — that's
faithful to the original (confirmed), not a bug.

**Collision note (2026-05-22):** the "avatar walks through steep
drawn-curve walls" report was chased hard. Outcome: the capsule
`solidAt` (`f8118ef`) already stops *near-vertical* drawn walls (the real
case); a slope-analysis rework (`d4e5823`) regressed displacement
(clouds-above mis-read as walls) and was **reverted** (`8734235`). No
collision rework shipped. See `docs/collision-model.md` for the full
legacy-vs-port collision analysis and why the original has no
wall-vs-ramp logic.

Controls:

- Arrows: walk left / right
- `S` or `Shift`: sprint
- `Space` or `↑`: jump
- `D`: pick up / drop the orb
- `R`: restart current level (emergency escape if you wedge yourself)

Plus the **development chrome**, all gated by `SHOW_DEBUG_UI` in
`main.ts` (currently `true`; flip to `false` to hide it all). Before
flipping it off we need the **in-game pause menu** (Esc → options) so
players keep mute + difficulty without the debug UI.
- Top: controls banner.
- Bottom-right: `♪ MUSIC` / `♪ SFX` mute toggles (Pixi-side).
- Bottom-left: `DEBUG: [D0..D3] [V0..V3] [CD] [CV] [CM]` level picker
  (jump to any level for testing).
- Bottom-left next to picker: `DIFF: EASY/MEDIUM/HARD` button that
  cycles difficulty and reloads (the menu's Settings screen does this
  too — and now also has Music/SFX toggles).

**Tests**: `npm run test` → 138/138 passing.
**Build**: `npm run build` → ~676 KB bundle / 285 KB gzipped.

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
| 4 | **Game logic port** | 🟡 nearly done — all 3 worlds + cutscenes built and chained; remaining: ending video, playtest calibration of v2/v3 + mixed |
| 5 | UI port (menu, options, HUD) | 🟡 in progress — main menu + instructions/credits/settings + intro video + boot flow done; pause menu + studio splash + ending video pending |
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
| 13 | Per-level files in `src/levels/` | ✅ 11/11 gameplay levels (d0–d3, v0–v3, **mixed0–3**) + 3 cutscenes wired; mixed3 is the terminal "gameEnds" level (nextLevel UNSET pending the ending video) |
| 14 | `LevelManager.ts` | ✅ done — win-overlay SPACE transitions, cutscene auto-advance, debug `advanceTo`; `start()` disposes the old level + starts new audio |
| 15 | HUD (in-game pause/hint/HUD) | 🟡 menu chrome is HTML now; in-game pause menu (Esc during play) + `MuteControls`/`LevelPicker` Pixi placeholders still pending |
| 16 | Menus (Menu, Options, Instructions, Credits) | ✅ done — `src/ui/{MainMenu,ImageScreen,DifficultyScreen}.ts` HTML overlay; settings = difficulty selector + Music/SFX on/off toggles |
| 17 | `Woosh2.mxml` (splash + intro cutscene gate) → main.ts | 🟡 boot → menu → Start → intro video (`src/ui/VideoOverlay.ts`) → chain done; studio splash logos + ending video pending |
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

## 3.2 What the 2026-05-22 session accomplished

Finished World 2 (build), added the cutscene scene-type + full level
chain, and built the Phase 5 menu system + boot flow.

**Shipped (newest first):**

- **Menu system + boot flow** (`78b1373`) — boots into the main menu
  instead of auto-loading a level. `src/ui/MainMenu.ts` (4 image
  buttons w/ mouse-over swaps), `ImageScreen.ts` (Instructions +
  Credits full-screen images), `DifficultyScreen.ts` (settings =
  Easy/Medium/Hard selector), `IntroVideo.ts` (intro.mp4 after the
  Start gesture). Overlays stacked by z-index (menu 1, screens 10,
  intro 20). Browser-verified: menu render, all four buttons, Esc +
  backdrop close, difficulty art swap, Start→intro→chain.
- **Cutscene scene-type + chain** (`c12459b`) — `LevelConfig.isCutScene`
  marks no-orb walk-across levels that auto-advance on exit (no win
  overlay/SFX). `cutsceneDisplacement/Velocity/Mixed` wired into the
  chain: cD→d0…d3→cV→v0…v3→cM (mixed unbuilt, dead-ends at cM).
- **velocity2 + velocity3** — World 2 complete (build). v3 is the
  first mixed-type level (velocity + displacement orb). Pending
  playtest calibration.

- **Menu/cutscene polish** (`8ee82d2`) — post-menu fixes: (1) the DIFF
  readout now live-updates via `LevelManager.onDifficultyChange()` (was
  stale after the options screen changed it); (2) options screen got
  Music / Sound-Effects ON/OFF toggles wired to `Audio` mute (ports
  `soundOptions.mxml`); (3) `cutsceneDisplacement` plays the narrated
  `bgmCutscene01` story track (was silent `bgmWorld1`); (4) **win flow
  reworked** — Level fires a single `onComplete`; LevelManager presents
  the `levelcomplete.mp4` "wisp obtained" animation (silent video +
  `sfxWin`) via `winPresenter`, then auto-advances (click/space skips).
  Cutscenes advance instantly; terminal levels keep the SPACE-restart
  fallback. `IntroVideo.ts` → reusable `VideoOverlay.ts`.

- **Cutscene narration + d0 spawn lock** (`f7d2281`, `7c783e9`) — cutscenes
  play their voice-over (`Audio.playVo` one-shot, de-duped by key;
  `LevelConfig.voKey`): voCS1 (skyintro) for world 1, voCS2 (earthintro)
  for world 2, voCS3 (starintro) for world 3, over the `bgmCutscene01`
  music. Boot-time narration uses TWO tracks: `voIntro` (gameintro.mp3)
  plays on the intro video (started in `main.ts` when the player clicks
  Start); the walk-across cutscene then switches to `voCS1` (skyintro.mp3)
  via its `voKey`. `Audio.playVo()` auto-stops the previous key on key
  change, so the handoff is clean. d0 stops VO entirely (`Level.startAudio`
  calls `stopVo()` on any non-cutscene level). Added
  `LevelConfig.lockInputUntilGrounded` (set on d0):
  the avatar drops straight down from spawn (movement input ignored, vx
  pinned 0) until it lands, so an arrow held over from the walk-across
  cutscene no longer drifts it onto an upper platform.

- **Narration timing + velocity tone + debug flag + sprint hint**
  (`7c783e9`, `12536d5`, `5e55536`) — narration now starts on the intro
  video and cuts at d0 (see above). Softened the velocity graph tone
  (EMA-smoothed `|vx|`, capped to the lower ~55% of the pitch range —
  `VEL_TONE_SMOOTHING`/`VEL_TONE_RANGE` in `Level.ts`) so it's soothing,
  not a shrill TV-test-pattern. Added `SHOW_DEBUG_UI` (one switch for all
  dev chrome) and `LevelConfig.cutSceneHint` ("Hold SHIFT to sprint!" on
  `cutsceneVelocity`).

All three narrated cutscenes share one music bed (`bgmCutscene01`) — the
per-cutscene `cutScene02/03` *music* variants weren't extracted, but the
distinct narration tracks (voCS1/2/3) are wired.

---

## 3.3 The home stretch — what's left

All **11 gameplay levels** (d0–d3, v0–v3, mixed0–3) and the 3 cutscenes
are built and chained; the menu / options / narration / win-cutscene /
boot flow is in. Remaining work, roughly in order:

1. **Game ending** — after mixed3, play `ending.mp4`
   (`endingCutSceneClass`) via the existing `VideoOverlay`, switch to
   `bgmEndGame`, then return to the menu. Wire `mixed3.nextLevel`.
2. **In-game pause menu (Esc → options)** — resume / restart / quit +
   mute + difficulty, per legacy `gui.mxml`. **Prerequisite for hiding the
   debug UI**, since today the only in-game mute/difficulty controls are
   the debug chrome.
3. **Flip `SHOW_DEBUG_UI` to `false`** once #2 lands; remove the
   `LevelPicker`/`MuteControls`/`DifficultyPicker` placeholders.
4. **Studio splash logos** (gambit → poof) at boot, before the menu
   (legacy `Woosh2.mxml` runAnimation).
5. **Playtest calibration pass** — v2/v3 + all of mixed0–3 are first-pass
   (untested in real play). Check orb/exit reachability, switch-platform
   geometry, hard-mode sweep timing, graph-obstacle distribution.
6. **Phase 6/7** — cross-browser, perf/bundle, optional mobile, release.

Nice-to-haves: D3 hazard polish (squish-pushback, spike hit-flash);
per-cutscene music variants if the `cutScene02/03` tracks are ever
extracted.

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
  done; `velocity0` (calibrated) + `velocity1` (first-pass) shipped and
  chained. **Next: velocity2, 3**, then chain d3 → v0.
  - **velocity1** ✅ built + chained from v0. First per-difficulty
    collision swap (`groundKey` branches on difficulty inside the
    `LevelBuilder`). Pending playtest calibration (orb/exit
    reachability, hard spike-sweep timing). See calibration §7.
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
| ~~Per-difficulty collision swap~~ ✅ | (velocity1) | **Done.** velocity1 returns a different `groundKey` per difficulty inside its `LevelBuilder` (`levelv1_collision` hard vs `levelv1_easy_collision` easy/med). The swap drives both the visible ground and the pixel collision. Pattern available for any future level. |
| ~~Cutscenes (chain framework)~~ ✅ | §14 item 13 / Phase 5, plan §432 | **Done.** `isCutScene` walk-across levels + intro `<video>`. Still missing: the `pre_world1/2` static-screen variant, `levelcomplete`/`ending` MP4s, studio splash logos. |
| ~~Main menu~~ ✅ | §14 item 16 / Phase 5 | **Done** (`MainMenu.ts`, HTML overlay). Debug Pixi level/diff pickers still present for testing; remove before release. |
| ~~Options / Instructions / Credits~~ ✅ | §14 item 16 / Phase 5 | **Done** (`ImageScreen.ts` + `DifficultyScreen.ts`). |
| **Pause menu (Esc)** | §14 item 5 (`game/PauseMenuController`) | Esc currently only closes open menu screens; no in-game pause/resume/quit menu yet (legacy `gui.mxml`). |
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
| `docs/collision-model.md` | Legacy vs. port avatar↔terrain collision (edge-point pixel push-out vs. groundYBelow + slope analysis). **Read before reworking collision** — explains why the original has no wall-vs-ramp logic. |
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
npm run test              # should be 138/138
npm run dev               # confirm boot → menu → chain still plays
```

If all 5 pass and the level chain plays (use the debug level picker
to spot-check each), you're good to start on §4 above. If anything
fails, that's the first thing to fix.
