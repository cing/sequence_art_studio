import { describe, expect, it } from 'vitest';
import { parseFasta, sanitizeSequence, validateSequence } from './fasta';

describe('fasta parser', () => {
  it('parses multi-entry FASTA and detects sequence types', () => {
    const input = `>alpha DNA\nATGCGTAA\n>beta Protein\nMTEYKLVV`; 
    const parsed = parseFasta(input);

    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].id).toBe('alpha');
    expect(parsed.entries[0].sequence).toBe('ATGCGTAA');
    expect(parsed.entries[0].sequenceType).toBe('dna');

    expect(parsed.entries[1].id).toBe('beta');
    expect(parsed.entries[1].sequence).toBe('MTEYKLVV');
    expect(parsed.entries[1].sequenceType).toBe('protein');
  });

  it('accepts raw sequence input without header and detects DNA-first for ACGT-only', () => {
    const parsed = parseFasta('acgt\nacgt');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].sequence).toBe('ACGTACGT');
    expect(parsed.entries[0].sequenceType).toBe('dna');
  });

  it('rejects invalid residues', () => {
    expect(() => parseFasta('>bad\nACDE*')).toThrow(/Invalid/);
  });

  it('sanitizes whitespace and validates residues by requested type', () => {
    expect(sanitizeSequence('a c g t\n n')).toBe('ACGTN');
    expect(validateSequence('ACGTN', 'dna').valid).toBe(true);
    expect(validateSequence('ACGT*', 'dna').valid).toBe(false);
    expect(validateSequence('MTEYK', 'protein').valid).toBe(true);
  });
});
