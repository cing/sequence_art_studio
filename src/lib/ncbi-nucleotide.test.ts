import { describe, expect, it } from 'vitest';
import { isValidNcbiNucleotideAccession, normalizeNcbiFastaResponse } from './ncbi-nucleotide';

describe('ncbi nucleotide helpers', () => {
  it('validates accession format', () => {
    expect(isValidNcbiNucleotideAccession('NM_000546.6')).toBe(true);
    expect(isValidNcbiNucleotideAccession('NC_000001.11')).toBe(true);
    expect(isValidNcbiNucleotideAccession('bad id')).toBe(false);
  });

  it('normalizes FASTA response', () => {
    const payload = `>NM_000546.6 Homo sapiens tumor protein p53 (TP53), transcript variant 1 [Homo sapiens]\nATGGAGGAGCCGCAGTCAGAT`;
    const record = normalizeNcbiFastaResponse(payload, 'NM_000546.6');

    expect(record.accession).toBe('NM_000546.6');
    expect(record.organism).toBe('Homo sapiens');
    expect(record.sequence).toBe('ATGGAGGAGCCGCAGTCAGAT');
    expect(record.title).toMatch(/tumor protein p53/i);
  });

  it('throws on invalid response payload', () => {
    expect(() => normalizeNcbiFastaResponse('Error: cannot get uid', 'NM_000546.6')).toThrow(/No NCBI nucleotide record/i);
  });
});
