# Calibration: visual + physics constants for the Waker port

This is the single reusable record of how we mapped the original Flash
game's coordinates, sizes, and physics onto the TypeScript port. When a
new level is wired up (or a constant feels "off"), check here first
before guessing.

The physics work documented here was iterative — calibrations v1 through
v18, all driven by playtest feedback. v1–v14 came from `displacement0`
(the tutorial); v15–v18 from `displacement3` (the trap-puzzle level).
The current state is in §§ 1–6; the journey and lessons are in §§ 7–9.

---

## 1. Quick reference (current values)

```ts
// src/main.ts
AVATAR_SCALE = 0.25;

// src/game/Movements.ts
PHYSICS = {
  GRAVITY:        2,
  MAX_FALL_SPEED: 12,
  JUMP_IMPULSE:   15.5,   // ⚠️ deviates from legacy 14.5
  WALK_SPEED:     6,
  MAX_RUN_SPEED:  12,
  RUN_ACCEL:      0.3,
  RUN_BRAKE:      1.5,
  STEP_UP:        40,     // ⚠️ no legacy equivalent
  STEP_DOWN:      40,     // ⚠️ no legacy equivalent
};

BODY = {
  HALF_WIDTH:          12,
  HEAD_HALF_WIDTH:     4,
  HEIGHT:              35,
  SAMPLE_STEP:         4,
  MAX_PUSH:            30,
  SIDE_TOP_MARGIN:     10,  // ⚠️ tightened from v14 (was 14) — see §9 v17
  SIDE_BOTTOM_INSET:   4,   // ⚠️ NEW v18 — anti-alias floor edge workaround
};

// Step-up path-continuity check (in step())
isSlopePath        = avgSlope <= 3.0;
continuityTolerance = isSlopePath ? 50 : 8;

// isWallAt (in step's side-push) — v18 has TWO wall conditions:
//   topY < bottomY - STEP_UP            → too high to step over
//   topY ≥ bottomY - HEIGHT (overlap)   → curve at body height → trap
```

⚠️ flags mark intentional deviations from the legacy AS3 game; their
rationale is in §4. Anything not flagged matches `legacy/src/movements.mxml`.

---

## 2. Stage and coordinates

| Quantity | Original (Flash) | Port (TS) | Notes |
| --- | --- | --- | --- |
| Stage size | 800 × 600 (4:3) | 800 × 600 | Confirmed in plan §9. |
| Y axis | y+ = down | y+ = down | Same convention. |
| World ↔ screen | 1:1 | 1:1 | We do NOT scale the stage. Asset coords map directly. |
| Reference screenshots | Ruffle, ~1.4675× scale | — | `legacy/screenshots/*.png` are 1174×878 captures; divide by 1.4675 for world coords. |

### Painted-floor topmost-solid Y per X (`displacement0` / `levelTD_ground.png`)

Measured via pngjs sweep:

| X range | Topmost-solid Y | What it is |
| --- | --- | --- |
| 0 – 50 | 520 | bottom cloud bank (where the avatar drops in) |
| 60 – 250 | 389 | leftmost cloud step |
| 258 – 279 | 431 | mid-step (a 22-px-wide trap step — getting onto it costs you) |
| 280 – 679 | 333 | second cloud step (orb stand sits here) |
| 680 – 727 | 214 | exit platform (top right) |

The avatar uses bottom-anchor (`anchor 0.5, 1`) and the BODY collision
is also bottom-anchored, so an avatar resting on a step has `state.y`
equal to the topmost-solid pixel y at that x.

---

## 3. Avatar

### 3.1 Source asset

- Native spritesheet: `src/assets/sprites/avatar/idle-right.png` is
  3540 × 2198 px. Sheet is 15 cols × 14 rows of 236 × 157 frames (208
  frames total).
- One frame contains the standing character + a long backward tail
  that pads the frame's left edge.
- **Standing-body extent within one 236 × 157 frame** (measured by
  row scans):
  - Head (rows 8–64): width 82–86 px
  - Shoulders (rows 72–80): width 106–110 px
  - Waist (rows 88–128): width 39–42 px
  - Top of head: row ≈ 4
  - Top of feet: row ≈ 140
  - **Visible character height (head-top → foot-top): ~136 px**
  - **Visible character width at shoulders: ~110 px**

### 3.2 Render scale

- `AVATAR_SCALE = 0.25` (in `src/main.ts`).
- At this scale: shoulders ~27 px, waist ~10 px, head-to-foot ~34 px
  on the 800 × 600 stage.

