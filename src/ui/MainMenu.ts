// Main menu — plain HTML overlay over the Pixi canvas (per the project's
// "no React; DOM UI over the canvas" rule). Ports legacy menu.mxml: a
// full-screen background image with four image buttons (Start / Settings /
// Instructions / Credits) at their original 800×600 coordinates, each with
// a mouse-over art swap. Lives inside #ui-root, which is scaled with the
// stage, so the legacy pixel coordinates map directly.

import type { AssetLoader } from '../engine/AssetLoader.js';

export interface MainMenuCallbacks {
  onPlay: () => void;
  onInstructions: () => void;
  onSettings: () => void;
  onCredits: () => void;
}

interface ButtonSpec {
  key: string; // base art manifest key
  moKey: string; // mouse-over art key
  x: number;
  y: number;
  onClick: () => void;
  label: string; // accessible label
}

/** Build an absolutely-positioned image button with a mouse-over art swap. */
function imageButton(assets: AssetLoader, spec: ButtonSpec): HTMLImageElement {
  const img = document.createElement('img');
  const base = assets.url(spec.key);
  const mo = assets.url(spec.moKey);
  img.src = base;
  img.alt = spec.label;
  img.style.position = 'absolute';
  img.style.left = `${spec.x}px`;
  img.style.top = `${spec.y}px`;
  img.style.cursor = 'pointer';
  img.draggable = false;
  img.addEventListener('mouseenter', () => (img.src = mo));
  img.addEventListener('mouseleave', () => (img.src = base));
  img.addEventListener('click', spec.onClick);
  return img;
}

export interface MainMenu {
  readonly el: HTMLElement;
  show(): void;
  hide(): void;
}

export function makeMainMenu(assets: AssetLoader, cb: MainMenuCallbacks): MainMenu {
  const root = document.createElement('div');
  root.id = 'main-menu';
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';

  const bg = document.createElement('img');
  bg.src = assets.url('guiMenuBG');
  bg.alt = 'Waker';
  bg.style.position = 'absolute';
  bg.style.inset = '0';
  bg.style.width = '800px';
  bg.style.height = '600px';
  bg.draggable = false;
  root.appendChild(bg);

  // Coordinates from legacy menu.mxml init().
  const buttons: ButtonSpec[] = [
    { key: 'guiBtnStart', moKey: 'guiBtnStartMo', x: 224, y: 153, onClick: cb.onPlay, label: 'Start' },
    { key: 'guiBtnInstruct', moKey: 'guiBtnInstructMo', x: 306, y: 96, onClick: cb.onInstructions, label: 'Instructions' },
    { key: 'guiBtnSettings', moKey: 'guiBtnSettingsMo', x: 418, y: 96, onClick: cb.onSettings, label: 'Settings' },
    { key: 'guiBtnCredits', moKey: 'guiBtnCreditsMo', x: 484, y: 153, onClick: cb.onCredits, label: 'Credits' },
  ];
  for (const spec of buttons) root.appendChild(imageButton(assets, spec));

  return {
    el: root,
    show: () => {
      root.style.display = 'block';
    },
    hide: () => {
      root.style.display = 'none';
    },
  };
}
