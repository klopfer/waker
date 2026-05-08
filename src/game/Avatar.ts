import { Container } from 'pixi.js';
import type { AvatarStateName } from '../assets/sprites/avatar/manifest.types.js';
import { preloadAvatarStates, type LoadedAvatarState } from './AvatarSprites.js';

// Threshold ported from legacy/src/avatar.mxml lines 157+:
//   else if (Math.abs(previousPos.x-this.x)>4*1.5) -> run else walk
// (movements.mxml: WALKINGSPEED = 4 * 1.5 gameSpeed)
const RUN_THRESHOLD_PX_PER_TICK = 6;
const IDLE_THRESHOLD_PX_PER_TICK = 0.5;

export interface AvatarInputs {
  vx: number;
  vy: number;
  onGround: boolean;
  facingRight: boolean;
}

export function detectAvatarState(inputs: AvatarInputs): AvatarStateName {
  const dir = inputs.facingRight ? 'right' : 'left';
  if (!inputs.onGround) {
    return (inputs.vy < 0 ? `jumpup-${dir}` : `jumpdown-${dir}`) as AvatarStateName;
  }
  const speed = Math.abs(inputs.vx);
  if (speed < IDLE_THRESHOLD_PX_PER_TICK) return `idle-${dir}` as AvatarStateName;
  if (speed > RUN_THRESHOLD_PX_PER_TICK) return `run-${dir}` as AvatarStateName;
  return `walk-${dir}` as AvatarStateName;
}

export const ALL_AVATAR_STATES: readonly AvatarStateName[] = [
  'idle-left',
  'idle-right',
  'walk-left',
  'walk-right',
  'run-left',
  'run-right',
  'jumpup-left',
  'jumpup-right',
  'jumpdown-left',
  'jumpdown-right',
];

export class Avatar {
  readonly container: Container;
  private readonly states: Map<AvatarStateName, LoadedAvatarState>;
  private readonly displayScale: number;
  private active: LoadedAvatarState | null = null;
  private _stateName: AvatarStateName = 'idle-right';

  private constructor(states: Map<AvatarStateName, LoadedAvatarState>, displayScale: number) {
    this.states = states;
    this.displayScale = displayScale;
    this.container = new Container();
    this.applyState('idle-right');
  }

  static async preload(displayScale = 0.3): Promise<Avatar> {
    const states = await preloadAvatarStates(ALL_AVATAR_STATES);
    return new Avatar(states, displayScale);
  }

  get x(): number {
    return this.container.x;
  }
  get y(): number {
    return this.container.y;
  }
  get state(): AvatarStateName {
    return this._stateName;
  }

  setPosition(x: number, y: number): void {
    // Round to integer pixel positions to avoid bilinear-filter bleed at
    // frame boundaries when the GPU samples sub-pixel-positioned sprites.
    // Sub-pixel motion looks fine without filtering anyway because we render
    // at 24 Hz fixed step.
    this.container.x = Math.round(x);
    this.container.y = Math.round(y);
  }

  /**
   * Advance one simulation tick. Switches state if movement vector demands
   * it, then advances the active clip's animation by one frame.
   * Returns the new state name iff it changed, else null (useful for
   * triggering one-shot SFX from the caller).
   */
  update(inputs: AvatarInputs): AvatarStateName | null {
    const next = detectAvatarState(inputs);
    let changed: AvatarStateName | null = null;
    if (next !== this._stateName) {
      this.applyState(next);
      changed = next;
    }
    this.active?.clip.update();
    return changed;
  }

  private applyState(name: AvatarStateName): void {
    if (this.active) this.container.removeChild(this.active.sprite);
    const next = this.states.get(name);
    if (!next) throw new Error(`avatar state not preloaded: ${name}`);
    next.sprite.anchor.set(0.5, 1);
    const flipX = next.meta.flipHorizontal ? -1 : 1;
    next.sprite.scale.set(this.displayScale * flipX, this.displayScale);
    next.clip.gotoAndPlay(0);
    this.container.addChild(next.sprite);
    this.active = next;
    this._stateName = name;
  }
}