### 3.3 Collision box (`BODY` in `src/game/Movements.ts`)

CALIBRATED to match the rendered avatar at AVATAR_SCALE = 0.25:

| Constant | Value | Rationale |
| --- | --- | --- |
| `BODY.HALF_WIDTH` | 12 | Width 24 px = roughly between waist (10) and shoulder (27). Wider would phantom-bonk on platform edges. |
| `BODY.HEAD_HALF_WIDTH` | 4 | Narrow head check; legacy game's "headPt" aura was a 3 px-wide image at avatar canvas top-center. |
| `BODY.HEIGHT` | 35 | Matches visible character head-top → foot-top at scale 0.25. |
| `BODY.SAMPLE_STEP` | 4 | Vertical sample step for side-wall scans. |
| `BODY.MAX_PUSH` | 30 | Cap on the iterative "push out of wall" loop. |
| `BODY.SIDE_TOP_MARGIN` | 14 | Top of body where SIDE collision is suppressed (head/upper-torso clearance under low overhead obstacles). Ceiling collision still uses the full body top, so head-bumps work normally. Calibrated against the lowest-reachable curve overhead (line_y=304, solid band [297, 311]) so an avatar on the orb-stand (y=333, body 298–333) has side samples in [313, 332], fully clear of the curve. |

Previous values (HALF_WIDTH=15, HEIGHT=60) were tuned for an earlier
AVATAR_SCALE=0.3 and were ~2× the visible character height, which
caused phantom head-bumps where the visual head was clearly below a
platform's underside but the collision box wasn't.

### 3.4 Original game's avatar canvas (for reference)

The legacy `game.mxml` line 73 calls `player.init(80, 80, …)` — the
avatar's collision canvas is 80 × 80 px on the 800 × 600 stage, with
pixel-perfect collision against four corner-aura images
(`headPt`/`leftPt`/`rightPt`/`bottomPt`). The visible character within
that canvas occupies maybe 60 × 60 px (the rest is padding for the
tail). Our port's 24 × 35 box is the rendered visible character; we
don't pixel-collide against the avatar's actual silhouette.

---

## 4. Physics constants

Most values match `legacy/src/movements.mxml` verbatim (lines 447–453)
at the original 24 fps. **Three intentional deviations** flagged below.

| Constant | Value | Source |
| --- | --- | --- |
| `GRAVITY` | 2 | line 448 |
| `MAX_FALL_SPEED` | 12 | -MAXFALLINGSPEED on line 449 |
| `JUMP_IMPULSE` | **15.5** ⚠️ deviates from legacy 14.5 | see §4.1 |
| `WALK_SPEED` | 6 | 4 × gameSpeed (1.5) on line 452 |
| `MAX_RUN_SPEED` | 12 | 8 × gameSpeed on line 454 |
| `RUN_ACCEL` | 0.3 | 0.2 × gameSpeed on line 450 |
| `RUN_BRAKE` | 1.5 | 1 × gameSpeed on line 451 |
| `STEP_UP` | **40** ⚠️ no legacy equivalent | see §5 |
| `STEP_DOWN` | **40** ⚠️ no legacy equivalent | see §5 |

**Theoretical max jump rise** under symplectic Euler at integer ticks:

- Legacy `14.5`: `14.5 + 12.5 + 10.5 + 8.5 + 6.5 + 4.5 + 2.5 + 0.5 = 60 px`
- Port `15.5`: `15.5 + 13.5 + 11.5 + 9.5 + 7.5 + 5.5 + 3.5 + 1.5 = 68 px`

### 4.1 Why JUMP_IMPULSE = 15.5 (not legacy 14.5)

The displacement0 leftmost-cloud (y=389) → orb-stand (y=333) jump
needs 56 px of vertical rise. At legacy 14.5, max rise is 60 px —
only 4 px of margin, which playtests as "exact-timing only" (the
user flagged this as much harder than the original). 15.5 yields
68 px max rise (12 px margin), matching the leeway the user reports
in the original. The original Flash game may have had additional
ledge-grab or coyote-time mechanics that gave functional leeway with
the same JUMP_IMPULSE; bumping the constant is a simpler shim than
implementing those mechanics.

### 4.2 Curve-slope physics (derivation)

Used to size `STEP_UP`, `STEP_DOWN`, and continuity tolerances:

