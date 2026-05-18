import { describe, it, expect } from 'vitest';
import { BODY } from '../../src/game/Movements.js';
import { MovingPlatform } from '../../src/game/MovingPlatform.js';
import { Switch } from '../../src/game/Switch.js';

function makeSwitch(x = 100, y = 100, w = 20, h = 28): Switch {
  return new Switch({ x, y, width: w, height: h });
}

describe('Switch', () => {
  it('first toggle goes to mode 2 (returns sfxSwitchTwo)', () => {
    const s = makeSwitch();
    expect(s.toggle()).toBe('sfxSwitchTwo');
  });

  it('second toggle returns to mode 1 (returns sfxSwitchOne)', () => {
    const s = makeSwitch();
    s.toggle();
    expect(s.toggle()).toBe('sfxSwitchOne');
  });

  it('toggle() calls flip() on all attached platforms', () => {
    const s = makeSwitch();
    const p1 = new MovingPlatform({
      x: 200,
      y: 200,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    const p2 = new MovingPlatform({
      x: 300,
      y: 200,
      width: 60,
      height: 20,
      horizontal: false,
      upOrLeft: true,
    });
    s.attach(p1);
    s.attach(p2);
    expect(p1.isMoving).toBe(false);
    expect(p2.isMoving).toBe(false);
    s.toggle();
    expect(p1.isMoving).toBe(true);
    expect(p2.isMoving).toBe(true);
  });

  it('overlapsBody true when avatar body bbox overlaps switch', () => {
    const s = makeSwitch(100, 100, 20, 28); // covers x∈[100,120), y∈[100,128)
    // Avatar at (110, 125): body bbox = [98,122) x [90, 125)
    expect(s.overlapsBody(110, 125)).toBe(true);
  });

  it('overlapsBody false when avatar is fully clear of the switch', () => {
    const s = makeSwitch(100, 100, 20, 28);
    // Avatar at (50, 125) — body bbox right edge = 62 < 100
    expect(s.overlapsBody(50, 125)).toBe(false);
    // Avatar far below: by - BODY.HEIGHT = 200 - 35 = 165 > switch bottom 128.
    expect(s.overlapsBody(110, 200)).toBe(false);
  });

  it('reset() returns to mode 1', () => {
    const s = makeSwitch();
    s.toggle(); // mode 2
    s.reset();
    expect(s.toggle()).toBe('sfxSwitchTwo'); // first toggle after reset → mode 2
  });

  it('reset() does NOT call reset() on attached platforms (Level orchestrates separately)', () => {
    const s = makeSwitch();
    const p = new MovingPlatform({
      x: 200,
      y: 200,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    s.attach(p);
    s.toggle(); // p.isMoving = true
    expect(p.isMoving).toBe(true);
    s.reset();
    // Platform STAYS in its current moving state; Level.reset() also calls
    // p.reset() separately.
    expect(p.isMoving).toBe(true);
  });

  it('uses BODY constants for the overlap calculation', () => {
    // Sanity: changing BODY would break the overlap math; this test exists
    // so the dependency is exercised by the suite.
    expect(BODY.HALF_WIDTH).toBeGreaterThan(0);
    expect(BODY.HEIGHT).toBeGreaterThan(0);
  });
});
