import type { SequenceType } from '../types';
import { residueHash } from '../lib/utils';

export interface SequencePalette {
  scaleIntervals: number[];
  rootMidi: number;
  drumDensity: number;
  swingAmount: number;
}

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTATONIC = [0, 2, 4, 7, 9];

const CHARGED = new Set(['K', 'R', 'H', 'D', 'E']);
const HYDROPHOBIC = new Set(['A', 'V', 'L', 'I', 'M', 'F', 'W']);
const PRO_GLY = new Set(['P', 'G']);

const ROOT_NOTES = [48, 50, 52, 53, 55, 57, 59]; // C3 through B3

function shannonEntropy(sequence: string): number {
  const counts: Record<string, number> = {};
  for (const ch of sequence) {
    const u = ch.toUpperCase();
    counts[u] = (counts[u] ?? 0) + 1;
  }
  const len = sequence.length;
  if (len === 0) return 0;
  let entropy = 0;
  for (const key in counts) {
    const p = counts[key] / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function deriveProteinPalette(sequence: string): SequencePalette {
  const upper = sequence.toUpperCase();
  let charged = 0;
  let hydrophobic = 0;
  let proGly = 0;

  for (const ch of upper) {
    if (CHARGED.has(ch)) charged++;
    if (HYDROPHOBIC.has(ch)) hydrophobic++;
    if (PRO_GLY.has(ch)) proGly++;
  }

  const len = upper.length || 1;
  const chargedRatio = charged / len;
  const hydrophobicRatio = hydrophobic / len;

  // Scale selection
  let scaleIntervals: number[];
  if (chargedRatio > hydrophobicRatio * 1.3) {
    scaleIntervals = MAJOR_PENTATONIC;
  } else if (hydrophobicRatio > chargedRatio * 1.3) {
    scaleIntervals = MINOR_PENTATONIC;
  } else {
    scaleIntervals = DORIAN;
  }

  // Root from first 10 residues
  const first10 = upper.slice(0, 10);
  const rootIdx = residueHash(0, first10, 'palette') % ROOT_NOTES.length;
  const rootMidi = ROOT_NOTES[rootIdx];

  // Drum density from Shannon entropy (protein max ~4.3 for 20 AAs)
  const entropy = shannonEntropy(upper);
  const drumDensity = Math.min(1, entropy / 4.3);

  // Swing inversely proportional to proline+glycine
  const proGlyRatio = proGly / len;
  const swingAmount = Math.max(0, 0.3 * (1 - proGlyRatio * 5));

  return { scaleIntervals, rootMidi, drumDensity, swingAmount };
}

function deriveDnaPalette(sequence: string): SequencePalette {
  const upper = sequence.toUpperCase();
  let gc = 0;
  let at = 0;

  for (const ch of upper) {
    if (ch === 'G' || ch === 'C') gc++;
    if (ch === 'A' || ch === 'T' || ch === 'U') at++;
  }

  const len = upper.length || 1;
  const gcContent = gc / len;

  // Scale from GC content
  let scaleIntervals: number[];
  if (gcContent < 0.4) {
    scaleIntervals = PENTATONIC;
  } else if (gcContent <= 0.6) {
    scaleIntervals = MAJOR;
  } else {
    scaleIntervals = MINOR;
  }

  // Root from first 10 bases
  const first10 = upper.slice(0, 10);
  const rootIdx = residueHash(0, first10, 'palette') % ROOT_NOTES.length;
  const rootMidi = ROOT_NOTES[rootIdx];

  // Drum density from dinucleotide diversity
  const dinucs = new Set<string>();
  for (let i = 0; i < upper.length - 1; i++) {
    dinucs.add(upper[i] + upper[i + 1]);
  }
  // Max possible dinucleotides for 4 bases = 16
  const drumDensity = Math.min(1, dinucs.size / 16);

  // Swing from AT-richness
  const atRatio = at / len;
  const swingAmount = Math.min(0.3, atRatio * 0.4);

  return { scaleIntervals, rootMidi, drumDensity, swingAmount };
}

export function deriveSequencePalette(sequence: string, seqType: SequenceType): SequencePalette {
  return seqType === 'dna' ? deriveDnaPalette(sequence) : deriveProteinPalette(sequence);
}
