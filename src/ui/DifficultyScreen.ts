// Settings screen — difficulty selector. Ports legacy
// difficulty_selector.mxml: an options panel (guiOptionsScreenBG, 550×400
// at 125,100) with three centered buttons (Easy/Medium/Hard at screen-x
// 300/400/500, y≈250); the chosen one shows its "selected" art. Click
// outside the panel or press Escape to close. Plain DOM over the canvas.

import type { AssetLoader } from '../engine/AssetLoader.js';
import type { Difficulty } from '../engine/types.js';

export interface DifficultyScreen {
  readonly el: HTMLElement;
  show(): void;
  hide(): void;
  readonly visible: boolean;
}

interface DiffBtn {
  value: Difficulty;
  base: string;
  selected: string;
  cx: number;
}

export function makeDifficultyScreen(
  assets: AssetLoader,
  getDifficulty: () => Difficulty,
  setDifficulty: (d: Difficulty) => void,
  onClose: () => void,
): DifficultyScreen {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';

  // Panel background (centered card).
  const panel = document.createElement('img');
  panel.src = assets.url('guiOptionsScreenBG');
  panel.style.position = 'absolute';
  panel.style.left = '125px';
  panel.style.top = '100px';
  panel.style.width = '550px';
  panel.style.height = '400px';
  panel.draggable = false;
  root.appendChild(panel);

  const specs: DiffBtn[] = [
    { value: 1, base: 'guiBtnEasy', selected: 'guiBtnEasySelected', cx: 300 },
    { value: 2, base: 'guiBtnMedium', selected: 'guiBtnMediumSelected', cx: 400 },
    { value: 3, base: 'guiBtnHard', selected: 'guiBtnHardSelected', cx: 500 },
  ];
  const imgs = new Map<Difficulty, HTMLImageElement>();
  for (const s of specs) {
    const img = document.createElement('img');
    img.style.position = 'absolute';
    img.style.left = `${s.cx}px`;
    img.style.top = '250px';
    img.style.width = '86px';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.cursor = 'pointer';
    img.draggable = false;
    img.alt = `Difficulty ${s.value}`;
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      setDifficulty(s.value);
      refresh();
    });
    imgs.set(s.value, img);
    root.appendChild(img);
  }

  function refresh(): void {
    const cur = getDifficulty();
    for (const s of specs) {
      const img = imgs.get(s.value)!;
      img.src = assets.url(s.value === cur ? s.selected : s.base);
    }
  }

  // Click anywhere outside the buttons (the backdrop / panel) closes.
  let isVisible = false;
  const close = (): void => {
    if (!isVisible) return;
    hide();
    onClose();
  };
  root.addEventListener('click', close);

  function show(): void {
    refresh();
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
