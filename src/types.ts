export type SequenceType = 'protein' | 'dna';

export type SequenceInputSource = 'fasta_file' | 'fasta_text' | 'uniprot' | 'ncbi_nucleotide';

export interface SequenceRecord {
  sequence: string;
  sequenceType: SequenceType;
  accession?: string;
  proteinName?: string;
  geneName?: string;
  displayName?: string;
  organism?: string;
  source: SequenceInputSource;
  fastaHeader?: string;
}

export type ArtMode = 'glyph_grid' | 'ribbon_stripes' | 'radial_bloom';

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'hex' | 'ring';

export interface ResidueStyle {
  color: string;
  shape: ShapeKind;
  glyph: string;
}

export type ResidueStyleMap = Record<string, ResidueStyle>;

export interface LegendSettings {
  enabled: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  showSymbolMap: boolean;
  fontScale: number;
  paddingScale: number;
  panelOpacity: number;
}

export interface GlyphLabelSettings {
  enabled: boolean;
  color: string;
  sizeScale: number;
}

export interface ArtSettings {
  mode: ArtMode;
  proteinSchemeId: string;
  proteinResidueStyles: ResidueStyleMap;
  dnaSchemeId: string;
  dnaResidueStyles: ResidueStyleMap;
  scale: number;
  spacing: number;
  density: number;
  glyphLabels: GlyphLabelSettings;
  legend: LegendSettings;
}

export interface ExportSettings {
  format: 'svg' | 'png' | 'pdf';
  presetId: string;
  dpiScale: number;
  includeLegend: boolean;
}

export interface FastaEntry {
  id: string;
  description: string;
  header: string;
  sequence: string;
  sequenceType: SequenceType;
}

export interface ParsedFasta {
  entries: FastaEntry[];
}

export interface UniProtRecord {
  accession: string;
  proteinName?: string;
  geneName?: string;
  organism?: string;
  sequence: string;
}

export interface NcbiNucleotideRecord {
  accession: string;
  title?: string;
  organism?: string;
  sequence: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintPreset {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

export interface LayoutResult {
  widthPx: number;
  heightPx: number;
  artRect: Rect;
  legendRect?: Rect;
}

// Compatibility aliases retained during refactor.
export type ProteinInputSource = SequenceInputSource;
export type ProteinRecord = SequenceRecord;
