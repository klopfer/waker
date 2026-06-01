// Tests for the displacement-orb pitch normalization function (Level.ts).
// Covers both pitchMapping modes:
//   - 'value' (default, legacy behavior): pitch = value / maxValue
//   - 'line-y' (opt-in for d3+): pitch maxes when the line reaches the
//     graph's visual top, accounting for yOffset.
//
// Existing behavior MUST stay bit-for-bit identical when pitchMapping
// is unset or 'value' — graphs we don't opt in shouldn't sound different.

import { describe, it, expect } from 'vitest';
import { graphTonePitch } from '../../src/game/Level.js';

describe('graphTonePitch — default "value" mapping (legacy)', () => {
  const graph = { maxValue: 400, height: 180, yOffset: 75 };

  it('value=0 yields pitch=0', () => {
    expect(graphTonePitch(0, graph)).toBe(0);
  });

  it('value=maxValue yields pitch=1', () => {
    expect(graphTonePitch(400, graph)).toBe(1);
  });

  it('value=maxValue/2 yields pitch=0.5', () => {
    expect(graphTonePitch(200, graph)).toBe(0.5);
  });

  it('value above maxValue is clamped to 1', () => {
    expect(graphTonePitch(800, graph)).toBe(1);
  });

  it('negative value is clamped to 0', () => {
    expect(graphTonePitch(-10, graph)).toBe(0);
  });

  it('explicit pitchMapping="value" matches the unset default', () => {
    const withExplicit = { ...graph, pitchMapping: 'value' as const };
    for (const v of [0, 100, 200, 400, 800]) {
      expect(graphTonePitch(v, withExplicit)).toBe(graphTonePitch(v, graph));
    }
  });
});

describe('graphTonePitch — "line-y" mapping (d3+ opt-in)', () => {
  // d3 graph 1 params: maxValue=400, height=180, yOffset=75.
  // valueAtTop = 400 * (90 + 75) / 90 = 733.33...
  const graph = { maxValue: 400, height: 180, yOffset: 75, pitchMapping: 'line-y' as const };
  const valueAtTop = (400 * (90 + 75)) / 90;

  it('value=0 still yields pitch=0 (resting audio unchanged)', () => {
    expect(graphTonePitch(0, graph)).toBe(0);
  });

  it('pitch=1 only at value where line reaches visual top', () => {
    expect(graphTonePitch(valueAtTop, graph)).toBeCloseTo(1, 5);
  });

  it('at value=maxValue, pitch is LESS than 1 (the bug being fixed)', () => {
    // Legacy "value" mode would return 1 here; "line-y" mode returns
    // half / (half + yOffset) = 90 / 165 ≈ 0.545.
    const p = graphTonePitch(400, graph);
    expect(p).toBeLessThan(1);
    expect(p).toBeCloseTo(90 / 165, 5);
  });

  it('pitch is monotonically increasing with value', () => {
    let prev = -Infinity;
    for (let v = 0; v <= valueAtTop; v += 50) {
      const p = graphTonePitch(v, graph);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('beyond valueAtTop, pitch is clamped at 1', () => {
    expect(graphTonePitch(valueAtTop * 1.5, graph)).toBe(1);
  });

  it('with yOffset=0, "line-y" collapses to "value" mode behavior', () => {
    const zeroOffset = { maxValue: 400, height: 180, yOffset: 0, pitchMapping: 'line-y' as const };
    for (const v of [0, 100, 200, 400, 800]) {
      expect(graphTonePitch(v, zeroOffset)).toBe(graphTonePitch(v, { ...zeroOffset, pitchMapping: 'value' }));
    }
  });
});
