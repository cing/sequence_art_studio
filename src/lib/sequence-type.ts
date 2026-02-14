import type { SequenceType } from '../types';

export const DNA_IUPAC_SYMBOLS = [
  'A', 'C', 'G', 'T', 'N', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V',
] as const;

export const PROTEIN_CANONICAL_SYMBOLS = [
  'A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L',
  'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y',
] as const;

export const PROTEIN_EXTENDED_SYMBOLS = [
  ...PROTEIN_CANONICAL_SYMBOLS,
  'X', 'B', 'Z', 'J', 'U', 'O',
] as const;

const DNA_IUPAC_SET = new Set<string>(DNA_IUPAC_SYMBOLS);
const PROTEIN_SET = new Set<string>(PROTEIN_EXTENDED_SYMBOLS);
const UNION_SET = new Set<string>([...DNA_IUPAC_SET, ...PROTEIN_SET]);

export function sanitizeSequence(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

export function detectSequenceType(sequence: string): SequenceType | 'unknown' {
  if (!sequence) {
    return 'unknown';
  }

  let dnaValid = true;
  let proteinValid = true;

  for (const symbol of sequence) {
    if (!DNA_IUPAC_SET.has(symbol)) {
      dnaValid = false;
    }
    if (!PROTEIN_SET.has(symbol)) {
      proteinValid = false;
    }

    if (!dnaValid && !proteinValid) {
      return 'unknown';
    }
  }

  if (dnaValid && proteinValid) {
    // Explicit product rule: DNA-first when symbols could represent either.
    return 'dna';
  }

  if (dnaValid) {
    return 'dna';
  }
  if (proteinValid) {
    return 'protein';
  }

  return 'unknown';
}

export function getAllowedSymbols(type: SequenceType): Set<string> {
  return type === 'dna' ? DNA_IUPAC_SET : PROTEIN_SET;
}

export function validateSequenceForType(sequence: string, type: SequenceType): { valid: boolean; invalidChars: string[] } {
  const allowed = getAllowedSymbols(type);
  const invalidSet = new Set<string>();
  for (const symbol of sequence) {
    if (!allowed.has(symbol)) {
      invalidSet.add(symbol);
    }
  }
  return { valid: invalidSet.size === 0, invalidChars: [...invalidSet].sort() };
}

export function validateSequenceGeneral(sequence: string): { valid: boolean; invalidChars: string[] } {
  const invalidSet = new Set<string>();
  for (const symbol of sequence) {
    if (!UNION_SET.has(symbol)) {
      invalidSet.add(symbol);
    }
  }
  return { valid: invalidSet.size === 0, invalidChars: [...invalidSet].sort() };
}

export function alphabetDescription(type: SequenceType): string {
  if (type === 'dna') {
    return 'IUPAC DNA symbols (A,C,G,T,N,R,Y,S,W,K,M,B,D,H,V)';
  }
  return 'protein one-letter symbols (20 canonical + X/B/Z/J/U/O)';
}
