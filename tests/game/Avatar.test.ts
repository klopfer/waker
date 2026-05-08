import { describe, it, expect } from 'vitest';
import { detectAvatarState } from '../../src/game/Avatar.js';

describe('detectAvatarState', () => {
  it('returns idle when vx is near zero on ground', () => {
    expect(detectAvatarState({ vx: 0, vy: 0, onGround: true, facingRight: true })).toBe('idle-right');
    expect(detectAvatarState({ vx: 0.4, vy: 0, onGround: true, facingRight: true })).toBe('idle-right');
    expect(detectAvatarState({ vx: -0.4, vy: 0, onGround: true, facingRight: false })).toBe('idle-left');
  });

  it('returns walk for non-zero ground speeds up to and including the run threshold', () => {
    expect(detectAvatarState({ vx: 1, vy: 0, onGround: true, facingRight: true })).toBe('walk-right');
    expect(detectAvatarState({ vx: 6, vy: 0, onGround: true, facingRight: true })).toBe('walk-right');
    expect(detectAvatarState({ vx: -3, vy: 0, onGround: true, facingRight: false })).toBe('walk-left');
  });

  it('returns run above the threshold (matches legacy abs > 4*1.5 check)', () => {
    expect(detectAvatarState({ vx: 6.1, vy: 0, onGround: true, facingRight: true })).toBe('run-right');
    expect(detectAvatarState({ vx: 12, vy: 0, onGround: true, facingRight: true })).toBe('run-right');
    expect(detectAvatarState({ vx: -10, vy: 0, onGround: true, facingRight: false })).toBe('run-left');
  });

  it('returns jumpup when airborne with negative vy (rising)', () => {
    expect(detectAvatarState({ vx: 0, vy: -5, onGround: false, facingRight: true })).toBe('jumpup-right');
    expect(detectAvatarState({ vx: 8, vy: -2, onGround: false, facingRight: false })).toBe('jumpup-left');
  });

  it('returns jumpdown when airborne with non-negative vy (falling/peaking)', () => {
    expect(detectAvatarState({ vx: 0, vy: 0, onGround: false, facingRight: true })).toBe('jumpdown-right');
    expect(detectAvatarState({ vx: -2, vy: 5, onGround: false, facingRight: false })).toBe('jumpdown-left');
  });

  it('honors facingRight independent of vx sign', () => {
    expect(detectAvatarState({ vx: -3, vy: 0, onGround: true, facingRight: true })).toBe('walk-right');
    expect(detectAvatarState({ vx: 3, vy: 0, onGround: true, facingRight: false })).toBe('walk-left');
  });
});
