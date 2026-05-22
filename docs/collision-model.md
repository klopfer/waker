# Collision model: legacy vs. port (reference)

Reference documentation of how the ORIGINAL (legacy AS3) avatar↔terrain
collision works, how the CURRENT port works, and the differences — written
during the 2026-05-22 investigation of "the avatar walks through steep
drawn-curve walls in the velocity world."

**Outcome of that investigation (see §3.5):** the capsule fix
(`f8118ef`) already stops *near-vertical* drawn-curve walls (the reported
case), and a playtest confirmed velocity0/1 play correctly. The faithful
push-out rewrite was deemed unnecessary (it would not fix the rarer
steep-*diagonal* case either) and high-risk (an attempt, commit
`d4e5823`, regressed the calibrated displacement world and was reverted).
Keep this doc as the reference for any future collision work; the
isolated curve-only-collision approach remains the safe fallback if steep
diagonals ever need blocking.

---

## Part 1 — ORIGINAL (legacy AS3) collision model

Files: `legacy/src/movements.mxml` (`movementResponse`), `legacy/src/
GambitLib/HitTest.as`, `legacy/src/avatar.mxml`, `legacy/src/level.mxml`,
`legacy/src/game.mxml`.

### 1.1 What collides with what

- `level.collisionObjects` = **[ painted ground PNG, every solidified
  graph `terrainMain`, moving platforms ]** (`level.mxml:78,237`;
  `switchObject.mxml:55`). ONE list — ground, drawn curve, and platforms
  are all treated identically.
- The avatar carries **four edge-probe images**: `headPt`, `bottomPt`,
  `leftPt`, `rightPt` (`avatar.mxml:23-26`). Each is an 80×80 image (sized
  to the avatar canvas) containing a small low-alpha collision box at the
  corresponding edge (top / bottom / left / right).
- Collision test = `HitTest.pixelsOverlap(edgePt, collider)`: bounding-box
  prefilter, then a true **pixel-overlap** of the two objects' opaque
  pixels (`HitTest.as`). So "is my right edge touching solid?" is a
  pixel-accurate test of the rightPt box against the collider's art.

### 1.2 Per-tick resolution (`movementResponse`, runs once `hack>=8`)

Order each tick:

