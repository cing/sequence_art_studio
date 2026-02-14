import type { ResidueStyle, ResidueStyleMap, ShapeKind } from '../types';
import { PROTEIN_CANONICAL_SYMBOLS } from './sequence-type';

export const AMINO_ACIDS_20 = [...PROTEIN_CANONICAL_SYMBOLS] as const;

export const PROTEIN_STYLEABLE_SYMBOLS = [...AMINO_ACIDS_20, 'X', 'U', 'O'] as const;

export const GLYPH_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'hex', 'ring'];

export interface StyleSchemePreset {
  id: string;
  label: string;
  description: string;
}

export const PROTEIN_STYLE_SCHEMES: StyleSchemePreset[] = [
  {
    id: 'protein_physicochemical_7',
    label: 'Protein: Physicochemical (7 groups)',
    description: 'Classic chemistry grouping of all 20 amino acids.',
  },
  {
    id: 'protein_reduced_5',
    label: 'Protein: Reduced 5-color',
    description: 'Simplified grouping for cleaner poster-style palettes.',
  },
  {
    id: 'protein_reduced_3',
    label: 'Protein: Reduced 3-color',
    description: 'Minimal palette for bold high-contrast prints.',
  },
  {
    id: 'protein_unique_20',
    label: 'Protein: Unique 20-color',
    description: 'Distinct color for each canonical amino acid.',
  },
];

export function normalizeProteinResidue(raw: string): string {
  const residue = raw.toUpperCase();
  if (residue === 'B' || residue === 'Z' || residue === 'J') {
    return 'X';
  }
  if (PROTEIN_STYLEABLE_SYMBOLS.includes(residue as (typeof PROTEIN_STYLEABLE_SYMBOLS)[number])) {
    return residue;
  }
  return 'X';
}

function fromAssignments(assignments: Record<string, { color: string; shape: ShapeKind }>): ResidueStyleMap {
  const map: ResidueStyleMap = {};

  for (const residue of PROTEIN_STYLEABLE_SYMBOLS) {
    const assignment = assignments[residue] ?? assignments.X;
    map[residue] = {
      color: assignment?.color ?? '#7d8597',
      shape: assignment?.shape ?? 'circle',
      glyph: residue,
    };
  }

  return map;
}

function physicochemicalMap(): ResidueStyleMap {
  return fromAssignments({
    A: { color: '#f4a261', shape: 'circle' },
    V: { color: '#f4a261', shape: 'circle' },
    L: { color: '#f4a261', shape: 'circle' },
    I: { color: '#f4a261', shape: 'circle' },
    M: { color: '#f4a261', shape: 'circle' },
    F: { color: '#e76f51', shape: 'diamond' },
    W: { color: '#e76f51', shape: 'diamond' },
    Y: { color: '#e76f51', shape: 'diamond' },
    S: { color: '#2a9d8f', shape: 'square' },
    T: { color: '#2a9d8f', shape: 'square' },
    N: { color: '#2a9d8f', shape: 'square' },
    Q: { color: '#2a9d8f', shape: 'square' },
    K: { color: '#3a86ff', shape: 'triangle' },
    R: { color: '#3a86ff', shape: 'triangle' },
    H: { color: '#3a86ff', shape: 'triangle' },
    D: { color: '#8338ec', shape: 'hex' },
    E: { color: '#8338ec', shape: 'hex' },
    C: { color: '#00b4d8', shape: 'ring' },
    G: { color: '#ffb703', shape: 'hex' },
    P: { color: '#ffb703', shape: 'ring' },
    U: { color: '#00b4d8', shape: 'ring' },
    O: { color: '#3a86ff', shape: 'triangle' },
    X: { color: '#7d8597', shape: 'circle' },
  });
}

