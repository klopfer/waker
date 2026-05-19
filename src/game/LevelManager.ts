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

  /** True if there's an active level being driven by tick(). */
  get hasLevel(): boolean {
    return this.current !== null;
  }

  get difficulty(): Difficulty {
    return this.currentDifficulty;
  }

  /** Load the initial level. Difficulty defaults to 1 (easy). */
  async start(initial: LevelBuilder, deps: LevelDeps, difficulty: Difficulty = 1): Promise<void> {
    this.deps = deps;
    this.currentDifficulty = difficulty;
    this.currentBuilder = initial;
    const cfg = initial(difficulty);
    this.current = await Level.load(cfg, deps);
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
    this.currentDifficulty = difficulty;
    if (this.currentBuilder) {
      await this.advanceTo(this.currentBuilder);
    }
  }

  /** Wire `cfg.nextLevel` onto the current Level's win-space hook. */
  private wireTransition(cfg: { nextLevel?: LevelBuilder }): void {
    const cur = this.current;
    if (!cur) return;
    if (!cfg.nextLevel) {
      cur.onWinSpacePressed = null;
      return;
    }
    const nextBuilder = cfg.nextLevel;
    cur.onWinSpacePressed = (): void => {
      void this.advanceTo(nextBuilder);
    };
  }
}
