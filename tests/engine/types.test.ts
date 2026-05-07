import { describe, it, expect } from 'vitest';
import { Color, PairObject } from '../../src/engine/types.js';

describe('types', () => {
  it('Color constants match the original AS3 hex values', () => {
    expect(Color.BLACK).toBe(0x000000);
    expect(Color.WHITE).toBe(0xffffff);
    expect(Color.RED).toBe(0xff0000);
    expect(Color.PURPLE).toBe(0xc04ce6);
    expect(Color.DARK_GREEN).toBe(0x009804);
  });

  it('PairObject defaults triggered to false', () => {
    const p = new PairObject('orb', 'graph', 'velocity');
    expect(p.trigger).toBe('orb');
    expect(p.target).toBe('graph');
    expect(p.type).toBe('velocity');
    expect(p.triggered).toBe(false);
  });
});