function reducedFiveMap(): ResidueStyleMap {
  return fromAssignments({
    A: { color: '#264653', shape: 'circle' },
    V: { color: '#264653', shape: 'circle' },
    L: { color: '#264653', shape: 'circle' },
    I: { color: '#264653', shape: 'circle' },
    M: { color: '#264653', shape: 'circle' },
    F: { color: '#4d908e', shape: 'diamond' },
    W: { color: '#4d908e', shape: 'diamond' },
    Y: { color: '#4d908e', shape: 'diamond' },
    C: { color: '#4d908e', shape: 'diamond' },
    N: { color: '#43aa8b', shape: 'square' },
    Q: { color: '#43aa8b', shape: 'square' },
    S: { color: '#43aa8b', shape: 'square' },
    T: { color: '#43aa8b', shape: 'square' },
    D: { color: '#f94144', shape: 'triangle' },
    E: { color: '#f94144', shape: 'triangle' },
    K: { color: '#f94144', shape: 'triangle' },
    R: { color: '#f94144', shape: 'triangle' },
    H: { color: '#f94144', shape: 'triangle' },
    G: { color: '#f9c74f', shape: 'hex' },
    P: { color: '#f9c74f', shape: 'ring' },
    U: { color: '#4d908e', shape: 'diamond' },
    O: { color: '#f94144', shape: 'triangle' },
    X: { color: '#8d99ae', shape: 'circle' },
  });
}

function reducedThreeMap(): ResidueStyleMap {
  return fromAssignments({
    A: { color: '#264653', shape: 'circle' },
    V: { color: '#264653', shape: 'circle' },
    L: { color: '#264653', shape: 'circle' },
    I: { color: '#264653', shape: 'circle' },
    M: { color: '#264653', shape: 'circle' },
    F: { color: '#264653', shape: 'diamond' },
    W: { color: '#264653', shape: 'diamond' },
    Y: { color: '#264653', shape: 'diamond' },
    C: { color: '#264653', shape: 'diamond' },
    G: { color: '#264653', shape: 'hex' },
    P: { color: '#264653', shape: 'ring' },
    N: { color: '#2a9d8f', shape: 'square' },
    Q: { color: '#2a9d8f', shape: 'square' },
    S: { color: '#2a9d8f', shape: 'square' },
    T: { color: '#2a9d8f', shape: 'square' },
    D: { color: '#e63946', shape: 'triangle' },
    E: { color: '#e63946', shape: 'triangle' },
    K: { color: '#e63946', shape: 'triangle' },
    R: { color: '#e63946', shape: 'triangle' },
    H: { color: '#e63946', shape: 'triangle' },
    U: { color: '#264653', shape: 'diamond' },
    O: { color: '#e63946', shape: 'triangle' },
    X: { color: '#8d99ae', shape: 'circle' },
  });
}

function uniqueTwentyMap(): ResidueStyleMap {
  const colors = [
    '#1b998b', '#ef476f', '#ffd166', '#06d6a0', '#073b4c',
    '#118ab2', '#ff6f59', '#8338ec', '#ffbe0b', '#3a86ff',
    '#2a9d8f', '#e76f51', '#264653', '#f4a261', '#43aa8b',
    '#f94144', '#577590', '#90be6d', '#4d908e', '#f3722c',
  ];

  const assignments: Record<string, { color: string; shape: ShapeKind }> = {
    X: { color: '#7d8597', shape: 'circle' },
    U: { color: '#4d908e', shape: 'ring' },
    O: { color: '#ffbe0b', shape: 'hex' },
  };

  AMINO_ACIDS_20.forEach((residue, index) => {
    assignments[residue] = {
      color: colors[index % colors.length],
      shape: GLYPH_SHAPES[index % GLYPH_SHAPES.length],
    };
  });

  return fromAssignments(assignments);
}

export function buildProteinStyleMapFromScheme(schemeId: string): ResidueStyleMap {
  if (schemeId === 'protein_reduced_5') {
    return reducedFiveMap();
  }
  if (schemeId === 'protein_reduced_3') {
    return reducedThreeMap();
  }
  if (schemeId === 'protein_unique_20') {
    return uniqueTwentyMap();
  }
  return physicochemicalMap();
}

export function getProteinResidueStyle(residue: string, styleMap: ResidueStyleMap): ResidueStyle {
  const key = normalizeProteinResidue(residue);
  return styleMap[key] ?? styleMap.X ?? { color: '#7d8597', shape: 'circle', glyph: 'X' };
}
