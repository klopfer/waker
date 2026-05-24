// Generic full-screen <video> overlay played over the canvas. Used for
// the boot intro (intro.mp4) and the level-complete "wisp obtained"
// animation (levelcomplete.mp4). `play(onDone)` shows it, plays from the
// start, and fires `onDone` exactly once when the video ends or the user
// skips (click / Space / Escape / Enter). Robust to autoplay refusal: it
// retries muted, and if even that fails it finishes immediately so the
// flow never wedges.

import type { AssetLoader } from '../engine/AssetLoader.js';

export interface VideoOverlay {
  readonly el: HTMLElement;
  /** Show + play from the start; fires onDone once when ended/skipped. */
  play(onDone: () => void): void;
}

export interface VideoOverlayOptions {
  /** Mute the video element (e.g. when a separate SFX carries the sound). */
  muted?: boolean;
  /** Skip-hint caption shown bottom-right. */
  hint?: string;
  /**
   * How the video fills the 800×600 stage. Default 'cover' — scales to
   * fill the full stage, cropping the overflow (which is what the legacy
   * Flash MovieClip-in-stage rendering effectively did for the
   * level-complete and ending clips, both natively portrait-aspect at
   * ~856×966). Use 'contain' for content where every pixel matters and
   * letterboxing is acceptable.
   */
  fit?: 'cover' | 'contain';
}

export function makeVideoOverlay(
  assets: AssetLoader,
  videoKey: string,
  options: VideoOverlayOptions = {},
): VideoOverlay {
  const { muted = false, hint = 'click / space to skip ▶', fit = 'cover' } = options;

  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';
  root.style.background = '#000';

  const video = document.createElement('video');
  video.src = assets.url(videoKey);
  video.style.position = 'absolute';
  video.style.inset = '0';
  video.style.width = '800px';
  video.style.height = '600px';
  // `cover` (default) fills the stage by scaling the native frame so the
  // shorter side matches and the longer side overflows (then gets clipped
  // by the container). For the portrait level-complete / ending clips
  // (~856×966), this matches the legacy Flash MovieClip-in-stage behavior
  // — content beyond the stage rect was clipped by the stage, not
  // letterboxed — and gives a substantially larger animation area than
  // `contain` (which letterboxed the portrait source inside the landscape
  // stage). Use `contain` only when every pixel matters.
  video.style.objectFit = fit;
  video.playsInline = true;
  video.preload = 'auto';
  root.appendChild(video);

  const skip = document.createElement('div');
  skip.textContent = hint;
  skip.style.position = 'absolute';
  skip.style.right = '12px';
  skip.style.bottom = '8px';
  skip.style.font = '12px monospace';
  skip.style.color = 'rgba(255,255,255,0.7)';
  skip.style.pointerEvents = 'none';
  root.appendChild(skip);

  let done: (() => void) | null = null;
  function finish(): void {
    if (!done) return;
    const cb = done;
    done = null;
    video.pause();
    root.style.display = 'none';
    window.removeEventListener('keydown', onKey);
    cb();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') finish();
  }
  root.addEventListener('click', finish);
  video.addEventListener('ended', finish);

  return {
    el: root,
    play(onDone) {
      done = onDone;
      root.style.display = 'block';
      video.currentTime = 0;
      video.muted = muted;
      window.addEventListener('keydown', onKey);
      // Called from a user gesture, so playing with sound usually works;
      // if the browser still refuses, retry muted, then give up and
      // finish so the flow never wedges.
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => finish());
      });
    },
  };
}
