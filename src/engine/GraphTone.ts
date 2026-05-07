export interface GraphToneOptions {
  baseHz?: number;
  octaves?: number;
  attackMs?: number;
  releaseMs?: number;
  glideMs?: number;
  peakGain?: number;
  type?: OscillatorType;
}

const DEFAULTS: Required<GraphToneOptions> = {
  baseHz: 220,
  octaves: 2,
  attackMs: 50,
  releaseMs: 100,
  glideMs: 25,
  peakGain: 0.1,
  type: 'sine',
};

export class GraphTone {
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private playing = false;
  private readonly opts: Required<GraphToneOptions>;

  constructor(
    private readonly ctx: AudioContext,
    opts: GraphToneOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  start(): void {
    if (this.playing) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.opts.peakGain, now + this.opts.attackMs / 1000);
    gain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = this.opts.type;
    osc.frequency.setValueAtTime(this.opts.baseHz, now);
    osc.connect(gain);
    osc.start(now);

    this.oscillator = osc;
    this.gain = gain;
    this.playing = true;
  }

  setNormalized(t: number): void {
    if (!this.oscillator) return;
    const clamped = Math.max(0, Math.min(1, t));
    const freq = this.opts.baseHz * Math.pow(2, clamped * this.opts.octaves);
    const target = this.ctx.currentTime + this.opts.glideMs / 1000;
    this.oscillator.frequency.linearRampToValueAtTime(freq, target);
  }

  setFromCurveY(yValue: number, yMin: number, yMax: number): void {
    if (yMax === yMin) return;
    const t = 1 - (yValue - yMin) / (yMax - yMin);
    this.setNormalized(t);
  }

  stop(): void {
    if (!this.playing || !this.oscillator || !this.gain) return;
    const now = this.ctx.currentTime;
    const releaseEnd = now + this.opts.releaseMs / 1000;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, releaseEnd);
    this.oscillator.stop(releaseEnd + 0.02);
    this.oscillator = null;
    this.gain = null;
    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}