```
Per draw-tick (ONE point added to the polyline):
  delta_value     ≤ MAX_RUN_SPEED         = 12 px
  delta_localY    = -delta_value/maxValue × (sheight/2)
                  = -12/550 × 100         = ±2.18 px
  delta_localX    = speedPerTick          = 1.5 px
  Max segment slope = 2.18/1.5            = ±1.45 per x

Per game-tick (avatar walks 12 graph-x at run speed → crosses 8 segments):
  Max delta_y across tick                  = 8 × 2.18 = ±17.4 px
  Max midpoint deviation from linear       = ~9 px
```

These bounds come from the displacement0 graph parameters
(`maxValue=550`, `height=200`, `speedPerTick=1.5`); other levels could
have different bounds, recompute if needed.

Despite these analytical bounds, playtest-driven calibration kept
showing real-world values exceeding the math (probably curve-stroke
geometry at sharp vertices interacting with body samples). The
current `STEP_UP/DOWN = 40` and slope-tolerance `50` reflect "math
says 17/9, give 2× headroom" — the constants are budgeted against
the actual painted-floor cliffs in displacement0 (smallest is 56 px,
so 40/50 still requires real jumps for those).

---

## 5. The step-up / step-down / side-push system

This is the most-iterated part of the port. The single-tick collision
flow now looks like this:

```
1. velocity update    (vx from inputs, vy = 0 if onGround else += gravity)
2. x = state.x + vx
3. STEP-UP / STEP-DOWN check  →  if fires, set y, vy=0, onGround=true,
                                  steppedToFloor=true, SKIP rest
4. side-push          (only if !steppedToFloor)
5. Y step (y += vy) + ceiling push (only if !steppedToFloor)
6. ground snap        (only if !steppedToFloor)
7. ground catch       (rescue: re-snap if barely airborne after #6)
```

### 5.1 STEP-UP / STEP-DOWN — auto-track the floor while walking

When the avatar moves horizontally and there's a walkable floor at the
new x (within ±`STEP_UP`/`STEP_DOWN` of current y), this branch OWNS
the result for the tick — snap onto the floor and skip the side-push +
ground-snap that would otherwise run. Three effects unified:

1. **Walking up player-drawn slopes** — without this, side-push trips
   on the slope's continuation at the body's leading edge.
2. **Walking down player-drawn slopes / off small steps** — without
   this, `groundYBelow` returns the curve y below current y;
   `y >= groundY` test fails, avatar goes airborne, gravity drifts
   them off the curve.
3. **Walking on flat curve segments where the next x has the same
   yTop** (a no-op for the snap, but the surrounding logic must
   handle it cleanly).

**Trigger conditions**:
- **Step UP** fires when `vx ≠ 0` AND `onGround`.
  *(Mid-air step-up — the original `nearApex` branch — was REMOVED;
  it inadvertently let the avatar grab platforms from below mid-jump.
  Cliff jumps in the level have enough margin that they reach above
  the destination at apex and fall onto it normally.)*
- **Step DOWN** fires when `vx ≠ 0` AND `onGround` AND
  `newFloorY <= state.y + STEP_DOWN`.

### 5.2 STEP_UP path-continuity check (slope-aware tolerance)

`STEP_UP=40` is generous enough for jagged player-drawn slope
discontinuities, but it's also generous enough that a curve whose left
endpoint dangles within 40 px of the painted floor below would be
auto-grabbed by an avatar walking *under* it. A path-continuity check
discriminates "walking up a slope" from "auto-grabbing a separate
higher floor":

```ts
const dx       = |x - state.x|
const dy       = state.y - newFloorY
const avgSlope = dx > 0 ? |dy / dx| : 0
const isSlopePath        = avgSlope <= 3.0
const continuityTolerance = isSlopePath ? 50 : 8

const midX        = (state.x + x) / 2
const midFloorY   = ground.groundYBelow(midX, state.y - STEP_UP)
const expectedMid = (state.y + newFloorY) / 2
const isContinuous = |midFloorY - expectedMid| <= continuityTolerance
```

**Why average slope (not a probe ahead)**: a probe-based detector
("is the floor at state.x equal to the floor 4 px ahead?") FAILS on
flat-curve-segment-to-sloped-segment transitions — both probes land
on the flat segment and look identical to flat ground. The avgSlope
discriminator measures the path's slope directly and isn't fooled.

- **Continuous slopes** are bounded by max draw-time slope (1.45 per
  x). avgSlope ≤ 1.45 always → loose tolerance 50 → slope kinks
  pass (max midpoint deviation ~9 px, way under 50).
