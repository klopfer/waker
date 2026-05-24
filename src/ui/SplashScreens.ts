// Studio splash logos shown at boot before the main menu. Ports legacy
// `Woosh2.mxml` runAnimation: gambit logo first, fade through black, then
// poof logo (with a "poof!" SFX when poof appears), fade out, then the
// main menu. Click / Space / Enter / Escape skips the whole sequence.
//
// At 24Hz the legacy timings are: gambit hold 68 frames, fade 20, black
// hold 24, poof appears (+ SFX), poof hold 48, fade 20. Total ~180 frames
// ≈ 7.5s. Ported with CSS opacity transitions (slightly compressed for
// modern attention spans — the fade in/out is 800ms each).

import type { AssetLoader } from '../engine/AssetLoader.js';
import type { Audio } from '../engine/Audio.js';

export interface SplashScreens {
  readonly el: HTMLElement;
  /** Show + run the animation; fires onDone exactly once when it ends or is skipped. */
  play(onDone: () => void): void;
}

export function makeSplashScreens(assets: AssetLoader, audio: Audio): SplashScreens {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';
  root.style.background = '#000';
  root.style.cursor = 'pointer';

  const FADE_MS = 800;

  const gambit = document.createElement('img');
  gambit.src = assets.url('gambitClass');
  gambit.alt = 'Singapore-MIT Gambit Game Lab';
  gambit.draggable = false;
  gambit.style.position = 'absolute';
  gambit.style.inset = '0';
  gambit.style.width = '800px';
  gambit.style.height = '600px';
  gambit.style.opacity = '0';
  gambit.style.transition = `opacity ${FADE_MS}ms ease`;
  root.appendChild(gambit);

  const poof = document.createElement('img');
  poof.src = assets.url('poofClass');
  poof.alt = 'Poof Games';
  poof.draggable = false;
  poof.style.position = 'absolute';
  poof.style.inset = '0';
  poof.style.width = '800px';
  poof.style.height = '600px';
  poof.style.opacity = '0';
  poof.style.transition = `opacity ${FADE_MS}ms ease`;
  root.appendChild(poof);

  let done: (() => void) | null = null;
  const timers: number[] = [];
  function clearTimers(): void {
    for (const t of timers) window.clearTimeout(t);
    timers.length = 0;
  }
  function finish(): void {
    if (!done) return;
    const cb = done;
    done = null;
    clearTimers();
    root.style.display = 'none';
    window.removeEventListener('keydown', onKey);
    root.removeEventListener('click', finish);
    cb();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') finish();
  }
  function at(ms: number, fn: () => void): void {
    timers.push(window.setTimeout(fn, ms));
  }

  return {
    el: root,
    play(onDone: () => void) {
      done = onDone;
      gambit.style.opacity = '0';
      poof.style.opacity = '0';
      root.style.display = 'block';
      window.addEventListener('keydown', onKey);
      root.addEventListener('click', finish);

      // T=0  : gambit fades in
      at(50, () => (gambit.style.opacity = '1'));
      // T=2.5s: gambit fades out (legacy held ~2.8s before fade)
      at(2500, () => (gambit.style.opacity = '0'));
      // T=3.3s: black hold ends, poof appears + plays poof SFX
      at(3300, () => {
        audio.playSfx('sfxPoof', assets.url('sfxPoof'));
        poof.style.opacity = '1';
      });
      // T=5.8s: poof fades out (~2.5s hold)
      at(5800, () => (poof.style.opacity = '0'));
      // T=6.7s: done
      at(6700, finish);
    },
  };
}
