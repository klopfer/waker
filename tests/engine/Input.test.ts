import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Input } from '../../src/engine/Input.js';

describe('Input', () => {
  let target: EventTarget;
  let input: Input;

  beforeEach(() => {
    target = new EventTarget();
    input = new Input(target);
  });

  afterEach(() => {
    input.dispose();
  });

  function keydown(code: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { code }));
  }

  function keyup(code: string): void {
    target.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }

  it('records pressed and down on keydown', () => {
    keydown('ArrowRight');
    expect(input.isDown('ArrowRight')).toBe(true);
    expect(input.wasPressed('ArrowRight')).toBe(true);
    expect(input.wasReleased('ArrowRight')).toBe(false);
  });

  it('endTick clears pressed/released but preserves down', () => {
    keydown('Space');
    input.endTick();
    expect(input.wasPressed('Space')).toBe(false);
    expect(input.isDown('Space')).toBe(true);
  });

  it('records released on keyup', () => {
    keydown('KeyD');
    input.endTick();
    keyup('KeyD');
    expect(input.isDown('KeyD')).toBe(false);
    expect(input.wasReleased('KeyD')).toBe(true);
  });

  it('OS auto-repeat does not retrigger pressed', () => {
    keydown('ArrowLeft');
    input.endTick();
    keydown('ArrowLeft'); // simulated repeat without intervening keyup
    expect(input.wasPressed('ArrowLeft')).toBe(false);
    expect(input.isDown('ArrowLeft')).toBe(true);
  });

  it('blur releases all held keys', () => {
    keydown('ArrowRight');
    keydown('Space');
    target.dispatchEvent(new Event('blur'));
    expect(input.isDown('ArrowRight')).toBe(false);
    expect(input.isDown('Space')).toBe(false);
    expect(input.wasReleased('ArrowRight')).toBe(true);
    expect(input.wasReleased('Space')).toBe(true);
  });

  it('dispose detaches listeners', () => {
    input.dispose();
    keydown('ArrowRight');
    expect(input.isDown('ArrowRight')).toBe(false);
  });
});