- **Auto-grab boundaries** (curve overhead, air gap below) produce
  `avgSlope = gap/12` — > 3.0 for any gap big enough that the body
  could fit under (BODY.HEIGHT=35 → gap of 35 gives avgSlope 2.92,
  catches it).

The 8 px ground tolerance rejects overhead boundaries with deviation
> 8 px (i.e., gap > 16 px).

### 5.3 Side-push wall vs slope discriminator

Inside `pushOutFromWall{Right,Left}`: the avatar's body samples can
overlap a curve's solid band at the LEADING EDGE
(`edgeX = state.x + vx + HALF_WIDTH`) when the avatar is walking
toward a rising slope but their new x doesn't yet reach the rise.
Without help, side-push trips on the slope as if it were a wall —
the avatar oscillates and has to JUMP to break out.

The discriminator uses the **semantic** definition: a wall is
something the avatar CAN'T step over (its top is higher than
`STEP_UP` above feet); a slope/floor's top is reachable.

```ts
function isWallAt(edgeX, bottomY, ground) {
  const topY = ground.groundYBelow(edgeX, bottomY - 1000); // search from very high
  if (topY === Infinity)  return false;                    // no obstacle
  if (topY >= bottomY)    return false;                    // obstacle at/below feet
  return topY < bottomY - PHYSICS.STEP_UP;                 // top too high → wall
}
```

For ascending curve at edgeX: `topY = curve top`, within ~17 px of
feet → NOT wall → don't push, avatar walks. ✓

For real wall (painted-floor cliff side): `topY` far above feet
(e.g., orb-stand top y=333 vs avatar on mid-step y=431 → top 98 px
above feet, well above STEP_UP=40) → WALL → push. ✓

### 5.4 Ground catch in the ground snap

If step-up/step-down both fail to fire on a tick AND the regular
`y >= groundY` test fails, normally the avatar becomes airborne. But
the avatar might have been genuinely walking along a slope where the
math just happened not to work for that single tick. Without a safety
net, they drift off the curve laterally over a few ticks of gravity.

**Ground catch**: if the avatar was `onGround` last tick, isn't
rising (`vy >= 0`), and the floor is within `STEP_DOWN` of current
y, snap to it anyway. Real cliffs (`groundY - y > STEP_DOWN`) still
fall through normally.

---

## 6. Curves as ground

A solidified player-drawn curve becomes a `CurveGround` (a polyline
with thickness=14 px). Two semantics matter:

| Query | Behavior |
| --- | --- |
| `solidAt(x, y)` | true if `y` is within `thickness/2 = 7 px` of the polyline's interpolated y at column `x`. So the solid band is `[line_y - 7, line_y + 7]`. |
| `groundYBelow(x, searchFromY)` | returns the **TOP of the solid band** (`line_y - thickness/2`), not the line center. An avatar landing on the curve has feet on the band's top edge, with body fully ABOVE the band. |

Returning the line center (the pre-2026-05-09 behavior) put the
avatar's feet at line_y, with body extending UP through the curve's
upper half — partially inside the solid band. Side-collision samples
then overlapped the curve and tripped intermittent side-pushes,
producing slide-back / fall-through bugs.

### 6.1 Stand cradle (orb-only ground)

The stand cradle that holds the orb at level start is also a
`CurveGround` (thickness=2). Because `groundYBelow` returns the band
TOP (= `line_y - 1` for thickness=2), the cradle's polyline is placed
at `line_y = ORIGIN_Y - STAND_CRADLE_LIFT + 1` so the returned floor
top lands at `ORIGIN_Y - STAND_CRADLE_LIFT` — the actual surface the
orb rests on. Without this `+ thickness/2` shift the cradle's top is
1 px above the orb's spawn position, gravity overshoots the cradle
on the first frame, and the orb falls through to the painted floor.

### 6.2 Graph drawing (formula + per-level params)

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

#### displacement0 graph

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

Without the offset (`yOffset=0`), the value=0 line would sit at
world y=234, which is 99 px above the platform — out of jump range.
**This is exactly the "graph doesn't start low enough" issue the
user flagged.**

---

## 7. Per-level data

Each wired level has a `src/levels/*.ts` config literal. Source values
come from `legacy/src/levels/<name>.mxml`; world-y values for origins
come from pngjs sweeps of the level's collision PNG. The general
`legacy_y + 60` convention works for origin Y (the legacy game's
marker sprite is ~60 px tall, anchored top in legacy / bottom in port).

