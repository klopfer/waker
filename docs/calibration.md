# Calibration: visual + physics constants for the Waker port

This is the single reusable record of how we mapped the original Flash
game's coordinates, sizes, and physics onto the TypeScript port. When a
new level is wired up (or a constant feels "off"), check here first
before guessing.

## Stage and coordinates

| Quantity | Original (Flash) | Port (TS) | Notes |
| --- | --- | --- | --- |
| Stage size | 800 × 600 (4:3) | 800 × 600 | Confirmed in plan §9. |
| Y axis | y+ = down | y+ = down | Same convention. |
| World ↔ screen | 1:1 | 1:1 | We do NOT scale the stage. Asset coords map directly. |
| Reference screenshots | Ruffle, ~1.4675× scale | — | `legacy/screenshots/*.png` are 1174×878 captures; divide by 1.4675 for world coords. |

### Painted-floor topmost-solid Y per X (displacement0 / `levelTD_ground.png`)

Measured by `tools/measure-screenshots.mjs` style pngjs sweep:

| X range | Topmost-solid Y | What it is |
| --- | --- | --- |
| 0 – 50 | 520 | bottom cloud bank (where the avatar drops in) |
| 60 – 250 | 389 | leftmost cloud step |
| 300 – 600 | 333 | second cloud step (orb stand sits here) |
| 700 – 799 | 214 | exit platform (top right) |

The avatar uses bottom-anchor (anchor 0.5, 1) and the BODY collision is
also bottom-anchored, so an avatar resting on a step has `state.y` equal
to the topmost-solid pixel y at that x.

## Avatar

### Source asset

- Native spritesheet: `src/assets/sprites/avatar/idle-right.png` is 3540 ×
  2198 px. Sheet is 15 cols × 14 rows of 236 × 157 frames (208 frames
  total).
- One frame contains the standing character + a long backward tail that
  pads the frame's left edge.
- **Standing-body extent within one 236 × 157 frame** (measured by row
  scans in `idle-right.png`):
  - Head (rows 8–64): width 82–86 px
  - Shoulders (rows 72–80): width 106–110 px
  - Waist (rows 88–128): width 39–42 px
  - Top of head: row ≈ 4
  - Top of feet: row ≈ 140
  - **Visible character height (head-top → foot-top): ~136 px**
  - **Visible character width at shoulders: ~110 px**

### Render scale

- `AVATAR_SCALE = 0.25` (in `src/main.ts`).
- At this scale: shoulders ~27 px, waist ~10 px, head-to-foot ~34 px on
  the 800 × 600 stage.

### Collision box (`BODY` in `src/game/Movements.ts`)

CALIBRATED to match the rendered avatar at AVATAR_SCALE = 0.25:

| Constant | Value | Rationale |
| --- | --- | --- |
| `BODY.HALF_WIDTH` | 12 | Width 24 px = roughly between waist (10) and shoulder (27). Wider would phantom-bonk on platform edges. |
| `BODY.HEAD_HALF_WIDTH` | 4 | Narrow head check; legacy game's "headPt" aura was a 3 px-wide image at avatar canvas top-center. |
| `BODY.HEIGHT` | 35 | Matches visible character head-top → foot-top at scale 0.25. |
| `BODY.SAMPLE_STEP` | 4 | Vertical sample step for side-wall scans. |
| `BODY.MAX_PUSH` | 30 | Cap on the iterative "push out of wall" loop. |
| `BODY.SIDE_TOP_MARGIN` | 8 | Top of body where SIDE collision is suppressed (head/upper-torso clearance under low overhead obstacles). Ceiling collision still uses the full body top, so head-bumps work normally. |

Previous values (HALF_WIDTH=15, HEIGHT=60) were tuned for an earlier
AVATAR_SCALE=0.3 and were ~2× the visible character height, which caused
phantom head-bumps where the visual head was clearly below a platform's
underside but the collision box wasn't.

### Original game's avatar canvas (for reference)

The legacy `game.mxml` line 73 calls `player.init(80, 80, …)` — the
avatar's collision canvas is 80 × 80 px on the 800 × 600 stage, with
pixel-perfect collision against four corner-aura images
(`headPt`/`leftPt`/`rightPt`/`bottomPt`). The visible character within
that canvas occupies maybe 60 × 60 px (the rest is padding for the
tail). Our port's 24 × 35 box is the rendered visible character; we
don't pixel-collide against the avatar's actual silhouette.

## Physics

Most values match `legacy/src/movements.mxml` verbatim (lines 447–453)
at the original 24 fps. **Two intentional deviations** — `JUMP_IMPULSE`
and the new `STEP_UP` — are flagged below and justified in calibration
v2 (see `git log src/game/Movements.ts`).

| Constant | Value | Source |
| --- | --- | --- |
| `GRAVITY` | 2 | line 448 |
| `MAX_FALL_SPEED` | 12 | -MAXFALLINGSPEED on line 449 |
| `JUMP_IMPULSE` | **15.5** ⚠️ deviates from legacy 14.5 | see below |
| `WALK_SPEED` | 6 | 4 × gameSpeed (1.5) on line 452 |
| `MAX_RUN_SPEED` | 12 | 8 × gameSpeed on line 454 |
| `RUN_ACCEL` | 0.3 | 0.2 × gameSpeed on line 450 |
| `RUN_BRAKE` | 1.5 | 1 × gameSpeed on line 451 |
| `STEP_UP` | **18** ⚠️ no legacy equivalent | see below |

