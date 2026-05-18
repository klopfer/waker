# Session handoff status

Last updated: 2026-05-10. Pick this up cold by reading top-to-bottom.

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

Boots into **displacement0** (the tutorial — the original game's actual
level 1). Controls:

- Arrows: walk left / right
- `S` or `Shift`: sprint
- `Space` or `↑`: jump
- `D`: pick up / drop the orb

Gameplay loop currently working:

1. Avatar drops in from upper-left, lands on the bottom-floor cloud.
2. Player has to climb a 4-step painted-cloud staircase by jumping
   (the leftmost-cloud → orb-stand jump is now well-calibrated).
3. Walk to the orb sitting in its origin stand at (300, 321), press
   `D` to pick it up.
4. Walk around. As you move, a green displacement curve plots in the
   graph rect (upper-right corner of the level).
5. Press `D` again to drop. The curve solidifies into a black walkable
   platform at the same world coordinates.
6. The platform should now bridge you toward the exit portal at the
   upper-right corner (no win detection yet — reaching it does nothing).

Walking on / under / up / down jagged player-drawn curves all works as
of calibration v14 — see `docs/calibration.md` §9 for the full journey.

**Tests**: `npm run test` → 84/84 passing.
**Build**: `npm run build` → 639 KB bundle / 275 KB gzipped.

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
| 4 | **Game logic port — Phase 4 step 5 complete + extensive polish** | 🟡 in progress |
| 5 | UI port (menu, options, HUD) | ⏳ |
| 6 | Testing + polish (cross-browser, mobile, perf) | ⏳ |
| 7 | Release prep | ⏳ |

### Phase 4 progress

Mapped against the plan's `§14 Module porting order`:

| Order | Module | Status |
| --- | --- | --- |
| 1 | `types.ts` + `state.ts` (Color, Settings, etc.) | ✅ partial — `engine/types.ts` exists; Color/Settings/state still inline in main.ts |
| 2 | `HitTest.ts` | ✅ done |
| 3 | `AssetManager` → `engine/AssetLoader.ts` + manifest | ✅ done |
| 4 | `Audio.ts` + `GraphTone.ts` | ✅ modules built, **NOT yet wired into main.ts** — see Next Steps |
| 5 | `Input.ts` | ✅ done |
| 6 | `Avatar.ts` + `AvatarSprites.ts` | ✅ done |
| 7 | `GraphObstacles.ts` (procedural spike placement) | ⏳ not started |
| 8 | `Graph.ts` | ✅ done (basic), tone-on-draw + spike-obstacles still pending |
| 9 | `Orb.ts` | ✅ done |
| 10 | `Switch.ts`, `MovingPlatform.ts`, `Spike.ts` | ⏳ not started |
| 11 | `Level.ts` (base class) | ⏳ **not started** — level wiring currently inlined in `main.ts` |
| 12 | `Movements.ts` | ✅ done + heavily calibrated (v1–v14) |
| 13 | Per-level files in `src/levels/` | ⏳ only displacement0 is wired (via main.ts directly) |
| 14 | `LevelManager.ts` | ⏳ |
| 15 | HUD (in-game pause/hint/HUD) | ⏳ |
| 16 | Menus (Menu, Options, Instructions, Credits) | ⏳ |
| 17 | `Woosh2.mxml` (splash + intro cutscene gate) → main.ts | ⏳ |
| 18 | Delete vendored `gs/` (TweenMax) | n/a — not imported |

---

## 3. What we just finished (today's context)

The last few sessions focused entirely on **calibrating physics for
displacement0** — running through 14 distinct calibration commits
based on playtest feedback. The journey is documented in
`docs/calibration.md` §9, but the short version:

- Started with off-the-cuff `BODY` size and physics constants from the
  legacy game.
- Iteratively diagnosed and fixed: phantom head-bumps, stuck-on-slopes,
  fall-through-curves, auto-grab-platforms-from-below, auto-grab-curve-
  from-painted-floor, stuck-walking-up-slopes-after-flat-sections.
- Final state: `STEP_UP/DOWN=40`, slope-aware path-continuity check
  with avgSlope discriminator at 3.0, side-push wall-vs-slope
  discriminator that asks "can I step over this?" semantically.
- 84/84 tests pass. All commits prefixed `calibration v1` … `v14`.

Recent commits on `main`:

```
a54e06d docs/calibration.md: comprehensive rewrite for future-level reference
aee5917 calibration v14: wall discriminator uses obstacle-top vs STEP_UP
18d7c90 calibration v13: side-push wall-vs-slope discriminator (the real fix)
fb2abfc calibration v12: bump slope discriminator threshold + tolerance
4164996 calibration v11: avgSlope discriminator (fix flat→slope stuck-up bug)
7956d00 calibration v10: slope tolerance 20→30 + ground-catch safety net
b6f0fbe calibration v9: slope-aware step-up + remove mid-air ledge grab
8713dd7 calibration v8: step-up path-continuity check (no more overhead auto-grab)
1629ab5 calibration v7: STEP_UP/STEP_DOWN 24→40 (still bounded by 56 px cliff)
0087b7e calibration v6: STEP_UP 18→24 to match STEP_DOWN
...
```

Before that, leveld1 polish (orb visual passes v1–v8, key prompts,
exit portal, sun pulse, parallax sway, animated bg, etc.) — see
`git log` for the full sequence.

---

## 4. Next steps (priority order)

Suggested order — feel free to deviate. Each item is a self-contained
chunk that can land in 1–3 commits.

