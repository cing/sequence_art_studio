import type { UniProtRecord } from '../types';
import { sanitizeSequence, validateSequenceForType } from './sequence-type';

const UNIPROT_JSON_URL = 'https://rest.uniprot.org/uniprotkb';
const ACCESSION_PATTERN = /^[A-Z0-9]{6,10}$/i;

export function isValidUniProtAccession(input: string): boolean {
  return ACCESSION_PATTERN.test(input.trim());
}

export function normalizeUniProtResponse(payload: unknown): UniProtRecord {
  const source = payload as Record<string, unknown>;
  const accession = String(source.primaryAccession ?? '').trim();

  if (!accession) {
    throw new Error('UniProt response did not include an accession.');
  }

  const proteinDescription = source.proteinDescription as Record<string, unknown> | undefined;
  const recommendedName = proteinDescription?.recommendedName as Record<string, unknown> | undefined;
  const fullName = recommendedName?.fullName as Record<string, unknown> | undefined;

  const genes = Array.isArray(source.genes) ? source.genes as Array<Record<string, unknown>> : [];
  const firstGene = genes[0]?.geneName as Record<string, unknown> | undefined;

  const organism = source.organism as Record<string, unknown> | undefined;
  const sequenceField = source.sequence as Record<string, unknown> | undefined;

  const sequence = sanitizeSequence(String(sequenceField?.value ?? ''));
  const validation = validateSequenceForType(sequence, 'protein');
  if (!sequence || !validation.valid) {
    throw new Error('UniProt response sequence is missing or invalid.');
  }

  return {
    accession,
    proteinName: typeof fullName?.value === 'string' ? fullName.value : undefined,
    geneName: typeof firstGene?.value === 'string' ? firstGene.value : undefined,
    organism: typeof organism?.scientificName === 'string' ? organism.scientificName : undefined,
    sequence,
  };
}

export async function fetchUniProt(accessionInput: string): Promise<UniProtRecord> {
  const accession = accessionInput.trim().toUpperCase();
  if (!isValidUniProtAccession(accession)) {
    throw new Error('Enter a valid UniProt accession (6-10 alphanumeric characters).');
  }

  const response = await fetch(`${UNIPROT_JSON_URL}/${accession}.json`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    throw new Error(`No UniProt record found for ${accession}.`);
  }
  if (!response.ok) {
    throw new Error(`UniProt request failed (${response.status}). Please try again.`);
  }

  const data = await response.json();
  return normalizeUniProtResponse(data);
}
