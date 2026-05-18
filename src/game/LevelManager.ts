// Owns the currently active Level and handles transitions between them.
// `start()` loads the initial level; when the player presses SPACE on a
// level's win overlay, LevelManager disposes the current Level and loads
// the one referenced by `cfg.nextLevel`. If there's no next level the
// SPACE press falls through to the Level's own reset() (terminal level
// → restart-on-space, matching the pre-transition behavior).
//
// Per CLAUDE.md §14 item 14, this is the dispatch layer between
// individual Level instances. It deliberately stays small: no
// progression state, no save/restore, no debug menu — those land in
// Phase 5 alongside the UI port.

import { Level, type LevelConfig, type LevelDeps } from './Level.js';

export class LevelManager {
  private current: Level | null = null;
  private deps: LevelDeps | null = null;

  /** True if there's an active level being driven by tick(). */
  get hasLevel(): boolean {
    return this.current !== null;
  }

  /** Load the initial level + start audio on first user gesture (handled by Level itself). */
  async start(initial: LevelConfig, deps: LevelDeps): Promise<void> {
    this.deps = deps;
    this.current = await Level.load(initial, deps);
    this.wireTransition(initial);
  }

  /** Drive the current level's per-tick logic. No-op if no level is loaded. */
  tick(): void {
    this.current?.tick();
  }

  /** Wire `cfg.nextLevel` onto the current Level's win-space hook. */
  private wireTransition(cfg: LevelConfig): void {
    const cur = this.current;
    if (!cur) return;
    if (!cfg.nextLevel) {
      cur.onWinSpacePressed = null; // explicit reset to fall back to cur.reset()
      return;
    }
    const nextCfg = cfg.nextLevel;
    cur.onWinSpacePressed = (): void => {
      // Fire-and-forget the async transition. Any failure is logged but
      // doesn't crash the sim — the user can still press SPACE again.
      void this.advanceTo(nextCfg);
    };
  }

  private async advanceTo(nextCfg: LevelConfig): Promise<void> {
    if (!this.deps) return;
    const oldLevel = this.current;
    this.current = null; // prevent tick() from driving the disposing level
    oldLevel?.dispose();

    const next = await Level.load(nextCfg, this.deps);
    // SPACE itself is a user gesture → safe to start audio immediately
    // on the new level, no need to wait for another keypress.
    next.startAudio();
    this.current = next;
    this.wireTransition(nextCfg);
  }
}
