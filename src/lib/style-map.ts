import type { ArtSettings, ResidueStyle, SequenceType } from '../types';
import { getDnaResidueStyle } from './dna-map';
import { getProteinResidueStyle } from './aa-map';

export function getStyleForSequenceSymbol(
  symbol: string,
  sequenceType: SequenceType,
  settings: ArtSettings,
): ResidueStyle {
  if (sequenceType === 'dna') {
    return getDnaResidueStyle(symbol, settings.dnaResidueStyles);
  }
  return getProteinResidueStyle(symbol, settings.proteinResidueStyles);
}
