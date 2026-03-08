import type { DrumVoice } from './drumPatterns';

export class DrumEngine {
  private ctx: AudioContext;
  private output: GainNode;
  private noiseBuffer: AudioBuffer;

  constructor(ctx: AudioContext, output: GainNode) {
    this.ctx = ctx;
    this.output = output;

    // Create shared white noise buffer (2 seconds)
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  playVoice(voice: DrumVoice, velocity: number, startTime: number): void {
    switch (voice) {
      case 'kick':
        this.playKick(velocity, startTime);
        break;
      case 'snare':
        this.playSnare(velocity, startTime);
        break;
      case 'closedHH':
        this.playHiHat(velocity, startTime, 0.05);
        break;
      case 'openHH':
        this.playHiHat(velocity, startTime, 0.2);
        break;
    }
  }

  private playKick(velocity: number, startTime: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(50, startTime + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.8, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

    osc.connect(gain);
    gain.connect(this.output);
    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }

  private playSnare(velocity: number, startTime: number): void {
    // Sine body
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, startTime);
    osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.05);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(velocity * 0.5, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

    osc.connect(oscGain);
    oscGain.connect(this.output);
    osc.start(startTime);
    osc.stop(startTime + 0.06);

    // Noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 1.0;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.4, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.output);
    noise.start(startTime);
    noise.stop(startTime + 0.16);
  }

  private playHiHat(velocity: number, startTime: number, decay: number): void {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

    noise.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.output);
    noise.start(startTime);
    noise.stop(startTime + decay + 0.01);
  }
}
