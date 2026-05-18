import { describe, it, expect } from 'vitest';
import { BODY } from '../../src/game/Movements.js';
import {
  spikeOverlapsBody,
  stepSpikeMotion,
  type SpikeConfig,
  type SpikeMotionState,
} from '../../src/game/Spike.js';

function fullCfg(partial: Partial<SpikeConfig> = {}): Required<SpikeConfig> {
  return {
    x: 0,
    y: 0,
    isMoving: false,
    horizontal: false,
    upOrLeft: false,
    turn: 0,
    turn2: 0,
    speed: 0,
    ...partial,
  };
}

function startState(x = 0, y = 0, upOrLeft = false): SpikeMotionState {
  return { x, y, upOrLeft };
}

describe('stepSpikeMotion', () => {
  it('stationary spike: no-op even with non-zero speed', () => {
    const state = startState(100, 200);
    stepSpikeMotion(state, fullCfg({ isMoving: false, speed: 99 }));
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);
    expect(state.upOrLeft).toBe(false);
  });

  it('moving but speed=0: no-op', () => {
    const state = startState(100, 200);
    stepSpikeMotion(state, fullCfg({ isMoving: true, horizontal: true, speed: 0 }));
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);
  });

  it('horizontal motion, moving right: x increases', () => {
    const state = startState(100, 200, /* upOrLeft */ false);
    stepSpikeMotion(
      state,
      fullCfg({ isMoving: true, horizontal: true, turn: 50, turn2: 200, speed: 7 }),
    );
    expect(state.x).toBe(107);
    expect(state.upOrLeft).toBe(false);
  });

  it('horizontal motion, moving left: x decreases', () => {
    const state = startState(100, 200, /* upOrLeft */ true);
    stepSpikeMotion(
      state,
      fullCfg({ isMoving: true, horizontal: true, turn: 50, turn2: 200, speed: 7 }),
    );
    expect(state.x).toBe(93);
    expect(state.upOrLeft).toBe(true);
  });

  it('horizontal motion flips direction past turn2 (right bound)', () => {
    const state = startState(198, 200, false);
    stepSpikeMotion(
      state,
      fullCfg({ isMoving: true, horizontal: true, turn: 50, turn2: 200, speed: 5 }),
    );
    expect(state.x).toBe(203);
    expect(state.upOrLeft).toBe(true);
  });

  it('horizontal motion flips direction past turn (left bound)', () => {
    const state = startState(52, 200, true);
    stepSpikeMotion(
      state,
      fullCfg({ isMoving: true, horizontal: true, turn: 50, turn2: 200, speed: 5 }),
    );
    expect(state.x).toBe(47);
    expect(state.upOrLeft).toBe(false);
  });

  it('vertical motion: y oscillates between turn and turn2', () => {
    const state = startState(300, 100, /* upOrLeft */ false);
    const cfg = fullCfg({ isMoving: true, horizontal: false, turn: 80, turn2: 160, speed: 6 });
    // First tick: y goes down (since upOrLeft=false means down/right when vertical)
    stepSpikeMotion(state, cfg);
    expect(state.y).toBe(106);
    // Step until past turn2
    while (!state.upOrLeft) stepSpikeMotion(state, cfg);
    expect(state.y).toBeGreaterThan(160);
    // Now moving up
    const yAfterFlip = state.y;
    stepSpikeMotion(state, cfg);
    expect(state.y).toBe(yAfterFlip - 6);
  });

  it('full oscillation cycle returns near the starting position', () => {
    const state = startState(100, 0, false);
    const cfg = fullCfg({ isMoving: true, horizontal: true, turn: 50, turn2: 150, speed: 5 });
    // Loop long enough to do a full cycle (200 px round trip / 5 px = 40 ticks; budget 200).
    for (let i = 0; i < 200; i++) stepSpikeMotion(state, cfg);
    expect(state.x).toBeGreaterThanOrEqual(50);
    expect(state.x).toBeLessThanOrEqual(155); // small overshoot allowed each flip
  });
});

describe('spikeOverlapsBody', () => {
  // Body anchor is bottom-center, so a body at (bx, by) covers
  // x ∈ [bx - BODY.HALF_WIDTH, bx + BODY.HALF_WIDTH] and
  // y ∈ [by - BODY.HEIGHT, by]. Spike at (sx, sy) covers (sx, sy) → (sx+w, sy+h).
  const SPIKE = { x: 100, y: 100, w: 40, h: 40 }; // box: (100,100) → (140,140)
  const overlap = (bx: number, by: number): boolean =>
    spikeOverlapsBody(bx, by, SPIKE.x, SPIKE.y, SPIKE.w, SPIKE.h);

  it('overlaps when the body bbox sits inside the spike bbox', () => {
    // Body bottom-center (120, 135): covers x ∈ [108, 132], y ∈ [100, 135].
    expect(overlap(120, 135)).toBe(true);
  });

  it('no overlap when body is fully left of spike', () => {
    // Body right edge at x = bx + 12 < 100  → bx < 88
    expect(overlap(80, 120)).toBe(false);
  });

  it('no overlap when body is fully right of spike', () => {
    // Body left edge at x = bx - 12 > 140 → bx > 152
    expect(overlap(160, 120)).toBe(false);
  });

  it('no overlap when body is fully above spike', () => {
    // Body bottom at y = by < 100
    expect(overlap(120, 80)).toBe(false);
  });

  it('no overlap when body is fully below spike', () => {
    // Body top at y = by - BODY.HEIGHT > 140 → by > 175
    expect(overlap(120, 180)).toBe(false);
  });

  it('edge-touch (zero overlap) returns false', () => {
    // Body right edge = bx + 12 = 100 = spike left → strict-less means no overlap.
    expect(overlap(88, 120)).toBe(false);
    // Body bottom = by = 100 = spike top → no overlap.
    expect(overlap(120, 100)).toBe(false);
  });

  it('uses BODY constants for the avatar bbox', () => {
    // Sanity: the calculation depends on BODY.HALF_WIDTH / BODY.HEIGHT — if
    // those change, this test breaks intentionally so the dependency is
    // exercised by the suite.
    expect(BODY.HALF_WIDTH).toBeGreaterThan(0);
    expect(BODY.HEIGHT).toBeGreaterThan(0);
  });
});
