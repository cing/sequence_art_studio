import type { ResidueStyle, ResidueStyleMap, ShapeKind } from '../types';
import { DNA_IUPAC_SYMBOLS } from './sequence-type';
import { GLYPH_SHAPES } from './aa-map';

export const DNA_SYMBOLS = [...DNA_IUPAC_SYMBOLS] as const;

export interface DnaStyleSchemePreset {
  id: string;
  label: string;
  description: string;
}

export const DNA_STYLE_SCHEMES: DnaStyleSchemePreset[] = [
  {
    id: 'dna_classic_4',
    label: 'DNA: Classic 4-base',
    description: 'Distinct A/C/G/T colors with neutral ambiguity symbols.',
  },
  {
    id: 'dna_reduced_2',
    label: 'DNA: Reduced 2-group',
    description: 'Purines vs pyrimidines with neutral ambiguity symbols.',
  },
  {
    id: 'dna_iupac_distinct',
    label: 'DNA: IUPAC distinct',
    description: 'Broader color separation across ambiguity codes.',
  },
];

export function normalizeDnaSymbol(raw: string): string {
  const symbol = raw.toUpperCase();
  if (DNA_SYMBOLS.includes(symbol as (typeof DNA_SYMBOLS)[number])) {
    return symbol;
  }
  return 'N';
}

function fromAssignments(assignments: Record<string, { color: string; shape: ShapeKind }>): ResidueStyleMap {
  const map: ResidueStyleMap = {};
  for (const symbol of DNA_SYMBOLS) {
    const assignment = assignments[symbol] ?? assignments.N;
    map[symbol] = {
      color: assignment?.color ?? '#8d99ae',
      shape: assignment?.shape ?? 'circle',
      glyph: symbol,
    };
  }
  return map;
}

function classicMap(): ResidueStyleMap {
  return fromAssignments({
    A: { color: '#2a9d8f', shape: 'circle' },
    C: { color: '#3a86ff', shape: 'square' },
    G: { color: '#ffbe0b', shape: 'diamond' },
    T: { color: '#ef476f', shape: 'triangle' },
    R: { color: '#5fa8d3', shape: 'hex' },
    Y: { color: '#f28482', shape: 'hex' },
    S: { color: '#7bd389', shape: 'ring' },
    W: { color: '#ffd166', shape: 'ring' },
    K: { color: '#f6aa1c', shape: 'hex' },
    M: { color: '#4ea8de', shape: 'hex' },
    B: { color: '#9c89b8', shape: 'triangle' },
    D: { color: '#a3b18a', shape: 'diamond' },
    H: { color: '#f4a261', shape: 'square' },
    V: { color: '#43aa8b', shape: 'circle' },
    N: { color: '#8d99ae', shape: 'ring' },
  });
}

function reducedTwoMap(): ResidueStyleMap {
  return fromAssignments({
    A: { color: '#2a9d8f', shape: 'circle' },
    G: { color: '#2a9d8f', shape: 'diamond' },
    R: { color: '#2a9d8f', shape: 'hex' },
    C: { color: '#ef476f', shape: 'square' },
    T: { color: '#ef476f', shape: 'triangle' },
    Y: { color: '#ef476f', shape: 'hex' },
    W: { color: '#f6bd60', shape: 'ring' },
    S: { color: '#5fa8d3', shape: 'ring' },
    K: { color: '#f6bd60', shape: 'hex' },
    M: { color: '#5fa8d3', shape: 'hex' },
    B: { color: '#8d99ae', shape: 'triangle' },
    D: { color: '#8d99ae', shape: 'diamond' },
    H: { color: '#8d99ae', shape: 'square' },
    V: { color: '#8d99ae', shape: 'circle' },
    N: { color: '#8d99ae', shape: 'ring' },
  });
}

function iupacDistinctMap(): ResidueStyleMap {
  const assignments: Record<string, { color: string; shape: ShapeKind }> = {
    A: { color: '#1b998b', shape: 'circle' },
    C: { color: '#3a86ff', shape: 'square' },
    G: { color: '#ffbe0b', shape: 'diamond' },
    T: { color: '#ef476f', shape: 'triangle' },
    N: { color: '#8d99ae', shape: 'ring' },
    R: { color: '#06d6a0', shape: 'hex' },
    Y: { color: '#f28482', shape: 'hex' },
    S: { color: '#118ab2', shape: 'ring' },
    W: { color: '#ffd166', shape: 'ring' },
    K: { color: '#fb8500', shape: 'triangle' },
    M: { color: '#4cc9f0', shape: 'diamond' },
    B: { color: '#9b5de5', shape: 'square' },
    D: { color: '#90be6d', shape: 'circle' },
    H: { color: '#f4a261', shape: 'hex' },
    V: { color: '#43aa8b', shape: 'triangle' },
  };

  DNA_SYMBOLS.forEach((symbol, index) => {
    if (!assignments[symbol]) {
      assignments[symbol] = {
        color: '#8d99ae',
        shape: GLYPH_SHAPES[index % GLYPH_SHAPES.length],
      };
    }
  });

  return fromAssignments(assignments);
}

export function buildDnaStyleMapFromScheme(schemeId: string): ResidueStyleMap {
  if (schemeId === 'dna_reduced_2') {
    return reducedTwoMap();
  }
  if (schemeId === 'dna_iupac_distinct') {
    return iupacDistinctMap();
  }
  return classicMap();
}

export function getDnaResidueStyle(symbol: string, styleMap: ResidueStyleMap): ResidueStyle {
  const key = normalizeDnaSymbol(symbol);
  return styleMap[key] ?? styleMap.N ?? { color: '#8d99ae', shape: 'ring', glyph: 'N' };
}
