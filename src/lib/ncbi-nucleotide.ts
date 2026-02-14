import type { NcbiNucleotideRecord } from '../types';
import { sanitizeSequence, validateSequenceForType } from './sequence-type';

const NCBI_EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const ACCESSION_PATTERN = /^[A-Z]{1,4}_?[0-9]+(?:\.[0-9]+)?$/i;

export function isValidNcbiNucleotideAccession(input: string): boolean {
  return ACCESSION_PATTERN.test(input.trim());
}

export function normalizeNcbiFastaResponse(payload: string, requestedAccession?: string): NcbiNucleotideRecord {
  const trimmed = payload.trim();
  if (!trimmed.startsWith('>')) {
    if (/cannot\s+get\s+uid|error|failed/i.test(trimmed)) {
      throw new Error(`No NCBI nucleotide record found for ${requestedAccession ?? 'this accession'}.`);
    }
    throw new Error('NCBI returned an unexpected response format.');
  }

  const lines = trimmed.split(/\r?\n/);
  const header = lines[0].slice(1).trim();
  const sequence = sanitizeSequence(lines.slice(1).join(''));

  const validation = validateSequenceForType(sequence, 'dna');
  if (!sequence || !validation.valid) {
    throw new Error('NCBI response sequence is missing or invalid DNA.');
  }

  const [accession = requestedAccession ?? 'Unknown', ...rest] = header.split(/\s+/);
  let title = rest.join(' ').trim();
  let organism: string | undefined;

  const organismMatch = title.match(/\[([^\]]+)\]\s*$/);
  if (organismMatch) {
    organism = organismMatch[1].trim();
    title = title.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  }

  return {
    accession,
    title: title || accession,
    organism,
    sequence,
  };
}

export async function fetchNcbiNucleotide(accessionInput: string): Promise<NcbiNucleotideRecord> {
  const accession = accessionInput.trim().toUpperCase();
  if (!isValidNcbiNucleotideAccession(accession)) {
    throw new Error('Enter a valid NCBI nucleotide accession (e.g., NM_000546.6, NC_000001.11).');
  }

  const url = new URL(NCBI_EFETCH_URL);
  url.searchParams.set('db', 'nuccore');
  url.searchParams.set('id', accession);
  url.searchParams.set('rettype', 'fasta');
  url.searchParams.set('retmode', 'text');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'text/plain',
    },
  });

  if (!response.ok) {
    throw new Error(`NCBI request failed (${response.status}). Please try again.`);
  }

  const text = await response.text();
  return normalizeNcbiFastaResponse(text, accession);
}