### displacement0 (tutorial — `src/levels/displacement0.ts`)

| Quantity | Value | Source |
| --- | --- | --- |
| BG asset key | `bgWorld1_t` | displacement0.mxml line 21 |
| Collision asset key | `levelTD_collision` | displacement0.mxml line 24 |
| `spawn` | `{x:30, y:0}` | Original `setEntrance(0, 467)` is a Flash top-left marker. SPAWN_X=30 puts the avatar above the bottom-cloud bank; SPAWN_Y=0 lets gravity drop the player in. |
| `exit` | `{x:750, y:174}` | displacement0.mxml line 27 |
| `orbs[0].origin` | `{x:300, y:333}` | Topmost-solid Y of orb-stand at x=300 (pngjs sweep). |
| `orbs[0].orb` | `{x:300, y:321}` | ORIGIN.y - cradle.lift = 321. |
| `orbs[0].cradle` | `{lift:12, halfWidth:18}` | The cradle shelf the orb rests on. |
| `orbs[0].graph` | `{x:490, y:134, width:200, height:200, maxValue:550, yOffset:55}` | From `addGraph(0,0,800-110-200,134,550,200,200,70,300,290,0,300,273,0,0)`. **⚠️ yOffset deviates from legacy 70 → 55** to push the value=0 curve high enough that the avatar fits cleanly underneath it without needing the v14 SIDE_TOP_MARGIN=14 hack. See §9 v16. |
| `sunCentroid` | `{x:207, y:102}` | Painted-sun centroid in `levelTD_bg.png`. |
| `nextLevel` | DISPLACEMENT1 | Legacy `super.nextLvl = 'd1'`. |

### displacement1 (`src/levels/displacement1.ts`)

Easy-mode config (legacy spec branches on `Settings.LEVEL_DIFFICULTY`;
we ship the easy/default branch).

| Quantity | Value | Notes |
| --- | --- | --- |
| BG / ground | `bgWorld1_1` / `leveld1_collision` | |
| `spawn` | `{x:30, y:0}` | Lands on left ledge at y=440. |
| `exit` | `{x:740, y:195}` | Upper-right exit. |
| `orbs[0].origin` | `{x:200, y:498}` | Middle platform; topmost-solid at x=200 = 498. |
| `orbs[0].orb` | `{x:200, y:486}` | y - cradle.lift. |
| `orbs[0].graph` | `{x:308, y:200, width:300, height:300, maxValue:400, yOffset:100}` | Legacy spec; unmodified. |
| `sunCentroid` | `{x:118, y:109}` | |
| `nextLevel` | DISPLACEMENT2 | |
| Hard-mode delta | adds a horizontally-moving spike at `(500,480)` | Not wired (no difficulty selector). |

### displacement2 (`src/levels/displacement2.ts`)

**Two orbs.** Easy-mode.

| Quantity | Value | Notes |
| --- | --- | --- |
| BG / ground | `bgWorld1_2` / `leveld2_collision` | |
| `spawn` | `{x:30, y:200}` | **⚠️ y=200 not 0** so gravity drops past the top shelf (y=100-135) onto the small left ledge (y=440). spawn.y=0 would land on top shelf right next to the exit and trigger win immediately. |
| `exit` | `{x:0, y:60}` | Top-left niche **above** the high shelf. |
| `orbs[0].origin` | `{x:160, y:500}` | Bottom cloud bank. |
| `orbs[0].graph` | `{x:240, y:340, w:160, h:160, maxValue:600, yOffset:40}` | |
| `orbs[1].origin` | `{x:740, y:329}` | Right cloud top. |
| `orbs[1].graph` | `{x:223, y:60, w:220, h:220, maxValue:500, yOffset:80}` | |
| `sunCentroid` | `{x:170, y:88}` | |
| `nextLevel` | DISPLACEMENT3 | |

### displacement3 (`src/levels/displacement3.ts`)

**Two orbs**, second one **floats in mid-air** (intentional per legacy).
Easy-mode.