### A. Win detection at the exit portal ✅ done

Avatar's body-bbox overlap with the exit's (40×40) bbox latches
`levelComplete = true`, freezes physics + input handling, shows
a centered "Level Complete / press SPACE to restart" overlay
(semi-transparent dim + Pixi `Text`). SPACE → `resetLevel()`
restores spawn position, orb in cradle, graph back to idle, all
solidified curves removed from the avatar's ground stack, prompt
latches cleared. Visual ticks (orb pulse, sun pulse, bg sway, exit
glow) keep running behind the overlay so the scene doesn't freeze.

### B. Audio integration (~1 day) ← next

`engine/Audio.ts` (Howler wrapper) and `engine/GraphTone.ts`
(OscillatorNode-based pitch tone) are built but not wired. Wire up:

- BGM: `bgmWorld1` (loop while in `displacement0`).
- One-shot SFX: orb pickup, jump, drop, exit/win, landing.
- Graph tone: while the orb is held and the graph is drawing, the
  `GraphTone.setFrequency(hz)` is called per tick with `hz` derived
  from the curve's current y. This is unique-to-Waker feedback — the
  player "hears" the curve's shape.

**Recommended deviation from the plan**: do this BEFORE level
abstraction. The graph tone is a gameplay element, not decoration,
and it's easier to tune against a single working level.

### C. Level abstraction — `game/Level.ts` (~1–2 days)

The level wiring currently lives inline in `main.ts` (~300 lines of
setup for one level). Extract it into a `Level` class with a config
shape mirroring the legacy `addGraph(...)` signature. Each future
level becomes a small TS file in `src/levels/` that returns the
config.

Without this, every new level is a copy-paste of `main.ts`.

The legacy `level.mxml` (base class) is the reference for the API
shape — `setBG`, `setGround`, `setEntrance`, `setExit`, `addGraph`,
`addSwitch`, `addSpike`, `setHint`.

### D. Hazards: Spike, Switch, MovingPlatform (~2 days)

Order 10 in §14. displacement1 (hard difficulty) uses spikes;
displacement2 onward needs switches and moving platforms.

### E. Remaining levels (~3–4 days)

Order 13 in §14. With Level abstraction in place, each is mostly
mechanical:

- displacement1, displacement2, displacement3
- velocity1, velocity2, velocity3
- mixed1, mixed2, mixed3, mixed4
- Cutscenes (intro, world transitions, ending — MP4s already curated)

### F. LevelManager + UI shell (~3 days)

Order 14–16 in §14: level transitions, pause menu, options, level
select, hint overlays.

### G. Cutscenes (~½ day)

Drop-in `<video>` players for the curated MP4s (`intro`, `level-complete`,
`ending`). Already extracted via `npm run extract:cutscenes`.

### H. Phase 5/6 polish (~3–5 days)

Cross-browser pass, mobile touch controls, perf, accessibility, bundle
audit.

---

## 5. Open questions / pending decisions

Stuff to think about before the relevant phase, not now:

- **Audio synth fidelity**: The legacy game's `GaverRingTone1` (Sonoflash)
  is a proprietary FM synth. Plan §10 Q3 calls for a single
  `OscillatorNode` approximation. Decision to revisit once D is wired
  and we hear how it sounds: "good enough" → ship as is; "feels
  flat" → add a second oscillator + LFO for vibrato.
- **Mobile target**: Plan §11 Q1 left mobile as a stretch goal. The
  orb-graph mechanic is thumb-control awkward. Probably defer to a
  post-1.0 pass.
- **Tutorial bg vs procedural prompts**: displacement0's bg has D / ↑ /
  SPACEBAR glyphs baked in. We skip the procedural prompts on that
  level via `BG_HAS_HELP_PROMPTS = true`. Other levels' bgs probably
  don't have them — confirm per level when wiring it up.

---

## 6. Map of the docs

| File | What it's for |
| --- | --- |
| `README.md` | "What is this project" — public-facing, mostly stable. |
| `flash-to-html5-conversion-plan.md` | The full conversion plan (7 phases, module porting order, decisions log). |
| `docs/calibration.md` | All physics + scaling constants, derivations, history. **Read this before tuning anything** in `Movements.ts` or per-level constants. |
| `CLAUDE.md` | Per-session conventions for Claude Code (style, do/don't, glossary). |
| **`STATUS.md`** (this file) | Live "what to do next" context. Update this when you finish a chunk. |
| `legacy/CLAUDE.md`? | (Not present — `CLAUDE.md` is at repo root, sufficient.) |

---

## 7. Local-only artifacts (not in git)

These exist on the original machine but aren't committed. If you
need them, re-create:

- `legacy/screenshots/*.png` — Ruffle screenshots of the original
  game at known game states (avatar on each cloud step, mid-jump,
  graph drawing, etc.). Used for calibration measurements. Re-create
  by opening `legacy/reference/waker.swf` in Ruffle at native size
  and capturing screenshots; or use a recorded video.
- Any local PixelGround analysis scratch files in `tools/` — recreate
  with the pngjs sweep pattern (see `tools/measure-screenshots.mjs`
  for an example).

---

## 8. Pickup checklist

When starting a fresh session, run these in order:

```bash
git pull
npm install               # if dependencies changed
npm run typecheck
npm run lint
npm run test              # should be 84/84
npm run dev               # confirm displacement0 still plays end-to-end
```

If all 5 pass and the level plays, you're good to start on §4 above.
If anything fails, that's the first thing to fix.
