import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('arithmetic still works', () => {
    expect(2 + 2).toBe(4);
  });

  it('jsdom environment is available', () => {
    const div = document.createElement('div');
    div.textContent = 'hello';
    expect(div.textContent).toBe('hello');
  });
});
