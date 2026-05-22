// Full-screen image overlay used for the Instructions and Credits screens
// (legacy menu.mxml `instructions` / `credits` states). Click anywhere or
// press Escape to close. Plain DOM over the canvas.

import type { AssetLoader } from '../engine/AssetLoader.js';

export interface ImageScreen {
  readonly el: HTMLElement;
  show(): void;
  hide(): void;
  readonly visible: boolean;
}

export function makeImageScreen(
  assets: AssetLoader,
  imageKey: string,
  onClose: () => void,
): ImageScreen {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';

  const img = document.createElement('img');
  img.src = assets.url(imageKey);
  img.style.position = 'absolute';
  img.style.inset = '0';
  img.style.width = '800px';
  img.style.height = '600px';
  img.style.cursor = 'pointer';
  img.draggable = false;
  root.appendChild(img);

  let isVisible = false;
  const close = (): void => {
    if (!isVisible) return;
    hide();
    onClose();
  };
  root.addEventListener('click', close);

  function show(): void {
    root.style.display = 'block';
    isVisible = true;
  }
  function hide(): void {
    root.style.display = 'none';
    isVisible = false;
  }

  return {
    el: root,
    show,
    hide,
    get visible() {
      return isVisible;
    },
  };
}
