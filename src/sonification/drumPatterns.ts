import type { SequenceType } from '../types';
import type { SequencePalette } from './sequencePalette';

export type DrumVoice = 'kick' | 'snare' | 'closedHH' | 'openHH';

export interface DrumStep {
  voice: DrumVoice;
  velocity: number;
}

export interface DrumPattern {
  steps: (DrumStep[] | null)[];
}

export function euclideanRhythm(hits: number, steps: number): boolean[] {
  if (hits <= 0) return new Array(steps).fill(false);
  if (hits >= steps) return new Array(steps).fill(true);

  // Bresenham-based Euclidean rhythm distribution
  const result: boolean[] = new Array(steps).fill(false);
  for (let i = 0; i < hits; i++) {
    const pos = Math.floor((i * steps) / hits);
    result[pos] = true;
  }
  return result;
}

const HYDROPHOBIC_SET = new Set(['A', 'V', 'L', 'I', 'M', 'F', 'W']);
const POLAR_UNCHARGED = new Set(['S', 'T', 'N', 'Q', 'Y', 'C']);
const POSITIVE_CHARGE = new Set(['K', 'R', 'H']);
const NEGATIVE_CHARGE = new Set(['D', 'E']);
const STRUCTURAL = new Set(['G', 'P']);

function getProteinVoice(residue: string): DrumVoice {
  const r = residue.toUpperCase();
  if (HYDROPHOBIC_SET.has(r)) return 'kick';
  if (POLAR_UNCHARGED.has(r)) return 'closedHH';
  if (POSITIVE_CHARGE.has(r)) return 'openHH';
  if (NEGATIVE_CHARGE.has(r)) return 'snare';
  if (STRUCTURAL.has(r)) return 'snare';
  return 'closedHH'; // fallback
}

function getDnaVoice(residue: string): DrumVoice {
  const r = residue.toUpperCase();
  if (r === 'A' || r === 'G') return 'kick';
  if (r === 'C') return 'snare';
  if (r === 'T' || r === 'U') return 'closedHH';
  return 'closedHH'; // ambiguity codes
}

const VOICE_ROTATIONS: Record<DrumVoice, number> = {
  kick: 0,
  snare: 4,
  closedHH: 2,
  openHH: 6,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function buildDrumPattern(
  sequence: string,
  seqType: SequenceType,
  palette: SequencePalette,
): DrumPattern {
  const upper = sequence.toUpperCase();
  const voiceCounts: Record<DrumVoice, number> = { kick: 0, snare: 0, closedHH: 0, openHH: 0 };
  const getVoice = seqType === 'dna' ? getDnaVoice : getProteinVoice;

  for (const ch of upper) {
    voiceCounts[getVoice(ch)]++;
  }

  const total = upper.length || 1;
  const steps: (DrumStep[] | null)[] = new Array(16).fill(null);

  const voices: DrumVoice[] = ['kick', 'snare', 'closedHH', 'openHH'];

  for (const voice of voices) {
    const fraction = voiceCounts[voice] / total;
    const hits = clamp(Math.round(fraction * 16 * palette.drumDensity), 0, 8);
    if (hits === 0) continue;

    const rhythm = euclideanRhythm(hits, 16);
    const rotation = VOICE_ROTATIONS[voice];
    const velocity = 0.4 + fraction * 0.5;

    for (let i = 0; i < 16; i++) {
      if (!rhythm[i]) continue;
      const pos = (i + rotation) % 16;
      if (!steps[pos]) {
        steps[pos] = [];
      }
      steps[pos]!.push({ voice, velocity });
    }
  }

  return { steps };
}
