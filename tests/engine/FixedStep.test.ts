import { describe, it, expect } from 'vitest';
import { FixedStep } from '../../src/engine/FixedStep.js';

describe('FixedStep', () => {
  it('runs zero steps when not enough time has passed', () => {
    const step = new FixedStep({ hz: 24 });
    const r = step.advance(20);
    expect(r.steps).toBe(0);
    expect(r.alpha).toBeGreaterThan(0);
    expect(r.alpha).toBeLessThan(1);
  });

  it('runs exactly one step at 24 Hz with a 41.67ms tick', () => {
    const step = new FixedStep({ hz: 24 });
    const r = step.advance(1000 / 24);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeLessThan(0.001);
  });

  it('runs multiple catch-up steps after a long frame', () => {
    const step = new FixedStep({ hz: 24 });
    const r = step.advance(200);
    expect(r.steps).toBe(4);
  });

  it('caps catch-up to maxStepsPerFrame to avoid spiral-of-death', () => {
    const step = new FixedStep({ hz: 24, maxStepsPerFrame: 3 });
    const r = step.advance(10000);
    expect(r.steps).toBe(3);
  });

  it('accumulates remainder across frames', () => {
    const step = new FixedStep({ hz: 24 });
    const a = step.advance(30);
    expect(a.steps).toBe(0);
    const b = step.advance(20);
    expect(b.steps).toBe(1);
  });

  it('reset clears the accumulator', () => {
    const step = new FixedStep({ hz: 24 });
    step.advance(30);
    step.reset();
    const r = step.advance(0);
    expect(r.alpha).toBe(0);
  });

  it('throws on non-positive hz', () => {
    expect(() => new FixedStep({ hz: 0 })).toThrow();
    expect(() => new FixedStep({ hz: -1 })).toThrow();
  });
});
