// Ported from legacy/src/switchObject.mxml. A switch is a two-state
// panel the player presses with D to flip the direction of all
// attached moving platforms. Reuses the same D-key gesture as orb
// pickup — the legacy `tryPicking` flag is consumed by whichever
// overlapping object handles it first (orb wins if both are in range,
// since handleDKey() checks orb before switches).
//
// Visual is a small dark panel with a glowing indicator dot in the
// middle. The indicator color flips between modes (green ↔ orange)
// and slowly pulses to read as "interactive."
//
// Same alpha-channel issue as Spike — the legacy switchMode1/2 PNGs
// are fully-opaque rasterizations of the SWF symbol bbox, so we draw
// the panel directly with Pixi.Graphics.

import { Container, Graphics } from 'pixi.js';
import { BODY } from './Movements.js';
import type { MovingPlatform } from './MovingPlatform.js';

export interface SwitchConfig {
  /** Top-left x of the switch bbox. */
  x: number;
  /** Top-left y of the switch bbox. */
  y: number;
  /** Width in px. Default 20 (matches legacy switchMode1.png nominal size). */
  width?: number;
  /** Height in px. Default 28. */
  height?: number;
}

export const SWITCH_DEFAULT_W = 20;
export const SWITCH_DEFAULT_H = 28;

const PANEL_FILL = 0x1a1f2e;
const PANEL_BORDER = 0x4a5168;
const INDICATOR_COLOR_MODE_1 = 0x4ade80; // green — initial / "off"
const INDICATOR_COLOR_MODE_2 = 0xfb923c; // orange — activated / "on"
const INDICATOR_RADIUS = 4;
const INDICATOR_HALO_RADIUS = 6;
const PULSE_RATE = 0.1;
const PULSE_AMPLITUDE = 0.12;

function drawPanel(g: Graphics, w: number, h: number): void {
  g.roundRect(0, 0, w, h, 3).fill({ color: PANEL_FILL });
  g.roundRect(1, 1, w - 2, h - 2, 2).stroke({ color: PANEL_BORDER, width: 1 });
}

function drawIndicator(g: Graphics, mode: 1 | 2): void {
  const color = mode === 1 ? INDICATOR_COLOR_MODE_1 : INDICATOR_COLOR_MODE_2;
  g.clear()
    .circle(0, 0, INDICATOR_HALO_RADIUS)
    .fill({ color, alpha: 0.3 })
    .circle(0, 0, INDICATOR_RADIUS)
    .fill({ color });
}

export class Switch {
  readonly container: Container;
  readonly platforms: MovingPlatform[] = [];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  private mode: 1 | 2 = 1;
  private readonly indicator: Graphics;
  private pulsePhase = 0;

  constructor(cfg: SwitchConfig) {
    this.x = cfg.x;
    this.y = cfg.y;
    this.width = cfg.width ?? SWITCH_DEFAULT_W;
    this.height = cfg.height ?? SWITCH_DEFAULT_H;

    this.container = new Container();
    this.container.x = cfg.x;
    this.container.y = cfg.y;

    const panel = new Graphics();
    drawPanel(panel, this.width, this.height);
    this.container.addChild(panel);

    this.indicator = new Graphics();
    this.indicator.x = this.width / 2;
    this.indicator.y = this.height / 2;
    drawIndicator(this.indicator, this.mode);
    this.container.addChild(this.indicator);
  }

  /** Attach a platform that this switch controls. Called at level load. */
  attach(p: MovingPlatform): void {
    this.platforms.push(p);
  }

  /**
   * Toggle the switch + flip all attached platforms. Returns the playSfx
   * key the caller should fire (sfxSwitchOne / sfxSwitchTwo); the caller
   * owns audio routing so the Switch class stays Pixi-only.
   */
  toggle(): 'sfxSwitchOne' | 'sfxSwitchTwo' {
    this.mode = this.mode === 1 ? 2 : 1;
    drawIndicator(this.indicator, this.mode);
    for (const p of this.platforms) p.flip();
    return this.mode === 2 ? 'sfxSwitchTwo' : 'sfxSwitchOne';
  }

  /** True if the avatar body bbox overlaps the switch bbox. */
  overlapsBody(bx: number, by: number): boolean {
    const ax0 = bx - BODY.HALF_WIDTH;
    const ax1 = bx + BODY.HALF_WIDTH;
    const ay0 = by - BODY.HEIGHT;
    const ay1 = by;
    return (
      ax0 < this.x + this.width &&
      ax1 > this.x &&
      ay0 < this.y + this.height &&
      ay1 > this.y
    );
  }

  /** Per-tick indicator pulse animation (no game-state side effects). */
  tick(): void {
    this.pulsePhase += PULSE_RATE;
    const scale = 1 + Math.sin(this.pulsePhase) * PULSE_AMPLITUDE;
    this.indicator.scale.set(scale);
  }

  /** Restore mode 1; called by Level.reset(). Platform reset is separate. */
  reset(): void {
    this.mode = 1;
    drawIndicator(this.indicator, this.mode);
    this.pulsePhase = 0;
    this.indicator.scale.set(1);
  }
}
