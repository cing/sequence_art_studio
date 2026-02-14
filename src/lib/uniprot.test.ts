import { describe, expect, it } from 'vitest';
import { isValidUniProtAccession, normalizeUniProtResponse } from './uniprot';

describe('uniprot helpers', () => {
  it('validates accession format', () => {
    expect(isValidUniProtAccession('P69905')).toBe(true);
    expect(isValidUniProtAccession('Q8N158')).toBe(true);
    expect(isValidUniProtAccession('bad id')).toBe(false);
  });

  it('normalizes known UniProt payload fields', () => {
    const payload = {
      primaryAccession: 'P69905',
      proteinDescription: {
        recommendedName: {
          fullName: {
            value: 'Hemoglobin subunit alpha',
          },
        },
      },
      genes: [{ geneName: { value: 'HBA1' } }],
      organism: { scientificName: 'Homo sapiens' },
      sequence: { value: 'VLSPADKTN' },
    };

    const record = normalizeUniProtResponse(payload);
    expect(record.accession).toBe('P69905');
    expect(record.proteinName).toBe('Hemoglobin subunit alpha');
    expect(record.geneName).toBe('HBA1');
    expect(record.organism).toBe('Homo sapiens');
    expect(record.sequence).toBe('VLSPADKTN');
  });

  it('throws on missing sequence', () => {
    expect(() => normalizeUniProtResponse({ primaryAccession: 'P00001' })).toThrow(/sequence/i);
  });
});
