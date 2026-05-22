import { Howl } from 'howler';

export interface AudioConfig {
  sfxVolume: number;
  bgmVolume: number;
  sfxMute: boolean;
  bgmMute: boolean;
}

export type AudioId = string;

export class Audio {
  private readonly cfg: AudioConfig;
  private readonly sfxCache = new Map<AudioId, Howl>();
  private bgm: Howl | null = null;
  private bgmKey: AudioId | null = null;
  private vo: Howl | null = null;
  private voKey: AudioId | null = null;

  constructor(initial: Partial<AudioConfig> = {}) {
    this.cfg = {
      sfxVolume: 0.5,
      bgmVolume: 0.5,
      sfxMute: false,
      bgmMute: false,
      ...initial,
    };
  }

  get config(): Readonly<AudioConfig> {
    return this.cfg;
  }

  setSfxVolume(v: number): void {
    this.cfg.sfxVolume = clamp01(v);
  }

  setBgmVolume(v: number): void {
    this.cfg.bgmVolume = clamp01(v);
    if (this.bgm) this.bgm.volume(this.effectiveBgmVolume());
  }

  setSfxMute(mute: boolean): void {
    this.cfg.sfxMute = mute;
    if (this.vo) this.vo.volume(this.effectiveVoVolume());
  }

  setBgmMute(mute: boolean): void {
    this.cfg.bgmMute = mute;
    if (this.bgm) this.bgm.volume(this.effectiveBgmVolume());
  }

  playSfx(key: AudioId, src: string | string[], baseVolume = 1): number | null {
    if (this.cfg.sfxMute) return null;
    let h = this.sfxCache.get(key);
    if (!h) {
      h = new Howl({ src: typeof src === 'string' ? [src] : src });
      this.sfxCache.set(key, h);
    }
    h.volume(this.cfg.sfxVolume * baseVolume);
    return h.play();
  }

  playBgm(key: AudioId, src: string | string[], loop = true): void {
    if (this.bgmKey === key && this.bgm?.playing()) return;
    this.stopBgm();
    const h = new Howl({
      src: typeof src === 'string' ? [src] : src,
      loop,
      volume: this.effectiveBgmVolume(),
    });
    h.play();
    this.bgm = h;
    this.bgmKey = key;
  }

  /**
   * Play a one-shot voice-over (cutscene narration). Plays at SFX volume
   * and obeys the SFX mute flag (matching the legacy soundManager, where
   * VO rode the SFX channel). Not looped. De-duped by `key`: re-requesting
   * the VO that is already current is a no-op, so a narration started on
   * the intro video keeps playing seamlessly through the walk-across
   * cutscene that requests the same track (rather than restarting). Stays
   * running across transitions until `stopVo()` (called when gameplay
   * begins).
   */
  playVo(key: AudioId, src: string | string[]): void {
    if (this.voKey === key) return;
    this.stopVo();
    this.voKey = key;
    const h = new Howl({
      src: typeof src === 'string' ? [src] : src,
      loop: false,
      volume: this.effectiveVoVolume(),
    });
    h.play();
    this.vo = h;
  }

  stopVo(): void {
    this.voKey = null;
    if (!this.vo) return;
    this.vo.stop();
    this.vo.unload();
    this.vo = null;
  }

  stopBgm(fadeMs = 250): void {
    const h = this.bgm;
    if (!h) return;
    this.bgm = null;
    this.bgmKey = null;
    if (fadeMs > 0) {
      h.fade(h.volume(), 0, fadeMs);
      setTimeout(() => h.unload(), fadeMs + 50);
    } else {
      h.unload();
    }
  }

  dispose(): void {
    this.stopBgm(0);
    this.stopVo();
    for (const h of this.sfxCache.values()) h.unload();
    this.sfxCache.clear();
  }

  private effectiveBgmVolume(): number {
    return this.cfg.bgmMute ? 0 : this.cfg.bgmVolume;
  }

  private effectiveVoVolume(): number {
    return this.cfg.sfxMute ? 0 : this.cfg.sfxVolume;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
