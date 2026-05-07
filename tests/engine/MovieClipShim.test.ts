import { describe, it, expect } from 'vitest';
import type { Sprite, Texture } from 'pixi.js';
import { MovieClipShim } from '../../src/engine/MovieClipShim.js';

function fakeSprite(): Sprite {
  return { texture: null } as unknown as Sprite;
}

function fakeTextures(n: number): Texture[] {
  return Array.from({ length: n }, (_, i) => i as unknown as Texture);
}

describe('MovieClipShim', () => {
  it('starts at frame 0 and not playing', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(5), s);
    expect(clip.currentFrame).toBe(0);
    expect(clip.framesLoaded).toBe(5);
    expect(clip.playing).toBe(false);
    expect(s.texture).toBe(0 as unknown as Texture);
  });

  it('throws if constructed with no textures', () => {
    expect(() => new MovieClipShim([], fakeSprite())).toThrow();
  });

  it('play+update advances frame each tick', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(3), s);
    clip.play();
    clip.update();
    expect(clip.currentFrame).toBe(1);
    expect(s.texture).toBe(1 as unknown as Texture);
    clip.update();
    expect(clip.currentFrame).toBe(2);
  });

  it('loops by default at end of sequence', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(3), s);
    clip.gotoAndPlay(2);
    clip.update();
    expect(clip.currentFrame).toBe(0);
    expect(clip.playing).toBe(true);
  });

  it('stops at last frame when loop=false', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(3), s);
    clip.loop = false;
    clip.gotoAndPlay(2);
    clip.update();
    expect(clip.currentFrame).toBe(2);
    expect(clip.playing).toBe(false);
  });

  it('gotoAndStop sets frame and pauses', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(5), s);
    clip.play();
    clip.gotoAndStop(3);
    expect(clip.currentFrame).toBe(3);
    expect(clip.playing).toBe(false);
    expect(s.texture).toBe(3 as unknown as Texture);
  });

  it('update is a no-op when stopped', () => {
    const s = fakeSprite();
    const clip = new MovieClipShim(fakeTextures(5), s);
    clip.update();
    expect(clip.currentFrame).toBe(0);
  });

  it('gotoAndStop throws on out-of-range frame', () => {
    const clip = new MovieClipShim(fakeTextures(3), fakeSprite());
    expect(() => clip.gotoAndStop(-1)).toThrow();
    expect(() => clip.gotoAndStop(3)).toThrow();
  });

  it('prevFrame wraps to last when looping', () => {
    const clip = new MovieClipShim(fakeTextures(4), fakeSprite());
    clip.prevFrame();
    expect(clip.currentFrame).toBe(3);
  });

  it('prevFrame clamps to 0 when not looping', () => {
    const clip = new MovieClipShim(fakeTextures(4), fakeSprite());
    clip.loop = false;
    clip.prevFrame();
    expect(clip.currentFrame).toBe(0);
  });
});