**Theoretical max jump rise** under symplectic Euler at integer ticks:
- Legacy `14.5`: `14.5 + 12.5 + 10.5 + 8.5 + 6.5 + 4.5 + 2.5 + 0.5 = 60 px`
- Port `15.5`: `15.5 + 13.5 + 11.5 + 9.5 + 7.5 + 5.5 + 3.5 + 1.5 = 68 px`

### Why JUMP_IMPULSE = 15.5 (not legacy 14.5)

The displacement0 leftmost-cloud (y=389) → orb-stand (y=333) jump
needs 56 px of vertical rise. At legacy 14.5, max rise is 60 px — only
4 px of margin, which playtests as "exact-timing only" (the user
flagged this as much harder than the original). 15.5 yields 68 px max
rise (12 px margin), matching the leeway the user reports in the
original. The original Flash game may have had additional ledge-grab
or coyote-time mechanics that gave functional leeway with the same
JUMP_IMPULSE; bumping the constant is a simpler shim than implementing
those mechanics.

### STEP_UP — auto-snap to slightly-higher floors

When the avatar moves horizontally, if there's a floor at the new x
within `STEP_UP` px above current y, the avatar snaps UP to it instead
of side-pushing against its "wall." Two effects unified:

1. **Walking up player-drawn graph curves.** A curve drawn while the
   player runs at MAX_RUN_SPEED=12 with graph speedPerTick=1.5 has a
   max world-slope of `~17.5 px-rise per 12 px-run`. STEP_UP=18 covers
   it; smaller values cause the avatar to "fall through" rising
   slopes (gravity pulls them off the curve when the curve at the new
   x is above their current y).
2. **Landing on a ledge after a long jump.** When the avatar's
   near-apex feet pass a platform's left edge by a few pixels at a y
   slightly below the platform top, STEP_UP snaps them up onto the
   platform instead of phantom-bonking against the platform's left
   wall and stalling.

STEP_UP only triggers when (a) the avatar is moving horizontally
(vx ≠ 0) AND (b) they're on the ground OR rising-and-near-apex
(`vy >= -RUN_BRAKE`). This prevents step-up from grabbing unrelated
platforms during a hard upward jump.

## Graph drawing

`src/game/Graph.ts` mirrors `legacy/src/genericGraph.mxml` value→y
mapping plus a per-level `yOffset`.

For displacement orbs (value ≥ 0):

```
relativeValue(value) = (sheight / 2) - (value / maxValue) * (sheight / 2)
curveY              = relativeValue(value) + yOffset      // graph-local
worldCurveY         = graphY + curveY                     // world space
```

So:
- value=0 → graph-local y = `sheight/2 + yOffset` → world y = `graphY + sheight/2 + yOffset`.
- value=maxValue → graph-local y = `0 + yOffset` → world y = `graphY + yOffset`.

The `yOffset` parameter is the 8th positional argument of the legacy
`level.mxml::addGraph()` call (variable name `offset:int`).

### displacement0 graph

From `legacy/src/levels/displacement0.mxml` line 39:

```
super.addGraph(0, 0, 800-110-200, 134, 550, 200, 200, 70, 300, 290, 0, 300, 273, 0, 0)
```

→ `graphtype=0` (displacement), `graphratio=0` (square),
`graphX=490, graphY=134, scale(maxValue)=550, width=200, height=200,
offset=70, orbX=300, orbY=290, originX=300, originY=273`.

In our port:
- Graph rectangle: world (490, 134) → (690, 334)
- value=0 → world y = 134 + 100 + 70 = **304** (29 px above the
  orb-stand platform top at y=333 — reachable with a single jump)
- value=550 → world y = 134 + 0 + 70 = **204** (10 px below the exit
  platform top at y=214 — reachable from the curve apex)

Without the offset (yOffset=0), the value=0 line would sit at world
y=234, which is 99 px above the platform — out of jump range. **This is
exactly the "graph doesn't start low enough" issue the user flagged.**

## Spawn

| Level | Original `setEntrance(x, y)` | Port `SPAWN_X, SPAWN_Y` | Why |
| --- | --- | --- | --- |
| displacement0 | (0, 467) | (30, 0) | Original's entrance Y is a Flash top-left marker, not the avatar's feet. SPAWN_X=30 puts the avatar above the very-bottom cloud bank (topmost-solid y=520 at x=0..50); SPAWN_Y=0 lets gravity drop the player in. |

## Help glyphs

Some levels — at minimum displacement0 — bake the help-prompt glyphs
(D, ↑, SPACEBAR, flag/post) directly into the painted bg PNG. On those,
the runtime procedural prompts in `src/main.ts` (`makeKeyPrompt` calls)
would just stack on top of the painted ones.

`BG_HAS_HELP_PROMPTS = true` skips creating both `promptD` and
`promptSpacebar` entirely. The per-tick update gates on the nullable
references so there's no per-frame fade for invisible sprites.

When non-tutorial levels are wired up, set this to `false` and the
runtime prompts come back. Both procedural prompts have a subtle ±2°
sway (`sin(promptPhase * 0.7)`) so they read like the hand-drawn signs
in the original game's painted bgs.

## Update protocol

When a new level's calibration is added, append a row or sub-section
under the relevant heading (Spawn, Graph, etc.). Don't rewrite — keep
the per-level `addGraph(...)` parameter line as the source of truth so
later levels can be plugged in mechanically.
