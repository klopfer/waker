// In-game pause menu (Esc during gameplay). Plain HTML overlay over the
// canvas. Holds the controls the player needs while a level is loaded:
// Resume, Restart Level, Quit to Main Menu, plus Music / Sound / Difficulty
// toggles and a runtime toggle for the development chrome (top banner +
// level/difficulty pickers + mute buttons in the corners).
//
// Style is a centered card with text buttons — no baked panel art (the
// guiOptionsScreenBG card is reserved for the main-menu Settings screen).

import type { Audio } from '../engine/Audio.js';
import type { Difficulty } from '../engine/types.js';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  getDifficulty: () => Difficulty;
  setDifficulty: (d: Difficulty) => void;
  getDebugVisible: () => boolean;
  setDebugVisible: (visible: boolean) => void;
}

export interface PauseMenu {
  readonly el: HTMLElement;
  show(): void;
  hide(): void;
  readonly visible: boolean;
}

export function makePauseMenu(audio: Audio, cb: PauseMenuCallbacks): PauseMenu {
  const root = document.createElement('div');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.display = 'none';
  root.style.background = 'rgba(0, 0, 0, 0.55)';

  // Centered card.
  const card = document.createElement('div');
  card.style.position = 'absolute';
  card.style.left = '50%';
  card.style.top = '50%';
  card.style.transform = 'translate(-50%, -50%)';
  card.style.width = '420px';
  card.style.padding = '28px 32px';
  card.style.background = '#1c2127';
  card.style.border = '2px solid #3a4350';
  card.style.borderRadius = '12px';
  card.style.color = '#e8ecef';
  card.style.font = "16px 'Comic Sans MS', sans-serif";
  card.style.textAlign = 'center';
  card.addEventListener('click', (e) => e.stopPropagation());
  root.appendChild(card);

  const title = document.createElement('div');
  title.textContent = 'Paused';
  title.style.font = "700 24px 'Comic Sans MS', sans-serif";
  title.style.marginBottom = '20px';
  card.appendChild(title);

  // ── Main actions ──
  const resumeBtn = makeButton('Resume', () => cb.onResume(), { primary: true });
  card.appendChild(resumeBtn);

  const restartBtn = makeButton('Restart Level', () => cb.onRestart());
  card.appendChild(restartBtn);

  const quitBtn = makeButton('Quit to Menu', () => cb.onQuit());
  card.appendChild(quitBtn);

  // ── Divider ──
  const divider = document.createElement('hr');
  divider.style.border = 'none';
  divider.style.borderTop = '1px solid #3a4350';
  divider.style.margin = '20px 0 16px';
  card.appendChild(divider);

  // ── Difficulty (three buttons in a row, current is highlighted) ──
  const diffRow = document.createElement('div');
  diffRow.style.display = 'flex';
  diffRow.style.gap = '8px';
  diffRow.style.alignItems = 'center';
  diffRow.style.marginBottom = '12px';

  const diffLabel = document.createElement('span');
  diffLabel.textContent = 'Difficulty';
  diffLabel.style.flex = '0 0 100px';
  diffLabel.style.textAlign = 'left';
  diffRow.appendChild(diffLabel);

  const diffBtns = new Map<Difficulty, HTMLButtonElement>();
  for (const [val, lbl] of [[1, 'Easy'], [2, 'Medium'], [3, 'Hard']] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lbl;
    b.style.flex = '1';
    b.style.padding = '6px 10px';
    b.style.borderRadius = '8px';
    b.style.border = '2px solid #3a4350';
    b.style.background = '#252b33';
    b.style.color = '#cfd5dc';
    b.style.cursor = 'pointer';
    b.style.font = "600 13px 'Comic Sans MS', sans-serif";
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.setDifficulty(val);
      refresh();
    });
    diffBtns.set(val, b);
    diffRow.appendChild(b);
  }
  card.appendChild(diffRow);

  // ── Toggle rows (Music, SFX, Debug UI) ──
  const musicRow = makeToggleRow('Music', () => {
    audio.setBgmMute(!audio.config.bgmMute);
    refresh();
  });
  card.appendChild(musicRow.el);

  const sfxRow = makeToggleRow('Sound Effects', () => {
    audio.setSfxMute(!audio.config.sfxMute);
    refresh();
  });
  card.appendChild(sfxRow.el);

  const debugRow = makeToggleRow('Debug UI', () => {
    cb.setDebugVisible(!cb.getDebugVisible());
    refresh();
  });
  card.appendChild(debugRow.el);

  function refresh(): void {
    const cur = cb.getDifficulty();
    for (const [val, btn] of diffBtns) {
      const selected = val === cur;
      btn.style.background = selected ? '#3d6b9c' : '#252b33';
      btn.style.borderColor = selected ? '#5b8fc6' : '#3a4350';
      btn.style.color = selected ? '#ffffff' : '#cfd5dc';
    }
    musicRow.set(!audio.config.bgmMute);
    sfxRow.set(!audio.config.sfxMute);
    debugRow.set(cb.getDebugVisible());
  }

  let isVisible = false;
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

interface ToggleRow {
  el: HTMLElement;
  set(on: boolean): void;
}

function makeToggleRow(label: string, onClick: () => void): ToggleRow {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.marginBottom = '8px';

  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.flex = '1';
  lbl.style.textAlign = 'left';
  row.appendChild(lbl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.width = '72px';
  btn.style.height = '28px';
  btn.style.borderRadius = '14px';
  btn.style.border = '2px solid #3a4350';
  btn.style.cursor = 'pointer';
  btn.style.font = "700 13px 'Comic Sans MS', sans-serif";
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  row.appendChild(btn);

  function set(on: boolean): void {
    btn.textContent = on ? 'ON' : 'OFF';
    btn.style.background = on ? '#7ed957' : '#525860';
    btn.style.color = on ? '#14391a' : '#cfd5dc';
  }
  set(false);

  return { el: row, set };
}

function makeButton(label: string, onClick: () => void, opts: { primary?: boolean } = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.display = 'block';
  b.style.width = '100%';
  b.style.padding = '10px 0';
  b.style.marginBottom = '10px';
  b.style.borderRadius = '8px';
  b.style.border = '2px solid #3a4350';
  b.style.cursor = 'pointer';
  b.style.font = "600 16px 'Comic Sans MS', sans-serif";
  b.style.background = opts.primary ? '#3d6b9c' : '#252b33';
  b.style.color = opts.primary ? '#ffffff' : '#cfd5dc';
  b.addEventListener('mouseenter', () => {
    b.style.background = opts.primary ? '#4a7eb5' : '#2f3640';
  });
  b.addEventListener('mouseleave', () => {
    b.style.background = opts.primary ? '#3d6b9c' : '#252b33';
  });
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
