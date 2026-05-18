import { describe, it, expect } from 'vitest';
import { MovingPlatform, type AABB } from '../../src/game/MovingPlatform.js';

const STAGE_W = 800;
const STAGE_H = 600;
const FAR_AWAY: AABB = { x: -1000, y: -1000, w: 1, h: 1 };

describe('MovingPlatform', () => {
  it('starts stationary; tick is a no-op until flip()', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    for (let i = 0; i < 5; i++) p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(100);
    expect(p.ground.y).toBe(100);
    expect(p.isMoving).toBe(false);
  });

  it('flip() starts horizontal motion in the upOrLeft direction', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false, // initial dir = right; flip() makes upOrLeft=true, so moves left
    });
    p.flip();
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.isMoving).toBe(true);
    expect(p.ground.x).toBe(95); // OBSTACLE_SPEED = 5
    expect(p.ground.y).toBe(100);
  });

  it('flip() restarts a stopped platform with reversed direction', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    p.flip(); // dir=left, moving
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(95);
    p.flip(); // dir=right, moving
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(100);
  });

  it('vertical motion: upOrLeft=true moves up (y decreases)', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 20,
      height: 60,
      horizontal: false,
      upOrLeft: true,
    });
    p.flip(); // upOrLeft becomes false → moves down
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.y).toBe(105);
  });

  it('stops + reverts position when next move would exit the stage on the right', () => {
    const p = new MovingPlatform({
      x: STAGE_W - 60,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    p.flip(); // dir=left, moves
    // First need to flip again to make it go right
    p.flip(); // dir=right
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    // 740 → 745, still fits (745+60=805 > 800), stops + reverts to 740
    expect(p.ground.x).toBe(STAGE_W - 60);
    expect(p.isMoving).toBe(false);
  });

  it('stops + reverts position when next move would exit the stage on the left', () => {
    const p = new MovingPlatform({
      x: 3,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    p.flip(); // dir=left
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(3); // would have been -2; reverts
    expect(p.isMoving).toBe(false);
  });

  it('stops + reverts when next move would overlap the avatar bbox', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    p.flip(); // dir=left
    // Put avatar directly to the LEFT of platform; platform moving left should hit it.
    const avatar: AABB = { x: 92, y: 95, w: 20, h: 30 };
    p.tick([], avatar, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(100); // reverted
    expect(p.isMoving).toBe(false);
  });

  it('stops + reverts when next move would overlap another platform', () => {
    const a = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    const b = new MovingPlatform({
      x: 165,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    a.flip(); // dir=left initially; not relevant
    // Make a move right toward b: re-init by flipping again so dir=right.
    a.flip();
    a.tick([a, b], FAR_AWAY, STAGE_W, STAGE_H);
    // a: 100→105 (right edge 165). b left edge=165. Edge touch = not overlap.
    expect(a.ground.x).toBe(105);
    expect(a.isMoving).toBe(true);
    a.tick([a, b], FAR_AWAY, STAGE_W, STAGE_H);
    // a: 105→110 (right edge 170). Overlaps b (left 165). Reverts to 105.
    expect(a.ground.x).toBe(105);
    expect(a.isMoving).toBe(false);
  });

  it('reset() restores initial x/y/direction and stops motion', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    p.flip();
    for (let i = 0; i < 5; i++) p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(75); // moved 25 left
    p.reset();
    expect(p.ground.x).toBe(100);
    expect(p.ground.y).toBe(100);
    expect(p.isMoving).toBe(false);
    // After reset, flip() should resume initial direction's flip (= left again).
    p.flip();
    p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    expect(p.ground.x).toBe(95);
  });

  it('ground.overlapsBox reflects the live position (mutable ground)', () => {
    const p = new MovingPlatform({
      x: 100,
      y: 100,
      width: 60,
      height: 20,
      horizontal: true,
      upOrLeft: false,
    });
    expect(p.ground.overlapsBox(110, 110, 10, 10)).toBe(true);
    p.flip();
    for (let i = 0; i < 4; i++) p.tick([], FAR_AWAY, STAGE_W, STAGE_H);
    // Platform now at x=80; same query at x=110 still overlaps (right edge 140)
    expect(p.ground.x).toBe(80);
    expect(p.ground.overlapsBox(110, 110, 10, 10)).toBe(true);
    expect(p.ground.overlapsBox(140, 110, 10, 10)).toBe(false); // past right edge
  });
});