1. `onGround = false`.
2. For each visible collider:
   - **RIGHT**: while `rightPt` overlaps it → if `leftPt` also overlaps
     some collider, you're pinned both sides → break; else `player.x -=
     0.2`. After the loop: `vx = 0; ax = 0`. (Push LEFT out of the wall,
     0.2 px at a time, to flush contact.)
   - **LEFT**: mirror — push `player.x += 0.2`, then `vx = 0`.
   - **UP (head)**: if `headPt` overlaps and `vy > 0` (rising) → `vy = 0`.
   - **DOWN (bottom)**: if `bottomPt` overlaps → `onGround = true`; if not
     jumping: nudge `player.y -= 2` (anti-bounce), and while `bottomPt`
     still overlaps → `player.y -= 0.2` (push UP out of the floor);
     `vy = 0`.
3. After all colliders: if grounded & not jumping → `vy = 0`; else apply
   gravity.
4. **Apply velocity**: `player.x += vx; player.y -= vy`.
5. **Screen clamp**: `x > 750 → 750`; `x < -30 → -30` (zero vx). Hard stop,
   no bounce.
6. **Post-move re-check** (`final_check_*`, movements.mxml:818-851): test
   the four points again; if `rightPt` OR `leftPt` overlaps after the move
   → `player.x -= vx; vx = 0`. (Head/bottom re-check responses are
   commented out.) This guarantees you never END a tick with a side point
   embedded in solid.
7. Drop-the-orb / solidify also pushes the avatar UP out of the freshly
   solidified curve (`game.mxml:264-269`: while head/left/right overlaps
   terrain → `y -= 2`).

### 1.3 The crucial property — NO slope analysis

The original NEVER computes a slope or classifies "wall vs ramp." Climb
vs block emerges purely from **which edge box overlaps**, plus the
push-out directions:

- **Climbing a slope** = the `bottomPt` box overlaps the rising floor →
  the avatar is pushed UP until its bottom clears. It rides up any floor
  its feet sink into.
- **Blocked by a wall** = the `rightPt`/`leftPt` box (at the body's SIDE,
  spanning some vertical band) overlaps solid → pushed back horizontally.
- **Walk under an overhang** = only `headPt` overlaps (response is just
  "stop rising"); the body passes under.

So the wall-vs-ramp THRESHOLD is implicit geometry: a slope steep enough
that its surface reaches the **side box's vertical band** at the body's
leading edge blocks you; a gentler slope only reaches the **bottom box**,
so you climb. The threshold = how low the side box's bottom sits relative
to the feet, and how far the side box sticks out horizontally.

Distant solids ABOVE the avatar never matter: only the actual edge boxes
(touching the body) are tested — there is no "topmost solid in the
column" query.

---

## Part 2 — CURRENT port model

File: `src/game/Movements.ts` (`step`), `src/game/{PixelGround,CurveGround,
RectGround,CompositeGround}.ts`.

### 2.1 Ground abstraction

`GroundProvider`: `groundYBelow(x, searchFromY)` (next floor top at/below)
+ `solidAt(x, y)`. `CompositeGround` merges painted `PixelGround`, the
drawn `CurveGround` (14-px capsule polyline), platform `RectGround`. So
the same "list of colliders" idea, but queried as functions, not pixels.

### 2.2 Per-tick resolution (`step`)

1. velocity update.
2. `x = state.x + vx`, `y = state.y` (axis-separated: resolve X at old Y).
3. **step-up / step-down** (if grounded, moving, and `!wallAhead`):
   `groundYBelow(x, …)` — if a floor is within `STEP_UP=40` ABOVE the feet
   and a midpoint-continuity check passes → snap y up; small drop → snap
   down. This is an EXPLICIT climb mechanism the original lacks.
4. else (`!steppedToFloor`):
   - **side-push** `pushOutFromWall*`: precheck `anySolidAlongVerticalEdge`
     (samples a MID-BODY band `[feet-25, feet-5]` at the leading edge),
     then `isWallAt` (a SLOPE/“too tall” discriminator) → push x back.
   - vertical move `y += vy`, ceiling push-down.
   - **ground-snap**: 3-sample `min` of `groundYBelow` at left/center/right
     edges (rejecting samples > STEP_UP above) → snap y to the highest
     floor; or a STEP_DOWN "ground catch".

### 2.3 Divergences from the original (the root of the bugs)

1. **Feet are SNAPPED to a column's floor-top (`groundYBelow`)** instead
   of pushed UP out of overlap. Mostly equivalent on flat ground, but it
   means the "where is my floor" question is a vertical ray, not the
   bottom box overlapping art.
2. **Wall-vs-ramp is decided by an explicit `isWallAt` SLOPE analysis**
   (and a head-probe gate on step-up). The original has none — and every
   attempt to make this slope analysis correct has either let steep drawn
   curves be climbed, or (when made to see solids above the mid-body band)
   mis-classified distant clouds/ceilings as walls and killed jump
   momentum. This is the fragile core.
3. **`step-up` is a separate climb path** that bypasses side-push; the
   original climbs only via bottom-push-up, so it has no such bypass.

### 2.4 What works / what doesn't (observed)

WORKS (must preserve):
- displacement world end-to-end (heavily calibrated v1–v18): walking on
  painted clouds, jumping cloud→cloud with horizontal momentum, landing,
  the d3 "draw the curve too low → trapped" puzzle, walking under low
  curves.

DOESN'T:
- **Steep segments of a drawn velocity curve are climbed / walked
  through** (the reported bug). side-push's mid-body sample doesn't see a
  curve that sits ABOVE the band, and step-up/ground-snap climb it.
- The slope-analysis rework (commit d4e5823, reverted) fixed the curve
  walls but REGRESSED displacement: making side-push consult `isWallAt`
  for the topmost solid let clouds ABOVE the avatar and platform faces
  during a jump read as walls → vertical-only jumps, snagged platform
  edges, couldn't walk off ledges.
- Sprinting onto a moderately-steep-but-walkable ramp can stall
  (pre-existing).

---

## Part 3 — COMPARISON & PLAN

### 3.1 The core difference

| | Original | Port |
|---|---|---|
| Floor contact | `bottomPt` box overlaps art → push UP | `groundYBelow` ray → snap feet to column floor-top |
| Wall block | `rightPt`/`leftPt` box overlaps art → push OUT | `anySolidAlongVerticalEdge` + `isWallAt` SLOPE analysis |
| Climb slopes | emergent: bottom-push-up | explicit `step-up` + ground-snap |
| Wall vs ramp | emergent from edge-box geometry | computed slope threshold (fragile) |
| Solids above the body | irrelevant (never queried) | queried by `isWallAt` (`bottomY-1000`) → caused the regression |

The port's fragility is entirely in **deciding wall-vs-ramp by analysis**
instead of letting it emerge from **edge-box overlap + push-out**.

### 3.2 Plan: port the original's push-out model

Replace step()'s X/Y resolution with the original's scheme, expressed
against `solidAt` (our pixel proxy):

1. Apply velocity → tentative `(x, y)`.
2. **DOWN/UP (vertical)**: if the body's BOTTOM band overlaps solid
   (`solidAt` samples across the foot width just above the feet) → push UP
   until clear → `onGround=true`, `vy=0` (climb / land). If rising and the
   HEAD band overlaps → push DOWN, `vy=0`.
3. **LEFT/RIGHT (horizontal)**: if the leading-edge SIDE band overlaps
   solid → push back out, `vx=0`. The side band runs from a little above
   the feet (`SIDE_BOTTOM_INSET`) up to `HEIGHT - SIDE_TOP_MARGIN` — its
   BOTTOM is the wall-vs-ramp knob (a slope reaching it blocks; gentler
   slopes only reach the foot band → climb via step 2).
4. Re-check (like legacy `final_check`): never end embedded.
5. Keep the boundary clamp + fall-out reset already in `Level.tick`.

NO `groundYBelow`-snap for the avatar, NO `isWallAt` slope analysis, NO
separate step-up. (`groundYBelow` stays for orb gravity / stand cradles.)
Wall-vs-ramp becomes emergent + tuned by the side band's bottom, matching
the original. Distant solids above are never consulted → the d4e5823
regression cannot recur.

### 3.3 Risks / tuning

- Push-UP climbing must be capped per tick so a near-vertical face is NOT
  ridden up (the original is implicitly capped because the side box blocks
  first; we replicate via the side-band bottom). Equivalent to the
  original: the side band reaching the slope = block; only the foot band
  reaching = climb.
- The displacement calibration (cloud heights, d3 trap, jump distances)
  must still hold — the body box dimensions (`HALF_WIDTH=12, HEIGHT=35`)
  and side-band insets are the knobs. Validate against the existing
  Movements tests + a displacement playthrough.
- Curve thickness (14 px) interacts with the foot-band push-up: a thin
  curve segment must register as solid under the feet to be climbable and
  at the side to block.

### 3.5 Investigation outcome (2026-05-22)

- The push-out rewrite (commit `d4e5823`) DID stop steep curve walls in
  unit tests, but **regressed the displacement world**: removing
  side-push's mid-body precheck let `isWallAt` see distant solids — clouds
  ABOVE the avatar and platform faces during jumps read as walls, killing
  horizontal jump momentum and snagging platform edges. **Reverted**
  (`8734235`).
- Re-test on the reverted build: **velocity0 and velocity1 play correctly**
  — the capsule `solidAt` (`f8118ef`) makes near-vertical drawn segments
  solid across the body, so side-push stops the avatar at them. The
  reported wall was near-vertical → already handled.
- Net: no collision rework shipped; the capsule fix is sufficient for the
  drawn walls players actually make. The only theoretical gap is a
  steep-but-diagonal curve segment (slope ~4–7), which the ORIGINAL also
  climbs (§1.3) — so matching the original means *not* blocking it.

### 3.6 Validation gates (if a future rework is attempted)

- All existing `tests/game/Movements.test.ts` (encode displacement
  behavior) pass, OR are deliberately updated with rationale.
- A `WallVsRamp`-style sweep: gentle drawn ramps (≤~1.5) walk at walk AND
  sprint; steep/near-vertical drawn segments stop; full walls stop flush;
  walk under high bars; the d3 low-bar still blocks.
- Browser: displacement0 walks/jumps cloud→cloud with momentum (the exact
  thing d4e5823 broke); velocity1 stops at a drawn wall.
- If displacement can't be preserved → revert, do the isolated
  curve-only collision instead.
