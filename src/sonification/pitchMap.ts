import type { SequenceType } from '../types';

// MIDI note -> Hz
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// DNA: purine/pyrimidine split
const DNA_MIDI: Record<string, number> = {
  A: 60, // C4 - purine
  G: 64, // E4 - purine
  T: 67, // G4 - pyrimidine
  U: 67, // G4 - pyrimidine (RNA)
  C: 71, // B4 - pyrimidine
};
const DNA_AMBIGUITY_MIDI = 62; // D4

// Protein: physicochemical grouping -> pitch ranges
const PROTEIN_MIDI: Record<string, number> = {
  // Hydrophobic (low register, 48-52)
  A: 48, V: 49, L: 50, I: 51, M: 52, F: 48, W: 49,
  // Polar uncharged (mid, 53-57)
  S: 53, T: 54, N: 55, Q: 56, Y: 57, C: 53,
  // Positive charge (high, 60-64)
  K: 60, R: 62, H: 64,
  // Negative charge (mid-high, 65-67)
  D: 65, E: 67,
  // Structural (accent, 59)
  G: 59, P: 59,
};

const STRUCTURAL_RESIDUES = new Set(['G', 'P']);

// Hydrophobicity scale (Kyte-Doolittle, normalized 0-1 for velocity)
const HYDROPHOBICITY: Record<string, number> = {
  I: 1.0, V: 0.93, L: 0.84, F: 0.64, C: 0.56, M: 0.43, A: 0.40,
  G: 0.18, T: 0.16, S: 0.13, W: 0.12, Y: 0.07, P: 0.05, H: 0.0,
  D: 0.0, E: 0.0, N: 0.0, Q: 0.0, K: 0.0, R: 0.0,
};

export function getFrequency(residue: string, seqType: SequenceType): number {
  const r = residue.toUpperCase();
  if (seqType === 'dna') {
    return midiToHz(DNA_MIDI[r] ?? DNA_AMBIGUITY_MIDI);
  }
  return midiToHz(PROTEIN_MIDI[r] ?? 55); // fallback G3
}

export function getVelocity(
  residue: string,
  seqType: SequenceType,
  sequence: string,
  position: number,
): number {
  if (seqType === 'dna') {
    // GC content in +-5 window scales gain
    const start = Math.max(0, position - 5);
    const end = Math.min(sequence.length, position + 6);
    let gc = 0;
    let total = 0;
    for (let i = start; i < end; i++) {
      const ch = sequence[i].toUpperCase();
      if (ch === 'G' || ch === 'C') gc++;
      total++;
    }
    const ratio = total > 0 ? gc / total : 0.5;
    return 0.5 + ratio * 0.4;
  }
  // Protein: hydrophobicity scales gain
  const h = HYDROPHOBICITY[residue.toUpperCase()] ?? 0.2;
  return 0.45 + h * 0.45;
}

export function getNoteDuration(residue: string, seqType: SequenceType): number {
  if (seqType === 'protein' && STRUCTURAL_RESIDUES.has(residue.toUpperCase())) {
    return 0.10; // staccato for G, P
  }
  return 0.22; // standard — slight overlap at 8 notes/sec
}
