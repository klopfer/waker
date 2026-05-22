// Settings screen. Ports legacy difficulty_selector.mxml + soundOptions.mxml:
// an options panel (guiOptionsScreenBG, 550×400 at 125,100) with three
// difficulty buttons (Easy/Medium/Hard) whose chosen one shows its
// "selected" art, plus Music and Sound-Effects on/off toggles wired to the
// shared Audio mute flags. The panel art (settings_screen.png) bakes in the
// "DIFFICULTY", "SOUND", "Music" and "Sound Effects" labels; this overlay
// adds the live controls. Click outside the controls or press Escape to
// close. Plain DOM over the canvas.

import type { AssetLoader } from '../engine/AssetLoader.js';
import type { Audio } from '../engine/Audio.js';
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
  audio: Audio,
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

  // ── Difficulty buttons ──
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

  // ── Sound toggles (line up with the baked "Music" / "Sound Effects"
  //    labels in the lower-left of the panel) ──
  const musicToggle = makeToggle(420, 345, 'Toggle music', () => {
    audio.setBgmMute(!audio.config.bgmMute);
    refresh();
  });
  const sfxToggle = makeToggle(420, 383, 'Toggle sound effects', () => {
    audio.setSfxMute(!audio.config.sfxMute);
    refresh();
  });
  root.appendChild(musicToggle.el);
  root.appendChild(sfxToggle.el);

  function refresh(): void {
    const cur = getDifficulty();
    for (const s of specs) {
      const img = imgs.get(s.value)!;
      img.src = assets.url(s.value === cur ? s.selected : s.base);
    }
    musicToggle.set(!audio.config.bgmMute);
    sfxToggle.set(!audio.config.sfxMute);
  }

  // Click anywhere outside the controls (the backdrop / panel) closes.
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

interface Toggle {
  el: HTMLElement;
  set(on: boolean): void;
}

/** A small ON/OFF pill button at the given stage coordinates. */
function makeToggle(x: number, y: number, label: string, onClick: () => void): Toggle {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  btn.style.position = 'absolute';
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
  btn.style.transform = 'translate(0, -50%)';
  btn.style.width = '64px';
  btn.style.height = '28px';
  btn.style.borderRadius = '14px';
  btn.style.border = '2px solid #333';
  btn.style.cursor = 'pointer';
  btn.style.font = "700 14px 'Comic Sans MS', sans-serif";
  btn.style.padding = '0';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  function set(on: boolean): void {
    btn.textContent = on ? 'ON' : 'OFF';
    btn.style.background = on ? '#7ed957' : '#d9d9d9';
    btn.style.color = on ? '#14391a' : '#555';
  }
  set(true);

  return { el: btn, set };
}
