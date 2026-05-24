// Owns the currently active Level and handles transitions between them.
// `start()` loads the initial level; when the player presses SPACE on a
// level's win overlay, LevelManager disposes the current Level and loads
// the one referenced by `cfg.nextLevel`. If there's no next level the
// SPACE press falls through to the Level's own reset() (terminal level
// → restart-on-space, matching the pre-transition behavior).
//
// Per CLAUDE.md §14 item 14, this is the dispatch layer between
// individual Level instances. It deliberately stays small.
//
// Difficulty: stored on the manager and passed to every LevelBuilder
// invocation. Calling `setDifficulty()` re-runs the current builder
// with the new difficulty and reloads the level — used by the debug
// difficulty-picker UI.

import { Level, type LevelBuilder, type LevelDeps } from './Level.js';
import type { Difficulty } from '../engine/types.js';

export class LevelManager {
  private current: Level | null = null;
  private currentBuilder: LevelBuilder | null = null;
  private currentDifficulty: Difficulty = 1; // 1 = easy, 2 = medium, 3 = hard
  private deps: LevelDeps | null = null;
  private readonly difficultyListeners = new Set<() => void>();

  /**
   * When set, called once per non-cutscene level completion to present
   * the "wisp obtained" sequence; the manager passes a `done` callback
   * that advances to the next level. If unset, levels advance straight
   * away (used in tests / headless). See main.ts for the video wiring.
   */
  winPresenter: ((done: () => void) => void) | null = null;

  /**
   * When set, called when a `gameEnds` level (mixed3) completes — plays
   * the ending cutscene video, then the `done` callback returns the
   * player to the main menu. Takes precedence over `winPresenter` for
   * the terminal level. If unset on a gameEnds level, falls back to
   * the regular wisp animation.
   */
  endingPresenter: ((done: () => void) => void) | null = null;

  /** True if there's an active level being driven by tick(). */
  get hasLevel(): boolean {
    return this.current !== null;
  }

  get difficulty(): Difficulty {
    return this.currentDifficulty;
  }

  /**
   * The builder for the level currently loaded (if any). Used by the
   * pause menu's "Restart Level" to reload the same level + difficulty.
   */
  get builder(): LevelBuilder | null {
    return this.currentBuilder;
  }

  /**
   * Dispose the current level and clear all manager state. Used by the
   * pause menu's "Quit to Menu" to fully tear down before the player
   * picks Start again. Safe to call when no level is loaded.
   */
  quit(): void {
    const old = this.current;
    this.current = null;
    this.currentBuilder = null;
    old?.dispose();
  }

  /**
   * Show/hide the per-level debug readout (bottom-center "tick / avatar="
   * text). Remembered across level loads so newly-loaded levels inherit
   * the current visibility.
   */
  private debugReadoutVisible = false;
  setDebugReadoutVisible(visible: boolean): void {
    this.debugReadoutVisible = visible;
    this.current?.setDebugReadoutVisible(visible);
  }

  /**
   * Subscribe to difficulty changes (the options screen and the in-game
   * difficulty readout both need to reflect external changes). Returns
   * an unsubscribe function.
   */
  onDifficultyChange(cb: () => void): () => void {
    this.difficultyListeners.add(cb);
    return () => this.difficultyListeners.delete(cb);
  }

  private setDifficultyValue(d: Difficulty): void {
    if (this.currentDifficulty === d) return;
    this.currentDifficulty = d;
    for (const cb of this.difficultyListeners) cb();
  }

  /**
   * Load a level as the starting scene. Difficulty defaults to 1 (easy).
   * Safe to call repeatedly (e.g. each time the player picks Start on the
   * menu): the current level, if any, is disposed first.
   */
  async start(initial: LevelBuilder, deps: LevelDeps, difficulty: Difficulty = 1): Promise<void> {
    const old = this.current;
    this.current = null;
    old?.dispose();
    this.deps = deps;
    this.setDifficultyValue(difficulty);
    this.currentBuilder = initial;
    const cfg = initial(difficulty);
    const next = await Level.load(cfg, deps);
    next.startAudio();
    next.setDebugReadoutVisible(this.debugReadoutVisible);
    this.current = next;
    this.wireTransition(cfg);
  }

  /** Drive the current level's per-tick logic. No-op if no level is loaded. */
  tick(): void {
    this.current?.tick();
  }

  /**
   * Jump to an arbitrary level by builder. Public so the debug level-
   * picker UI can use it. Same lifecycle as the win-overlay transition:
   * dispose current, load new (with currentDifficulty), start its audio.
   */
  async advanceTo(builder: LevelBuilder): Promise<void> {
    if (!this.deps) return;
    const oldLevel = this.current;
    this.current = null;
    oldLevel?.dispose();

    this.currentBuilder = builder;
    const cfg = builder(this.currentDifficulty);
    const next = await Level.load(cfg, this.deps);
    next.startAudio();
    next.setDebugReadoutVisible(this.debugReadoutVisible);
    this.current = next;
    this.wireTransition(cfg);
  }

  /**
   * Change the current difficulty + reload the current level so its
   * content (e.g., which spikes are placed) reflects the new value.
   * Used by the debug difficulty-picker UI. No-op if the difficulty
   * is unchanged or no level is loaded.
   */
  async setDifficulty(difficulty: Difficulty): Promise<void> {
    if (this.currentDifficulty === difficulty) return;
    this.setDifficultyValue(difficulty);
    if (this.currentBuilder) {
      await this.advanceTo(this.currentBuilder);
    }
  }

  /**
   * Wire `cfg.nextLevel` onto the current Level's completion hook.
   * - Terminal level (no nextLevel): leave `onComplete` null so the Level
   *   falls back to its own "press SPACE to restart" overlay.
   * - Cutscene: advance immediately on completion (no wisp screen).
   * - Regular level: present the "wisp obtained" sequence (if a
   *   `winPresenter` is wired), then advance when it finishes.
   */
  private wireTransition(cfg: {
    nextLevel?: LevelBuilder;
    isCutScene?: boolean;
    gameEnds?: boolean;
  }): void {
    const cur = this.current;
    if (!cur) return;
    // Terminal "game ends" level (mixed3): on completion, play the ending
    // cutscene then return to the main menu. No nextLevel needed — the
    // endingPresenter is responsible for the post-ending transition (the
    // menu re-show is wired in main.ts).
    if (cfg.gameEnds) {
      const presenter = this.endingPresenter ?? this.winPresenter;
      cur.onComplete = (): void => {
        if (presenter) presenter(() => this.quit());
        else this.quit();
      };
      return;
    }
    if (!cfg.nextLevel) {
      cur.onComplete = null;
      return;
    }
    const nextBuilder = cfg.nextLevel;
    const advance = (): void => void this.advanceTo(nextBuilder);
    cur.onComplete = (): void => {
      if (!cfg.isCutScene && this.winPresenter) {
        this.winPresenter(advance);
      } else {
        advance();
      }
    };
  }
}