| Quantity | Value | Notes |
| --- | --- | --- |
| BG / ground | `bgWorld1_3` / `leveld3_collision` | |
| `spawn` | `{x:30, y:0}` | Drops to bottom cloud bank at y=500. |
| `exit` | `{x:740, y:100}` | Upper-right above mountain. |
| `orbs[0].origin` | `{x:500, y:500}` | Bottom cloud at x=500. |
| `orbs[0].graph` | `{x:100, y:320, w:180, h:180, maxValue:400, yOffset:75}` | **⚠️ yOffset deviates from legacy 90 → 75** — middle ground between "too lenient" (60: trap never fires) and "barely solvable" (90: orb-2 jump is exact-timing-only). With margin=10 + isWallAt overlap rule (v18), the trap range is V<~95. See §9 v17–v18. |
| `orbs[1].origin` | `{x:280, y:320}` | **Floating in mid-air** — no painted floor at x=280, y=320. Player reaches it via orb 1's curve top + jump. |
| `orbs[1].graph` | `{x:320, y:140, w:180, h:180, maxValue:300, yOffset:90}` | |
| `sunCentroid` | `{x:64, y:209}` | |
| `nextLevel` | unset | Legacy next is `cutsceneVelocity` → velocity0; cutscene machinery not wired yet, so SPACE on win restarts d3. |

---

## 8. Methodology for porting a new level

Each new level should follow this checklist. Most of the work is data
entry from the legacy MXML; the existing physics handles new shapes
without changes (in theory).

1. **Read the legacy level MXML** (`legacy/src/levels/<name>.mxml`).
   Extract the `setBG`, `setGround`, `setEntrance`, `setExit`,
   `addGraph`, and any `addSpike` / `addSwitch` / `setHint` calls.
2. **Look up each asset key** in `src/assets/manifest.json` to confirm
   the curated PNG exists. If missing, run `npm run extract:swf` /
   `npm run curate` to add it.
