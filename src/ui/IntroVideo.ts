// Intro cutscene video (intro.mp4). Plays full-screen over the canvas;
// click / Space / Escape skips it. `onDone` fires when it ends or is
// skipped. Plain DOM <video>.
//
// In the legacy game the intro plays at boot before the menu; on the web,
// audio can't autoplay before a user gesture, so the flow plays it after
// the player clicks "Start" (which is the gesture that also unlocks the
// video's sound).

import type { AssetLoader } from '../engine/AssetLoader.js';

export interface IntroVideo {
  readonly el: HTMLElement;
  /** Show + play from the start; resolves (via onDone) when ended/skipped. */
  play(onDone: () => void): void;
}

export function makeIntroVideo(assets: AssetLoader): IntroVideo {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';
  root.style.background = '#000';

  const video = document.createElement('video');
  video.src = assets.url('introCutScene');
  video.style.position = 'absolute';
  video.style.inset = '0';
  video.style.width = '800px';
  video.style.height = '600px';
  video.playsInline = true;
  video.preload = 'auto';
  root.appendChild(video);

  const skip = document.createElement('div');
  skip.textContent = 'click / space to skip ▶';
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
      video.muted = false;
      window.addEventListener('keydown', onKey);
      // Try to play with sound (we're called from a click gesture); if the
      // browser still refuses, fall back to muted so the visuals play.
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => finish());
      });
    },
  };
}
