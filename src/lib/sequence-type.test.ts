import { describe, expect, it } from 'vitest';
import { detectSequenceType, sanitizeSequence, validateSequenceForType } from './sequence-type';

describe('sequence type detection', () => {
  it('detects DNA for ACGT-only sequences', () => {
    expect(detectSequenceType('ACGTACGT')).toBe('dna');
  });

  it('detects DNA for IUPAC ambiguity symbols', () => {
    expect(detectSequenceType('ACGTRYSWKMBDHVN')).toBe('dna');
  });

  it('detects protein for non-DNA amino acid letters', () => {
    expect(detectSequenceType('MTEYKLVVVGAGGVGKSAL')).toBe('protein');
  });

  it('returns unknown for invalid symbols', () => {
    expect(detectSequenceType('ACGT*NNN')).toBe('unknown');
  });

  it('sanitizes and validates by type', () => {
    expect(sanitizeSequence('acgt\n nn')).toBe('ACGTNN');
    expect(validateSequenceForType('ACGTNN', 'dna').valid).toBe(true);
    expect(validateSequenceForType('ACGT*', 'dna').valid).toBe(false);
    expect(validateSequenceForType('MTEYK', 'protein').valid).toBe(true);
  });
});
