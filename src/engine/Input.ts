export type KeyCode = string;

export interface InputOptions {
  preventDefaultFor?: readonly KeyCode[];
}

export class Input {
  private readonly down = new Set<KeyCode>();
  private readonly pressed = new Set<KeyCode>();
  private readonly released = new Set<KeyCode>();
  private readonly preventDefaultFor: ReadonlySet<KeyCode>;
  private readonly target: EventTarget;

  constructor(target: EventTarget = window, opts: InputOptions = {}) {
    this.target = target;
    this.preventDefaultFor = new Set(opts.preventDefaultFor ?? []);
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  endTick(): void {
    this.pressed.clear();
    this.released.clear();
  }

  isDown(code: KeyCode): boolean {
    return this.down.has(code);
  }

  wasPressed(code: KeyCode): boolean {
    return this.pressed.has(code);
  }

  wasReleased(code: KeyCode): boolean {
    return this.released.has(code);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }

  private readonly handleKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (this.preventDefaultFor.has(ke.code)) ke.preventDefault();
    if (!this.down.has(ke.code)) {
      this.pressed.add(ke.code);
      this.down.add(ke.code);
    }
  };

  private readonly handleKeyUp = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (this.preventDefaultFor.has(ke.code)) ke.preventDefault();
    if (this.down.delete(ke.code)) {
      this.released.add(ke.code);
    }
  };

  private readonly handleBlur = (): void => {
    for (const code of this.down) this.released.add(code);
    this.down.clear();
  };
}
