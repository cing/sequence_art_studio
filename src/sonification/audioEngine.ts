export class SequenceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  playNote(freq: number, velocity: number, duration: number, startTime: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Sine oscillator (fundamental)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    // Triangle oscillator (warmth, subtle blend)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq;

    const blend = this.ctx.createGain();
    blend.gain.value = 0.15; // subtle triangle mix

    const noteGain = this.ctx.createGain();
    const g = noteGain.gain;
    const peak = velocity * 0.55;

    // ADSR envelope with extended release for polyphonic overlap
    const attack = 0.01;
    const decay = 0.04;
    const sustainLevel = peak * 0.6;
    const sustainEnd = duration * 0.5;    // sustain holds for first half
    const releaseEnd = duration;          // fade out over second half

    g.setValueAtTime(0, startTime);
    g.linearRampToValueAtTime(peak, startTime + attack);
    g.linearRampToValueAtTime(sustainLevel, startTime + attack + decay);
    g.setValueAtTime(sustainLevel, startTime + sustainEnd);
    g.exponentialRampToValueAtTime(0.001, startTime + releaseEnd);

    osc1.connect(noteGain);
    osc2.connect(blend);
    blend.connect(noteGain);
    noteGain.connect(this.masterGain);

    const stopTime = startTime + duration + 0.02;
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  stop(): void {
    if (!this.ctx || !this.masterGain) return;
    // Ramp master gain to 0 quickly to avoid clicks
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
  }

  resume(): void {
    if (!this.ctx || !this.masterGain) return;
    // Restore master gain for new playback
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.02);
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
