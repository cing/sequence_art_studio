import type { FastaEntry, ParsedFasta, SequenceType } from '../types';
import {
  alphabetDescription,
  detectSequenceType,
  sanitizeSequence,
  validateSequenceForType,
  validateSequenceGeneral,
} from './sequence-type';

const HEADER_PREFIX = '>';

export { sanitizeSequence };

export function validateSequence(
  sequence: string,
  type: SequenceType = 'protein',
): { valid: boolean; invalidChars: string[] } {
  return validateSequenceForType(sequence, type);
}

function detectAndValidate(sequence: string): SequenceType {
  const detectedType = detectSequenceType(sequence);

  if (detectedType === 'unknown') {
    const general = validateSequenceGeneral(sequence);
    if (!general.valid) {
      throw new Error(
        `Invalid sequence characters: ${general.invalidChars.join(', ')}. Allowed symbols are ${alphabetDescription('dna')} or ${alphabetDescription('protein')}.`,
      );
    }
    throw new Error('Unable to detect sequence type from input.');
  }

  const validation = validateSequenceForType(sequence, detectedType);
  if (!validation.valid) {
    throw new Error(
      `Invalid ${detectedType.toUpperCase()} sequence characters: ${validation.invalidChars.join(', ')}. Allowed symbols are ${alphabetDescription(detectedType)}.`,
    );
  }

  return detectedType;
}

function finalizeEntry(entries: FastaEntry[], header: string, lines: string[]): void {
  if (!header && lines.length === 0) {
    return;
  }
  const sequence = sanitizeSequence(lines.join(''));
  if (!sequence) {
    return;
  }

  const sequenceType = detectAndValidate(sequence);

  const headerBody = header.startsWith(HEADER_PREFIX) ? header.slice(1).trim() : header.trim();
  const [id = `Sequence ${entries.length + 1}`, ...rest] = headerBody.split(/\s+/);
  const description = rest.join(' ').trim();

  entries.push({
    id,
    description,
    header: headerBody || `Sequence ${entries.length + 1}`,
    sequence,
    sequenceType,
  });
}

export function parseFasta(input: string): ParsedFasta {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('FASTA input is empty.');
  }

  const lines = trimmed.split(/\r?\n/);
  const entries: FastaEntry[] = [];

  const firstNonEmpty = lines.find((line) => line.trim().length > 0);
  if (!firstNonEmpty) {
    throw new Error('FASTA input contains no sequence data.');
  }

  if (!firstNonEmpty.startsWith(HEADER_PREFIX)) {
    const sequence = sanitizeSequence(lines.join(''));
    const sequenceType = detectAndValidate(sequence);
    return {
      entries: [{
        id: 'Sequence1',
        description: 'Unlabeled sequence',
        header: 'Sequence1',
        sequence,
        sequenceType,
      }],
    };
  }

  let currentHeader = '';
  let sequenceLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    if (trimmedLine.startsWith(HEADER_PREFIX)) {
      finalizeEntry(entries, currentHeader, sequenceLines);
      currentHeader = trimmedLine;
      sequenceLines = [];
    } else {
      sequenceLines.push(trimmedLine);
    }
  }
  finalizeEntry(entries, currentHeader, sequenceLines);

  if (entries.length === 0) {
    throw new Error('No valid FASTA entries were found.');
  }

  return { entries };
}
