export interface FixedStepOptions {
  hz: number;
  maxStepsPerFrame?: number;
}

export interface FixedStepAdvance {
  steps: number;
  alpha: number;
}

export class FixedStep {
  readonly stepMs: number;
  private readonly maxSteps: number;
  private accumulator = 0;

  constructor(opts: FixedStepOptions) {
    if (opts.hz <= 0) throw new Error('FixedStep hz must be > 0');
    this.stepMs = 1000 / opts.hz;
    this.maxSteps = opts.maxStepsPerFrame ?? 5;
  }

  advance(elapsedMs: number): FixedStepAdvance {
    if (elapsedMs > 0) this.accumulator += elapsedMs;
    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < this.maxSteps) {
      this.accumulator -= this.stepMs;
      steps++;
    }
    if (this.accumulator >= this.stepMs) {
      this.accumulator = this.stepMs - 1;
    }
    const alpha = this.accumulator / this.stepMs;
    return { steps, alpha };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
