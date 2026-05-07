import { Rectangle, Sprite, Texture } from 'pixi.js';

export interface SpriteSheetGrid {
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export class MovieClipShim {
  private _currentFrame = 0;
  private _playing = false;
  private _loop = true;

  constructor(
    private readonly textures: readonly Texture[],
    private readonly sprite: Sprite,
  ) {
    if (textures.length === 0) throw new Error('MovieClipShim requires >= 1 texture');
    sprite.texture = textures[0]!;
  }

  get framesLoaded(): number {
    return this.textures.length;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  get playing(): boolean {
    return this._playing;
  }

  get loop(): boolean {
    return this._loop;
  }
  set loop(v: boolean) {
    this._loop = v;
  }

  play(): void {
    this._playing = true;
  }

  stop(): void {
    this._playing = false;
  }

  gotoAndStop(frame: number): void {
    this.setFrame(frame);
    this._playing = false;
  }

  gotoAndPlay(frame: number): void {
    this.setFrame(frame);
    this._playing = true;
  }

  nextFrame(): void {
    let f = this._currentFrame + 1;
    if (f >= this.textures.length) {
      if (this._loop) {
        f = 0;
      } else {
        f = this.textures.length - 1;
        this._playing = false;
        return;
      }
    }
    this.setFrame(f);
  }

  prevFrame(): void {
    let f = this._currentFrame - 1;
    if (f < 0) f = this._loop ? this.textures.length - 1 : 0;
    this.setFrame(f);
  }

  update(): void {
    if (this._playing) this.nextFrame();
  }

  private setFrame(frame: number): void {
    if (frame < 0 || frame >= this.textures.length) {
      throw new RangeError(`frame ${frame} out of [0, ${this.textures.length})`);
    }
    this._currentFrame = frame;
    this.sprite.texture = this.textures[frame]!;
  }
}

export function sliceSheet(sheet: Texture, grid: SpriteSheetGrid): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < grid.frameCount; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const sub = new Texture({
      source: sheet.source,
      frame: new Rectangle(
        col * grid.frameWidth,
        row * grid.frameHeight,
        grid.frameWidth,
        grid.frameHeight,
      ),
    });
    out.push(sub);
  }
  return out;
}

export function spriteFromSheet(
  sheet: Texture,
  grid: SpriteSheetGrid,
): { sprite: Sprite; clip: MovieClipShim; textures: Texture[] } {
  const textures = sliceSheet(sheet, grid);
  const sprite = new Sprite(textures[0]);
  const clip = new MovieClipShim(textures, sprite);
  return { sprite, clip, textures };
}