3. **Measure the painted-floor topology**. Run a pngjs sweep on the
   collision PNG (see §2 for displacement0's table). Note the
   topmost-solid Y per X range — that's where the avatar will land.
4. **Pick spawn coordinates** by combining the legacy `setEntrance`
   x with `SPAWN_Y = 0` (drop-in from above). Verify the avatar
   lands on the intended platform.
5. **Decode the `addGraph` args** per §6.2's formula. Compute world
   y ranges for value=0 and value=maxValue and confirm they're
   reachable from the avatar's spawn / nearby platforms.
6. **Measure painted-bg sun centroid** for the procedural sun-pulse
   overlay (pngjs sweep for pure-white in the upper region).
7. **Set `BG_HAS_HELP_PROMPTS`** based on whether the painted bg has
   help glyphs baked in (typically only tutorial bgs do).
8. **Calibrate `ORIGIN_Y`** to match the painted floor at `ORIGIN_X`.
   Use the topmost-solid table from step 3.
9. **If the painted floor has cliffs** (jumps the avatar must make),
   verify all are in the `[STEP_UP+1, JUMP_RISE_MAX]` range — i.e.,
   above the auto-step threshold (40) but reachable by a single jump
   (68 with current JUMP_IMPULSE=15.5). Cliffs outside this range
   need either physics tuning or a curve-platform to bridge.
10. **Playtest.** Walk every part of the level, draw the orb-graph
    in various shapes, confirm jumping / falling / step-up / step-down
    feel right. Iterate constants if needed, but FAVOR the existing
    physics over per-level overrides — write down anything you have
    to deviate from in this doc.

---

## 9. Calibration history

The physics evolved over 18 calibration commits, each driven by a
specific playtest issue. Documented here so future me / future you
doesn't re-derive the same mistakes.

### v1–v14: displacement0 (tutorial)

| v | What changed | Why |
| --- | --- | --- |
| 1 | Initial port: `BODY` 30×60, `JUMP_IMPULSE=14.5`, no STEP_UP, no continuity check, AVATAR_SCALE=0.30 | Shipped as a placeholder with the engine modules. |
| 2 | `BODY` 30×60 → 24×35, `AVATAR_SCALE` 0.30 → 0.25, fixed graph yOffset=70, drop-in spawn, BODY.SIDE_TOP_MARGIN=8 | First calibration after measuring the actual avatar sprite (~136 native px tall × 0.25 = 34 visible). Fixed phantom head-bumps and the "graph drawn too high" bug. |
| 3 | Added STEP_UP=18 + nearApex ledge grab | Walking up slopes oscillated ("slid backwards") because side-push tripped on the slope's leading edge. STEP_UP snap-up bypasses side-push. |
| 4 | `CurveGround.groundYBelow` returns line_y - thickness/2 (yTop), not line_y; `SIDE_TOP_MARGIN` 8 → 14 | Avatar's feet were landing at the LINE center of curves, with body partially INSIDE the solid band. Side-push then tripped on this overlap. Returning yTop puts feet on the band's TOP edge. |
| 5 | Stand cradle line shifted +thickness/2; STEP_DOWN 18 → 24 | The yTop fix in v4 also broke the stand cradle (which is a CurveGround) — the orb was falling past it. Shifting the cradle's polyline by +1 px (its half-thickness) put the band TOP at the desired y again. |
| 6 | STEP_UP 18 → 24 (matching STEP_DOWN) | Symmetric — going up jagged slopes was getting stuck while going down was fine. |
| 7 | STEP_UP / STEP_DOWN 24 → 40 | Playtest still showed sticky jagged-curve traversal. Bumped both to give 2× headroom over the analytical max (~17.4 px per tick). |
| 8 | Added STEP_UP path-continuity check (probe-based slope detection, tolerance 12 / 8) | STEP_UP=40 was now too generous: a curve overhead within 40 px of the painted floor below would be auto-grabbed by an avatar walking under it. Continuity check at midpoint discriminates "I'm walking on a slope" (continuous y) from "I'm under a separate floor" (sudden y jump). |
| 9 | Removed `nearApex` ledge-grab branch; slope tolerance probe-based, slope=20/flat=8 | The mid-air `nearApex` step-up was letting the avatar grab platforms from BELOW mid-jump (e.g., jumping straight up under a small platform). Cliff jumps in the level have enough margin to land normally without it. |
| 10 | Slope tolerance 20 → 30; ground catch in the ground snap | Walking up jagged slopes still occasionally stuck (rare ticks where step-up's check failed). Walking down jagged slopes occasionally fell THROUGH the curve (one-tick airborne where state.y == newFloorY exactly). Tolerance bump for the up case; ground-catch safety net for the down case. |
| 11 | Probe-based slope detector → avgSlope-based | The probe detector failed on flat-curve-segment → slope-segment transitions: both probes landed on the flat section and looked like flat ground, applying the tight tolerance and rejecting the legitimate slope walk. avgSlope measures the path itself and isn't fooled. |
| 12 | avgSlope threshold 2.0 → 3.0; slope tolerance 30 → 50 | Reality kept exceeding the analytical 1.45-per-x slope max. Added 2× headroom. |
| 13 | Side-push: added `isWallAt(edgeX, feet+1)` to skip pushes on slopes | Walking right toward an uptick where the slope started AHEAD of new_x: step-up didn't fire (newFloorY = state.y still on flat), side-push then tripped on the rising slope at edgeX (12 px past new_x). Side-push needs to know "is this a wall or a slope I'm about to step onto?". The `solidAt(feet+1)` test answered "is solid below feet?" — works for descents but… |
| 14 | …the v13 discriminator failed for gentle slopes (curve band can extend up to 7 px below feet when line is near feet level). Replaced with `isWallAt` that asks "is the obstacle's top within STEP_UP above feet?" — actual semantic question. | Real walls have tops far above feet; curve slopes have tops within ~17 px of feet. The semantic question discriminates without the geometric edge cases. |

### v15–v18: displacement3 (trap-puzzle level)

The d3 level introduces the "draw the curve too low and you're trapped"
puzzle. v15–v18 are about making that puzzle actually work without
breaking normal walking.

| v | What changed | Why |
| --- | --- | --- |
| 15 | `groundYBelow` returns yTop if `searchFromY` is INSIDE the band (`yBottom ≥ searchFromY`), not just above (`yTop ≥ searchFromY`); `body.step` searches from `min(state.y, y_new)`. Applies to `CurveGround`, `PixelGround`, `RectGround`. | "Jump sideways into a curve" tunneling: lateral motion landed avatar feet at an x where the interpolated curve top was above their feet, but the old groundYBelow returned Infinity (yTop < searchFromY) — avatar phased through. Inside-band semantic + min-y search catches both descending and ascending crossings. |
| 16 | `SIDE_TOP_MARGIN` 14 → 8, then displacement0 graph `yOffset` 70 → 55 | v14's margin=14 was originally to let the avatar squeeze under the lowest curve on displacement0 (line_y=304, body overlaps band by 14 px). But it made displacement3's trap trivial — player could squeeze past any curve at body height. Rebalanced: tighter margin + raise the displacement0 curve via yOffset so the avatar fits cleanly underneath without the body-margin hack. |
| 17 | `SIDE_TOP_MARGIN` 8 → 10; displacement3 g1 `yOffset` 90 → 60 → 75 | v16's margin=8 was still too strict — borderline overlap cases (curve clipping the top ~5 px of head) read as stuck. Bumped to 10. Plus several rounds of d3 g1 yOffset tuning: 90 (legacy spec, "just barely" reachable) → 60 (too lenient, trap never fired) → 75 (substantial trap V<~95 + comfortable orb-2 jump). |
| 18 | NEW `SIDE_BOTTOM_INSET` = 4; re-added `isWallAt` overlap rule (`topY ≥ bottomY - HEIGHT → wall`); `pushOutFromWall*` clamp pushback to original x (no MAX_PUSH=30 teleport) | The REAL fix for d3 stuck. Painted floors are anti-aliased: at x=163 the cloud's "top" is y=501 (alpha=75 above is below threshold), at x=175 (right body edge) the same edge band is y=500 (alpha=133 above threshold). Sample at y=500 hit the cloud's own anti-alias band at the next column, combined with a curve overhead providing wall=true → side-push false-fired. Inset lifts the lowest sample firmly above any anti-alias band. With the false-positive shielded, the overlap-wall rule can come back and make d3's trap actually work. Found via on-screen debug HUD that dumped per-tick side-collision state (since removed). |

### Key lessons

1. **Anchor matters more than scale.** Half the head-bump bugs came
   from collision boxes that were 2× the visual character because
   nobody had measured the rendered character.
2. **`groundYBelow` and `solidAt` must agree on where the floor is.**
   v1–v3 had them disagreeing for thick curves (line center vs band
   top), causing intermittent side-collision trips. v4 unified the
   convention.
3. **Side-push needs a wall-vs-slope discriminator** — without it, any
   curve solid that overlaps the body's leading edge becomes a "wall"
   to bonk into. The semantic discriminator (is the obstacle's top
   reachable by step-up?) is the cleanest answer.
4. **Don't use spatial probes when you can measure the path.** The v9
   probe-based slope detector misclassified flat-to-slope transitions;
   the v11 avgSlope-on-the-actual-path discriminator handled the same
   geometry correctly because it measured what was actually being
   traversed.
5. **Mid-air ledge-grab is a tempting but bad shim.** It re-introduces
   "platform grabbed from below" bugs. If cliff jumps need leeway,
   bump JUMP_IMPULSE — at least that change is testable with the
   level's geometry directly.
6. **Continuity checks need a *measurement* discriminator AND a
   *tolerance* discriminator.** Just one or the other isn't enough:
   the avgSlope check identifies "slope vs auto-grab"; the midpoint
   tolerance verifies the path is actually continuous. Either alone
   has gaps.
7. **Always have a safety net.** The ground catch (§5.4) saves
   single-tick failures of the primary step-up/down logic. Without
   it, edge cases compound across ticks.
8. **Reality exceeds analytical bounds.** For every analytically-derived
   threshold, leave at least 2× headroom over the math. The avgSlope
   threshold ended up at 3.0 over an analytical max of 1.45;
   continuity tolerance at 50 over an analytical max of 9.
9. **Anti-aliased collision PNGs leak ±1-2 px past the "true" edge.**
   The painted floors are full RGBA; the binary alpha threshold (128)
   reads anti-alias pixels as solid at some columns and air at others.
   Body-edge samples grazing this band false-fire side-push when
   combined with a wall classification from a different obstacle in
   the same column. The fix is `BODY.SIDE_BOTTOM_INSET=4` — lifts
   the lowest side-sample above any anti-alias band. When sampling
   the collision PNG for floor positioning, also assume ±2 px of slop.
10. **Instrument THEN fix when static analysis disagrees with playtest.**
    The d3 stuck case (v18) couldn't be reproduced from reading the
    code — my trace said "no push, avatar moves," but the user was
    stuck. Adding a 4-line on-screen HUD that dumped per-tick edge
    diagnostics (`solid`, `wall`, `topY`, `vx`) made the contradiction
    obvious in one screenshot. Don't keep re-tracing; write the probe.
11. **Cap pushback to the avatar's pre-move x.** Without the cap, side-
    push iterates up to `MAX_PUSH=30` px and can teleport the avatar
    back 30 px when walking into a long wall. With the cap, the move
    just doesn't happen — no movement, no teleport. v18.

### Update protocol

When a new level's calibration is added:
- Append a row or sub-section under §7 (per-level data).
- Append a row to §9 (calibration history) only if you had to
  deviate from the existing physics — most levels should JUST WORK
  with the same constants.
- Don't rewrite this doc. Keep the per-level `addGraph(...)`
  parameter line as the source of truth so later levels can be
  plugged in mechanically.
