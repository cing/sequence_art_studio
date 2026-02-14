import { type ChangeEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AMINO_ACIDS_20,
  GLYPH_SHAPES,
  PROTEIN_STYLE_SCHEMES,
  buildProteinStyleMapFromScheme,
} from './lib/aa-map';
import { DNA_STYLE_SCHEMES, DNA_SYMBOLS, buildDnaStyleMapFromScheme } from './lib/dna-map';
import { parseFasta } from './lib/fasta';
import { buildLayout, getPrintPreset, PRINT_PRESETS } from './lib/layout';
import { fetchNcbiNucleotide } from './lib/ncbi-nucleotide';
import { getStyleForSequenceSymbol } from './lib/style-map';
import { fetchUniProt } from './lib/uniprot';
import { clamp, wrapWords } from './lib/utils';
import { exportPdf, exportPng, exportSvg } from './export/exporters';
import { renderSurface } from './renderers/background';
import { renderArt } from './renderers';
import { getWangSymbolColor } from './renderers/wangMaze';
import type {
  ArtMode,
  ArtSettings,
  ExportSettings,
  FastaEntry,
  SequenceInputSource,
  SequenceRecord,
  SequenceType,
  ResidueStyle,
  ShapeKind,
} from './types';

interface MetadataFields {
  title: string;
  subtitle: string;
  accession: string;
}

interface LegendLayout {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  padding: number;
  titleLines: string[];
  subtitleLines: string[];
  footerLines: string[];
  titleFont: number;
  subtitleFont: number;
  footerFont: number;
  titleStartY: number;
  subtitleStartY: number;
  footerStartY: number;
  symbolCols: number;
  symbolCellW: number;
  symbolCellH: number;
  symbolGridTop: number;
  symbolTitleY: number;
}

type LegendFontFamilyId = ArtSettings['legend']['fontFamily'];

const DEFAULT_PROTEIN_SCHEME_ID = PROTEIN_STYLE_SCHEMES[0].id;
const DEFAULT_DNA_SCHEME_ID = DNA_STYLE_SCHEMES[0].id;
const CUSTOM_PROTEIN_SCHEME_ID = 'protein_custom_manual';
const CUSTOM_DNA_SCHEME_ID = 'dna_custom_manual';

const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  diamond: 'Diamond',
  hex: 'Hex',
  ring: 'Ring',
};

const SHAPE_SYMBOLS: Record<ShapeKind, string> = {
  circle: '●',
  square: '■',
  triangle: '▲',
  diamond: '◆',
  hex: '⬢',
  ring: '◌',
};

const LEGEND_FONT_OPTIONS: Array<{ id: LegendFontFamilyId; label: string; css: string }> = [
  { id: 'space_grotesk', label: 'Space Grotesk', css: "'Space Grotesk', 'Avenir Next', sans-serif" },
  { id: 'ibm_plex_sans', label: 'IBM Plex Sans', css: "'IBM Plex Sans', 'Segoe UI', sans-serif" },
  { id: 'ibm_plex_mono', label: 'IBM Plex Mono', css: "'IBM Plex Mono', 'JetBrains Mono', monospace" },
  { id: 'georgia', label: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
  { id: 'helvetica', label: 'Helvetica', css: "Helvetica, Arial, sans-serif" },
];

function createDefaultArtSettings(): ArtSettings {
  return {
    mode: 'glyph_grid',
    proteinSchemeId: DEFAULT_PROTEIN_SCHEME_ID,
    proteinResidueStyles: buildProteinStyleMapFromScheme(DEFAULT_PROTEIN_SCHEME_ID),
    dnaSchemeId: DEFAULT_DNA_SCHEME_ID,
    dnaResidueStyles: buildDnaStyleMapFromScheme(DEFAULT_DNA_SCHEME_ID),
    showArtBorder: true,
    scale: 1,
    spacing: 1,
    density: 1,
    glyphLabels: {
      enabled: true,
      color: '#21303a',
      sizeScale: 1,
    },
    legend: {
      enabled: true,
      position: 'bottom',
      showSymbolMap: true,
      showBorder: true,
      fontScale: 1,
      paddingScale: 1,
      textAlign: 'left',
      boldText: false,
      fontFamily: 'space_grotesk',
      xOffset: 0,
      yOffset: 0,
      widthScale: 1,
      heightScale: 1,
    },
  };
}

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'svg',
  presetId: PRINT_PRESETS[0].id,
  dpiScale: 1,
  includeLegend: true,
};

const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.2;

function sequenceUnit(sequenceType: SequenceType): 'aa' | 'nt' {
  return sequenceType === 'dna' ? 'nt' : 'aa';
}

function deriveMetadata(record: SequenceRecord): MetadataFields {
  const title =
    record.displayName ||
    record.proteinName ||
    record.geneName ||
    record.fastaHeader ||
    record.accession ||
    'Untitled sequence';
  const subtitleParts = [record.geneName, record.organism, record.accession].filter(Boolean);
  return {
    title,
    subtitle: subtitleParts.join(' | '),
    accession: record.accession ?? '',
  };
}

function fromFastaEntry(entry: FastaEntry, source: SequenceInputSource): SequenceRecord {
  return {
    sequence: entry.sequence,
    sequenceType: entry.sequenceType,
    displayName: entry.id,
    fastaHeader: entry.header,
    source,
  };
}

function toFileName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'sequence-art';
}

function polygonPoints(x: number, y: number, radius: number, edges: number, offset = 0): string {
  const points: string[] = [];
  for (let i = 0; i < edges; i += 1) {
    const angle = offset + (Math.PI * 2 * i) / edges;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return points.join(' ');
}

function renderShapeGlyph(shape: ShapeKind, x: number, y: number, size: number, color: string): JSX.Element {
  const stroke = 'rgba(8, 15, 20, 0.18)';

  if (shape === 'circle') {
    return <circle cx={x} cy={y} r={size * 0.45} fill={color} stroke={stroke} strokeWidth={Math.max(0.7, size * 0.08)} />;
  }

  if (shape === 'square') {
    return (
      <rect
        x={x - size * 0.45}
        y={y - size * 0.45}
        width={size * 0.9}
        height={size * 0.9}
        fill={color}
        stroke={stroke}
        strokeWidth={Math.max(0.7, size * 0.08)}
      />
    );
  }

  if (shape === 'triangle') {
    return (
      <polygon
        points={polygonPoints(x, y, size * 0.52, 3, -Math.PI / 2)}
        fill={color}
        stroke={stroke}
        strokeWidth={Math.max(0.7, size * 0.08)}
      />
    );
  }

  if (shape === 'diamond') {
    return (
      <polygon
        points={polygonPoints(x, y, size * 0.5, 4, Math.PI / 4)}
        fill={color}
        stroke={stroke}
        strokeWidth={Math.max(0.7, size * 0.08)}
      />
    );
  }

  if (shape === 'hex') {
    return (
      <polygon
        points={polygonPoints(x, y, size * 0.5, 6, Math.PI / 6)}
        fill={color}
        stroke={stroke}
        strokeWidth={Math.max(0.7, size * 0.08)}
      />
    );
  }

  return <circle cx={x} cy={y} r={size * 0.4} fill="none" stroke={color} strokeWidth={Math.max(1.1, size * 0.2)} />;
}

function renderLegendModeSymbol(
  mode: ArtMode,
  shape: ShapeKind,
  x: number,
  y: number,
  size: number,
  color: string,
): JSX.Element {
  const stroke = 'rgba(8, 15, 20, 0.16)';
  const tileSize = size * 0.9;
  const left = x - tileSize * 0.5;
  const top = y - tileSize * 0.5;
  const right = left + tileSize;
  const bottom = top + tileSize;

  if (mode === 'glyph_grid') {
    return renderShapeGlyph(shape, x, y, size, color);
  }

  if (mode === 'ribbon_stripes') {
    return (
      <rect
        x={x - tileSize * 0.5}
        y={y - tileSize * 0.26}
        width={tileSize}
        height={tileSize * 0.52}
        rx={Math.max(1, tileSize * 0.2)}
        fill={color}
        stroke={stroke}
        strokeWidth={Math.max(0.7, size * 0.06)}
      />
    );
  }

  if (mode === 'radial_bloom') {
    const radius = tileSize * 0.46;
    const start = -Math.PI * 0.74;
    const end = Math.PI * 0.04;
    const sx = x + Math.cos(start) * radius;
    const sy = y + Math.sin(start) * radius;
    const ex = x + Math.cos(end) * radius;
    const ey = y + Math.sin(end) * radius;
    const wedgePath = `M ${x.toFixed(3)} ${y.toFixed(3)} L ${sx.toFixed(3)} ${sy.toFixed(3)} A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 0 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`;
    return (
      <g>
        <circle cx={x} cy={y} r={radius} fill={color} fillOpacity={0.2} />
        <path d={wedgePath} fill={color} stroke={stroke} strokeWidth={Math.max(0.55, size * 0.05)} />
      </g>
    );
  }

  if (mode === 'wang_maze') {
    const cx = (left + right) * 0.5;
    const cy = (top + bottom) * 0.5;
    return (
      <g>
        <rect x={left} y={top} width={tileSize} height={tileSize} fill={color} fillOpacity={0.88} stroke={stroke} strokeWidth={Math.max(0.7, size * 0.06)} />
        <polygon points={`${left.toFixed(3)},${top.toFixed(3)} ${right.toFixed(3)},${top.toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`} fill="white" fillOpacity={0.16} />
        <polygon points={`${right.toFixed(3)},${top.toFixed(3)} ${right.toFixed(3)},${bottom.toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`} fill="black" fillOpacity={0.09} />
      </g>
    );
  }

  const diagonalPoints = `${left.toFixed(3)},${top.toFixed(3)} ${right.toFixed(3)},${top.toFixed(3)} ${left.toFixed(3)},${bottom.toFixed(3)}`;
  return (
    <g>
      <rect x={left} y={top} width={tileSize} height={tileSize} fill={color} stroke={stroke} strokeWidth={Math.max(0.7, size * 0.06)} />
      <polygon points={diagonalPoints} fill="white" fillOpacity={0.58} />
      <line
        x1={left}
        y1={bottom}
        x2={right}
        y2={top}
        stroke="rgba(8, 15, 20, 0.22)"
        strokeWidth={Math.max(0.65, size * 0.055)}
      />
    </g>
  );
}

function symbolLegendTitle(sequenceType: SequenceType, mode: ArtMode): string {
  const prefix = sequenceType === 'dna' ? 'DNA Symbol' : 'Amino Acid';
  if (mode === 'glyph_grid') {
    return `${prefix} Color & Glyph Key`;
  }
  if (mode === 'wang_maze') {
    return `${prefix} Wang Tile Color Key`;
  }
  if (mode === 'truchet_tiles') {
    return `${prefix} Truchet Tile Color Key`;
  }
  if (mode === 'ribbon_stripes') {
    return `${prefix} Ribbon Color Key`;
  }
  if (mode === 'radial_bloom') {
    return `${prefix} Bloom Color Key`;
  }
  return `${prefix} Color Key`;
}

function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const uidRef = useRef(`art-${Math.random().toString(36).slice(2, 10)}`);
  const previewDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const legendDragRef = useRef<{
    mode: 'move' | 'resize';
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startWidthScale: number;
    startHeightScale: number;
    startBoxWidth: number;
    startBoxHeight: number;
    maxOffsetX: number;
    maxOffsetY: number;
  } | null>(null);
  const glyphMapSectionRef = useRef<HTMLElement | null>(null);
  const customColorPanelVisibleRef = useRef(false);

  const [inputMode, setInputMode] = useState<'fasta_file' | 'fasta_text' | 'accession'>('fasta_file');
  const [accessionProvider, setAccessionProvider] = useState<'uniprot' | 'ncbi_nucleotide'>('uniprot');
  const [artSettings, setArtSettings] = useState<ArtSettings>(() => createDefaultArtSettings());
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

  const [fastaText, setFastaText] = useState('');
  const [fastaEntries, setFastaEntries] = useState<FastaEntry[]>([]);
  const [selectedFastaIndex, setSelectedFastaIndex] = useState(0);
  const [accessionInput, setAccessionInput] = useState('');

  const [record, setRecord] = useState<SequenceRecord | null>(null);
  const [metadata, setMetadata] = useState<MetadataFields>({ title: '', subtitle: '', accession: '' });

  const [inputError, setInputError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewDragging, setPreviewDragging] = useState(false);
  const [showLegendEditor, setShowLegendEditor] = useState(true);

  const activeSequenceType: SequenceType = record?.sequenceType ?? 'protein';

  const layout = useMemo(
    () => buildLayout(exportSettings.presetId, artSettings.legend),
    [artSettings.legend, exportSettings.presetId],
  );

  const renderResult = useMemo(() => {
    if (!record) {
      return null;
    }
    return renderArt(record.sequence, record.sequenceType, layout.artRect, artSettings, uidRef.current);
  }, [record, layout, artSettings]);

  const legendTextColor = '#12212a';

  const dnaSymbolsInSequence = useMemo(() => {
    if (!record || record.sequenceType !== 'dna') {
      return [...DNA_SYMBOLS];
    }

    const present = new Set(record.sequence.toUpperCase().split(''));
    const filtered = DNA_SYMBOLS.filter((symbol) => present.has(symbol));
    return filtered.length > 0 ? filtered : [...DNA_SYMBOLS];
  }, [record]);

  const activeSymbols = useMemo(
    () => (activeSequenceType === 'dna' ? dnaSymbolsInSequence : [...AMINO_ACIDS_20]),
    [activeSequenceType, dnaSymbolsInSequence],
  );

  const showLegendTitle = artSettings.legend.enabled;
  const showSymbolLegendInPreview = artSettings.legend.showSymbolMap;
  const legendHasContent = showLegendTitle || showSymbolLegendInPreview;
  const legendFontCss =
    LEGEND_FONT_OPTIONS.find((item) => item.id === artSettings.legend.fontFamily)?.css ??
    LEGEND_FONT_OPTIONS[0].css;
  const legendTextAnchor: 'start' | 'middle' | 'end' =
    artSettings.legend.textAlign === 'center'
      ? 'middle'
      : artSettings.legend.textAlign === 'right'
        ? 'end'
        : 'start';

  const activeScheme = useMemo(() => {
    if (activeSequenceType === 'dna') {
      return DNA_STYLE_SCHEMES.find((item) => item.id === artSettings.dnaSchemeId);
    }
    return PROTEIN_STYLE_SCHEMES.find((item) => item.id === artSettings.proteinSchemeId);
  }, [activeSequenceType, artSettings.dnaSchemeId, artSettings.proteinSchemeId]);

  function applyStyleScheme(schemeId: string): void {
    if (activeSequenceType === 'dna') {
      const scheme = DNA_STYLE_SCHEMES.find((item) => item.id === schemeId);
      setArtSettings((current) => ({
        ...current,
        dnaSchemeId: schemeId,
        dnaResidueStyles: buildDnaStyleMapFromScheme(schemeId),
      }));
      if (scheme) {
        setStatus(`Applied ${scheme.label}.`);
      }
      return;
    }

    const scheme = PROTEIN_STYLE_SCHEMES.find((item) => item.id === schemeId);
    setArtSettings((current) => ({
      ...current,
      proteinSchemeId: schemeId,
      proteinResidueStyles: buildProteinStyleMapFromScheme(schemeId),
    }));
    if (scheme) {
      setStatus(`Applied ${scheme.label}.`);
    }
  }

  function updateSymbolStyle(symbol: string, patch: Partial<ResidueStyle>): void {
    if (activeSequenceType === 'dna') {
      setArtSettings((current) => {
        const existing = current.dnaResidueStyles[symbol] ?? getStyleForSequenceSymbol(symbol, 'dna', current);
        return {
          ...current,
          dnaSchemeId: CUSTOM_DNA_SCHEME_ID,
          dnaResidueStyles: {
            ...current.dnaResidueStyles,
            [symbol]: {
              ...existing,
              ...patch,
              glyph: symbol,
            },
          },
        };
      });
      return;
    }

    setArtSettings((current) => {
      const existing = current.proteinResidueStyles[symbol] ?? getStyleForSequenceSymbol(symbol, 'protein', current);
      return {
        ...current,
        proteinSchemeId: CUSTOM_PROTEIN_SCHEME_ID,
        proteinResidueStyles: {
          ...current.proteinResidueStyles,
          [symbol]: {
            ...existing,
            ...patch,
            glyph: symbol,
          },
        },
      };
    });
  }

  async function loadFasta(rawInput: string, source: SequenceInputSource): Promise<void> {
    const parsed = parseFasta(rawInput);
    setFastaEntries(parsed.entries);
    setSelectedFastaIndex(0);

    const nextRecord = fromFastaEntry(parsed.entries[0], source);
    setRecord(nextRecord);
    resetPreviewView();
    setMetadata(deriveMetadata(nextRecord));
    setInputError(null);
    setStatus(
      `Loaded ${parsed.entries.length} FASTA entr${parsed.entries.length === 1 ? 'y' : 'ies'} (detected ${nextRecord.sequenceType.toUpperCase()}).`,
    );
  }

  async function handleFastaFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      await loadFasta(text, 'fasta_file');
      setInputMode('fasta_file');
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Failed to read FASTA file.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleParseFastaText(): Promise<void> {
    try {
      await loadFasta(fastaText, 'fasta_text');
      setInputMode('fasta_text');
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Failed to parse FASTA text.');
    }
  }

  function handleFastaSelection(index: number): void {
    if (!fastaEntries[index]) {
      return;
    }
    setSelectedFastaIndex(index);
    const source: SequenceInputSource = inputMode === 'fasta_file' ? 'fasta_file' : 'fasta_text';
    const nextRecord = fromFastaEntry(fastaEntries[index], source);
    setRecord(nextRecord);
    resetPreviewView();
    setMetadata(deriveMetadata(nextRecord));
    setInputError(null);
  }

  async function handleAccessionFetch(): Promise<void> {
    try {
      setLoadingRemote(true);

      if (accessionProvider === 'uniprot') {
        const remote = await fetchUniProt(accessionInput);
        const nextRecord: SequenceRecord = {
          sequence: remote.sequence,
          sequenceType: 'protein',
          accession: remote.accession,
          geneName: remote.geneName,
          proteinName: remote.proteinName,
          displayName: remote.proteinName ?? remote.geneName ?? remote.accession,
          organism: remote.organism,
          source: 'uniprot',
        };
        setRecord(nextRecord);
        resetPreviewView();
        setMetadata(deriveMetadata(nextRecord));
        setStatus(`Loaded UniProt ${remote.accession} (protein).`);
      } else {
        const remote = await fetchNcbiNucleotide(accessionInput);
        const nextRecord: SequenceRecord = {
          sequence: remote.sequence,
          sequenceType: 'dna',
          accession: remote.accession,
          displayName: remote.title ?? remote.accession,
          organism: remote.organism,
          source: 'ncbi_nucleotide',
        };
        setRecord(nextRecord);
        resetPreviewView();
        setMetadata(deriveMetadata(nextRecord));
        setStatus(`Loaded NCBI nucleotide ${remote.accession} (DNA).`);
      }

      setInputMode('accession');
      setInputError(null);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Failed to load accession record.');
    } finally {
      setLoadingRemote(false);
    }
  }

  async function handleExport(): Promise<void> {
    const svg = svgRef.current;
    if (!svg || !record) {
      return;
    }

    const preset = getPrintPreset(exportSettings.presetId);
    const base = toFileName(metadata.title || metadata.accession || record.displayName || 'sequence-art');

    try {
      setExporting(true);
      setStatus('Preparing export...');
      if (exportSettings.format === 'svg') {
        exportSvg(svg, `${base}.svg`, exportSettings.includeLegend);
      } else if (exportSettings.format === 'png') {
        await exportPng(
          svg,
          `${base}.png`,
          exportSettings.includeLegend,
          layout.widthPx,
          layout.heightPx,
          exportSettings.dpiScale,
        );
      } else {
        await exportPdf(svg, `${base}.pdf`, exportSettings.includeLegend, preset.widthIn, preset.heightIn);
      }
      setStatus(`Exported ${base}.${exportSettings.format}`);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  const legendLayout = useMemo((): LegendLayout | null => {
    if (!layout.legendRect || !record || !legendHasContent) {
      return null;
    }

    const container = layout.legendRect;
    const fontScale = clamp(artSettings.legend.fontScale, 0.75, 1.5);
    const paddingScale = clamp(artSettings.legend.paddingScale, 0.75, 1.5);
    const unit = clamp(Math.round(Math.min(container.width, container.height) * 0.08 * fontScale), 10, 52);
    const padding = clamp(Math.round(unit * 0.82 * paddingScale), 10, 54);
    const footerText = showLegendTitle
      ? `Type: ${record.sequenceType.toUpperCase()} | Length: ${record.sequence.length} ${sequenceUnit(record.sequenceType)}${metadata.accession ? ` | Accession: ${metadata.accession}` : ''}`
      : '';

    const minBoxWidth = Math.min(container.width, 260);
    const estimatedTextWidth = showLegendTitle
      ? Math.max(metadata.title.length, metadata.subtitle.length, footerText.length, 24) * unit * 0.6
      : Math.max(28, activeSymbols.length * 2) * unit * 0.52;
    const baseWidth = clamp(
      Math.round(estimatedTextWidth + padding * 2),
      minBoxWidth,
      container.width,
    );
    const widthScale = clamp(artSettings.legend.widthScale, 0.55, 2.4);
    const heightScale = clamp(artSettings.legend.heightScale, 0.6, 2.6);
    const scaledWidthForWrap = clamp(Math.round(baseWidth * widthScale), Math.min(container.width, 220), container.width);

    const textWrapChars = Math.max(12, Math.floor((scaledWidthForWrap - padding * 2) / (unit * 0.58)));

    const titleLines = showLegendTitle ? wrapWords(metadata.title || 'Untitled sequence', textWrapChars).slice(0, 3) : [];
    const subtitleLines =
      showLegendTitle && metadata.subtitle ? wrapWords(metadata.subtitle, textWrapChars).slice(0, 2) : [];
    const footerLines = showLegendTitle ? wrapWords(footerText, textWrapChars).slice(0, 2) : [];

    const titleFont = clamp(Math.round(unit * 1.06), 14, 48);
    const subtitleFont = clamp(Math.round(unit * 0.78), 11, 32);
    const footerFont = clamp(Math.round(unit * 0.7), 10, 30);

    const titleHeight = titleLines.length * titleFont * 1.15;
    const subtitleHeight = subtitleLines.length * subtitleFont * 1.2;
    const footerHeight = footerLines.length * footerFont * 1.2;

    const subtitleGap = showLegendTitle && subtitleLines.length > 0 ? unit * 0.32 : 0;
    const footerGap = showLegendTitle ? unit * 0.38 : 0;
    const symbolTitleGap = showSymbolLegendInPreview ? (showLegendTitle ? unit * 0.72 : unit * 0.56) : 0;
    const textHeight = showLegendTitle ? titleHeight + subtitleGap + subtitleHeight + footerGap + footerHeight : 0;

    const symbolCellHeight = clamp(Math.round(unit * 1.44), 22, 62);
    const symbolCellWidth = clamp(Math.round(unit * 3.1), 68, 180);

    const innerWidth = scaledWidthForWrap - padding * 2;
    const symbolCols = showSymbolLegendInPreview
      ? clamp(Math.floor(innerWidth / symbolCellWidth), 2, 10)
      : 0;
    const symbolRows = symbolCols > 0 ? Math.ceil(activeSymbols.length / symbolCols) : 0;
    const symbolMapHeight = symbolRows > 0 ? symbolRows * symbolCellHeight + symbolTitleGap : 0;

    const desiredHeight = Math.round(
      padding * 2 +
      textHeight +
      (symbolMapHeight > 0 ? (showLegendTitle ? unit * 0.42 : unit * 0.2) : unit * 0.24) +
      symbolMapHeight,
    );

    const boxHeight = clamp(Math.round(desiredHeight * heightScale), Math.min(container.height, 110), container.height);
    const boxWidth = clamp(scaledWidthForWrap, Math.min(container.width, 220), container.width);

    const centeredX = container.x + (container.width - boxWidth) * 0.5;
    const centeredY = container.y + (container.height - boxHeight) * 0.5;
    const offsetX = artSettings.legend.xOffset;
    const offsetY = artSettings.legend.yOffset;
    const boxX = clamp(centeredX + offsetX, container.x, container.x + container.width - boxWidth);
    const boxY = clamp(centeredY + offsetY, container.y, container.y + container.height - boxHeight);

    const actualInnerWidth = boxWidth - padding * 2;
    const actualSymbolCols = symbolCols > 0 ? clamp(Math.floor(actualInnerWidth / symbolCellWidth), 2, 10) : 0;
    const actualSymbolCellWidth = actualSymbolCols > 0 ? actualInnerWidth / actualSymbolCols : 0;

    const titleStartY = showLegendTitle ? boxY + padding + titleFont : boxY + padding;
    const subtitleStartY = showLegendTitle ? titleStartY + titleHeight + subtitleGap : titleStartY;
    const footerStartY = showLegendTitle ? subtitleStartY + subtitleHeight + footerGap : subtitleStartY;
    const textBottomY = showLegendTitle ? footerStartY + footerHeight : boxY + padding;

    return {
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      padding,
      titleLines,
      subtitleLines,
      footerLines,
      titleFont,
      subtitleFont,
      footerFont,
      titleStartY,
      subtitleStartY,
      footerStartY,
      symbolCols: actualSymbolCols,
      symbolCellW: actualSymbolCellWidth,
      symbolCellH: symbolCellHeight,
      symbolGridTop: textBottomY + symbolTitleGap,
      symbolTitleY: textBottomY + (showLegendTitle ? unit * 0.34 : unit * 0.78),
    };
  }, [
    layout.legendRect,
    legendHasContent,
    showLegendTitle,
    artSettings.legend.fontScale,
    artSettings.legend.paddingScale,
    artSettings.legend.widthScale,
    artSettings.legend.heightScale,
    artSettings.legend.xOffset,
    artSettings.legend.yOffset,
    showSymbolLegendInPreview,
    metadata.accession,
    metadata.subtitle,
    metadata.title,
    record,
    activeSymbols,
  ]);

  const currentSchemeId = activeSequenceType === 'dna' ? artSettings.dnaSchemeId : artSettings.proteinSchemeId;
  const isCustomSchemeSelected =
    currentSchemeId === (activeSequenceType === 'dna' ? CUSTOM_DNA_SCHEME_ID : CUSTOM_PROTEIN_SCHEME_ID);
  const showColorMapEditor = artSettings.mode === 'glyph_grid' || isCustomSchemeSelected;

  const currentSchemeOptions = activeSequenceType === 'dna' ? DNA_STYLE_SCHEMES : PROTEIN_STYLE_SCHEMES;
  const legendTextX = useMemo(() => {
    if (!legendLayout) {
      return 0;
    }
    if (legendTextAnchor === 'middle') {
      return legendLayout.boxX + legendLayout.boxWidth * 0.5;
    }
    if (legendTextAnchor === 'end') {
      return legendLayout.boxX + legendLayout.boxWidth - legendLayout.padding;
    }
    return legendLayout.boxX + legendLayout.padding;
  }, [legendLayout, legendTextAnchor]);

  const previewIsDefault =
    Math.abs(previewScale - 1) < 0.0001 && Math.abs(previewPan.x) < 0.1 && Math.abs(previewPan.y) < 0.1;

  useEffect(() => {
    const shouldReveal = isCustomSchemeSelected && artSettings.mode !== 'glyph_grid';
    if (shouldReveal && !customColorPanelVisibleRef.current) {
      glyphMapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    customColorPanelVisibleRef.current = shouldReveal;
  }, [isCustomSchemeSelected, artSettings.mode]);

  function resetPreviewView(): void {
    previewDragRef.current = null;
    setPreviewDragging(false);
    setPreviewScale(1);
    setPreviewPan({ x: 0, y: 0 });
  }

  function zoomPreview(delta: number): void {
    setPreviewScale((current) => clamp(Number((current + delta).toFixed(3)), PREVIEW_ZOOM_MIN, PREVIEW_ZOOM_MAX));
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!record) {
      return;
    }
    event.preventDefault();
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: previewPan.x,
      originY: previewPan.y,
    };
    setPreviewDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setPreviewPan({
      x: drag.originX + dx,
      y: drag.originY + dy,
    });
  }

  function handlePreviewPointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    previewDragRef.current = null;
    setPreviewDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function startLegendDrag(event: ReactPointerEvent<SVGGraphicsElement>, mode: 'move' | 'resize'): void {
    if (!legendLayout || !layout.legendRect || !legendHasContent) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const maxOffsetX = Math.max(0, (layout.legendRect.width - legendLayout.boxWidth) * 0.5);
    const maxOffsetY = Math.max(0, (layout.legendRect.height - legendLayout.boxHeight) * 0.5);

    legendDragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: artSettings.legend.xOffset,
      startOffsetY: artSettings.legend.yOffset,
      startWidthScale: artSettings.legend.widthScale,
      startHeightScale: artSettings.legend.heightScale,
      startBoxWidth: legendLayout.boxWidth,
      startBoxHeight: legendLayout.boxHeight,
      maxOffsetX,
      maxOffsetY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleLegendDragPointerMove(event: ReactPointerEvent<SVGGraphicsElement>): void {
    const drag = legendDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.mode === 'move') {
      setArtSettings((current) => ({
        ...current,
        legend: {
          ...current.legend,
          xOffset: clamp(drag.startOffsetX + dx, -drag.maxOffsetX, drag.maxOffsetX),
          yOffset: clamp(drag.startOffsetY + dy, -drag.maxOffsetY, drag.maxOffsetY),
        },
      }));
      return;
    }

    const widthDeltaScale = dx / Math.max(80, drag.startBoxWidth);
    const heightDeltaScale = dy / Math.max(70, drag.startBoxHeight);
    setArtSettings((current) => ({
      ...current,
      legend: {
        ...current.legend,
        widthScale: clamp(drag.startWidthScale + widthDeltaScale, 0.55, 2.4),
        heightScale: clamp(drag.startHeightScale + heightDeltaScale, 0.6, 2.6),
      },
    }));
  }

  function handleLegendDragPointerEnd(event: ReactPointerEvent<SVGGraphicsElement>): void {
    const drag = legendDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    legendDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="app-shell">
      <aside className="panel left-panel">
        <header>
          <h1>Sequence Art Studio</h1>
          <p>Create printable DNA or protein visuals from FASTA or accession IDs.</p>
        </header>

        <section className="input-section">
          <h2>Input</h2>
          <div className="tab-row">
            <button className={inputMode === 'fasta_file' ? 'tab active' : 'tab'} onClick={() => setInputMode('fasta_file')}>
              FASTA File
            </button>
            <button className={inputMode === 'fasta_text' ? 'tab active' : 'tab'} onClick={() => setInputMode('fasta_text')}>
              Paste FASTA
            </button>
            <button className={inputMode === 'accession' ? 'tab active' : 'tab'} onClick={() => setInputMode('accession')}>
              Accession ID
            </button>
          </div>

          {inputMode === 'fasta_file' ? (
            <div className="stack">
              <input type="file" accept=".fasta,.fa,.faa,.fna,.txt" onChange={handleFastaFile} />
              <small>Supports multi-entry FASTA with automatic DNA/protein detection per entry.</small>
            </div>
          ) : null}

          {inputMode === 'fasta_text' ? (
            <div className="stack">
              <textarea
                value={fastaText}
                onChange={(event) => setFastaText(event.target.value)}
                placeholder=">NM_000546.6 TP53\nATGGAGGAGCCGCAGTCAGAT..."
                rows={7}
              />
              <button onClick={handleParseFastaText}>Parse FASTA Text</button>
            </div>
          ) : null}

          {inputMode === 'accession' ? (
            <div className="stack">
              <label className="stack">
                Dataset provider
                <select
                  value={accessionProvider}
                  onChange={(event) => setAccessionProvider(event.target.value as 'uniprot' | 'ncbi_nucleotide')}
                >
                  <option value="uniprot">UniProt (protein)</option>
                  <option value="ncbi_nucleotide">NCBI Nucleotide (DNA)</option>
                </select>
              </label>

              <input
                value={accessionInput}
                onChange={(event) => setAccessionInput(event.target.value)}
                placeholder={accessionProvider === 'uniprot' ? 'P69905' : 'NM_000546.6'}
              />
              <button onClick={handleAccessionFetch} disabled={loadingRemote}>
                {loadingRemote ? 'Loading...' : 'Fetch Sequence'}
              </button>
            </div>
          ) : null}

          {fastaEntries.length > 1 && record?.source !== 'uniprot' && record?.source !== 'ncbi_nucleotide' ? (
            <label className="stack">
              FASTA entry
              <select
                value={selectedFastaIndex}
                onChange={(event) => handleFastaSelection(Number(event.target.value))}
              >
                {fastaEntries.map((entry, index) => (
                  <option value={index} key={`${entry.id}-${index}`}>
                    {entry.id} ({entry.sequence.length} {sequenceUnit(entry.sequenceType)} | {entry.sequenceType.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        <section className="metadata-section">
          <h2>Metadata Legend</h2>
          <small>Edit legend text directly in the preview editor panel.</small>

          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={artSettings.legend.enabled}
              onChange={(event) =>
                setArtSettings((current) => ({
                  ...current,
                  legend: { ...current.legend, enabled: event.target.checked },
                }))
              }
            />
            Show legend title
          </label>

          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={artSettings.legend.showSymbolMap}
              onChange={(event) =>
                setArtSettings((current) => ({
                  ...current,
                  legend: { ...current.legend, showSymbolMap: event.target.checked },
                }))
              }
            />
            Show symbol key in legend
          </label>

          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={artSettings.legend.showBorder}
              disabled={!legendHasContent}
              onChange={(event) =>
                setArtSettings((current) => ({
                  ...current,
                  legend: { ...current.legend, showBorder: event.target.checked },
                }))
              }
            />
            Show legend border
          </label>

          <label className="stack">
            Legend position
            <select
              value={artSettings.legend.position}
              disabled={!legendHasContent}
              onChange={(event) =>
                setArtSettings((current) => ({
                  ...current,
                  legend: {
                    ...current.legend,
                    position: event.target.value as ArtSettings['legend']['position'],
                  },
                }))
              }
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

        </section>

        <section className="glyph-map-section" ref={glyphMapSectionRef}>
          <h2>{activeSequenceType === 'dna' ? 'DNA Symbol Glyph/Color Map' : 'Amino Acid Glyph/Color Map'}</h2>
          {activeSequenceType === 'dna' && record ? (
            <small>
              Showing only DNA symbols present in this sequence ({activeSymbols.join(', ')}).
            </small>
          ) : null}
          {showColorMapEditor ? (
            <>
              <small>
                Color edits apply to all art modes and will switch to Custom.
              </small>
              <div className="aa-style-grid">
                {activeSymbols.map((symbol) => {
                  const style = getStyleForSequenceSymbol(symbol, activeSequenceType, artSettings);
                  return (
                    <div className="aa-style-row" key={symbol}>
                      <span className="aa-token">{symbol}</span>
                      <input
                        className="aa-color-input"
                        type="color"
                        value={style.color}
                        onChange={(event) => updateSymbolStyle(symbol, { color: event.target.value })}
                        aria-label={`${symbol} color`}
                      />
                      <select
                        className="glyph-shape-select"
                        value={style.shape}
                        disabled={artSettings.mode !== 'glyph_grid'}
                        onChange={(event) => updateSymbolStyle(symbol, { shape: event.target.value as ShapeKind })}
                        aria-label={`${symbol} glyph`}
                      >
                        {GLYPH_SHAPES.map((shape) => (
                          <option value={shape} key={shape} title={SHAPE_LABELS[shape]}>
                            {SHAPE_SYMBOLS[shape]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              {artSettings.mode === 'glyph_grid' ? (
                <>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={artSettings.glyphLabels.enabled}
                      onChange={(event) =>
                        setArtSettings((current) => ({
                          ...current,
                          glyphLabels: { ...current.glyphLabels, enabled: event.target.checked },
                        }))
                      }
                    />
                    Show glyph labels in preview
                  </label>
                  <label className="stack">
                    Glyph label size ({artSettings.glyphLabels.sizeScale.toFixed(2)})
                    <input
                      type="range"
                      min={0.6}
                      max={1.8}
                      step={0.01}
                      value={artSettings.glyphLabels.sizeScale}
                      onChange={(event) =>
                        setArtSettings((current) => ({
                          ...current,
                          glyphLabels: { ...current.glyphLabels, sizeScale: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label className="stack">
                    Glyph label color
                    <input
                      type="color"
                      value={artSettings.glyphLabels.color}
                      onChange={(event) =>
                        setArtSettings((current) => ({
                          ...current,
                          glyphLabels: { ...current.glyphLabels, color: event.target.value },
                        }))
                      }
                      aria-label="Glyph label color"
                    />
                  </label>
                </>
              ) : (
                <small>Glyph shape and label controls apply only to Glyph Grid mode.</small>
              )}
            </>
          ) : (
            <small>Select Scheme preset to `Custom` to edit symbol colors in this mode.</small>
          )}
        </section>

        <section className="style-section">
          <h2>Art Settings</h2>
          <label className="stack">
            Mode
            <select
              value={artSettings.mode}
              onChange={(event) => setArtSettings((current) => ({ ...current, mode: event.target.value as ArtMode }))}
            >
              <option value="glyph_grid">Glyph Grid</option>
              <option value="ribbon_stripes">Ribbon Stripes</option>
              <option value="radial_bloom">Radial Bloom</option>
              <option value="wang_maze">Maze Wang Tiles</option>
              <option value="truchet_tiles">Truchet Tiles</option>
            </select>
          </label>

          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={artSettings.showArtBorder}
              onChange={(event) =>
                setArtSettings((current) => ({
                  ...current,
                  showArtBorder: event.target.checked,
                }))
              }
            />
            Show art border
          </label>

          <label className="stack">
            Scheme preset
            <select
              value={currentSchemeId}
              onChange={(event) => {
                const selected = event.target.value;
                if (selected === CUSTOM_DNA_SCHEME_ID || selected === CUSTOM_PROTEIN_SCHEME_ID) {
                  if (activeSequenceType === 'dna') {
                    setArtSettings((current) => ({ ...current, dnaSchemeId: CUSTOM_DNA_SCHEME_ID }));
                  } else {
                    setArtSettings((current) => ({ ...current, proteinSchemeId: CUSTOM_PROTEIN_SCHEME_ID }));
                  }
                  return;
                }
                applyStyleScheme(selected);
              }}
            >
              {currentSchemeOptions.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>{scheme.label}</option>
              ))}
              <option value={activeSequenceType === 'dna' ? CUSTOM_DNA_SCHEME_ID : CUSTOM_PROTEIN_SCHEME_ID}>Custom</option>
            </select>
          </label>

          <small>
            {activeScheme
              ? activeScheme.description
              : 'Per-symbol manual overrides are active.'}
          </small>

          <label className="stack">
            Scale ({artSettings.scale.toFixed(2)})
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.01}
              value={artSettings.scale}
              onChange={(event) => setArtSettings((current) => ({ ...current, scale: Number(event.target.value) }))}
            />
          </label>

          <label className="stack">
            Spacing ({artSettings.spacing.toFixed(2)})
            <input
              type="range"
              min={0.55}
              max={1.7}
              step={0.01}
              value={artSettings.spacing}
              onChange={(event) => setArtSettings((current) => ({ ...current, spacing: Number(event.target.value) }))}
            />
          </label>

          <label className="stack">
            Density ({artSettings.density.toFixed(2)})
            <input
              type="range"
              min={0.55}
              max={1.6}
              step={0.01}
              value={artSettings.density}
              onChange={(event) => setArtSettings((current) => ({ ...current, density: Number(event.target.value) }))}
            />
          </label>

        </section>

        <section className="export-section">
          <h2>Export</h2>

          <label className="stack">
            Print preset
            <select
              value={exportSettings.presetId}
              onChange={(event) => setExportSettings((current) => ({ ...current, presetId: event.target.value }))}
            >
              {PRINT_PRESETS.map((preset) => (
                <option value={preset.id} key={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label className="stack">
            Format
            <select
              value={exportSettings.format}
              onChange={(event) =>
                setExportSettings((current) => ({
                  ...current,
                  format: event.target.value as ExportSettings['format'],
                }))
              }
            >
              <option value="svg">SVG (vector)</option>
              <option value="png">PNG (raster)</option>
              <option value="pdf">PDF (vector)</option>
            </select>
          </label>

          {exportSettings.format === 'png' ? (
            <label className="stack">
              PNG scale ({exportSettings.dpiScale.toFixed(1)}x)
              <input
                type="range"
                min={1}
                max={4}
                step={0.5}
                value={exportSettings.dpiScale}
                onChange={(event) =>
                  setExportSettings((current) => ({
                    ...current,
                    dpiScale: Number(event.target.value),
                  }))
                }
              />
            </label>
          ) : null}

          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={exportSettings.includeLegend}
              onChange={(event) =>
                setExportSettings((current) => ({
                  ...current,
                  includeLegend: event.target.checked,
                }))
              }
            />
            Include legend in export
          </label>

          <button onClick={handleExport} disabled={!record || exporting}>
            {exporting ? 'Exporting...' : `Export ${exportSettings.format.toUpperCase()}`}
          </button>
        </section>
      </aside>

      <main className="panel preview-panel">
        <div className="preview-head">
          <div>
            <h2>Preview</h2>
            <p>
              {record
                ? `${record.sequence.length.toLocaleString()} ${sequenceUnit(record.sequenceType)} | ${record.sequenceType.toUpperCase()} | ${renderResult?.summary.plotted.toLocaleString() ?? 0} plotted`
                : 'Load a sequence to generate art'}
            </p>
          </div>
          <div className="preview-tools">
            {renderResult?.summary.warning ? <span className="warning-badge">{renderResult.summary.warning}</span> : null}
            {record ? (
              <div className="preview-zoom-controls">
                <button
                  type="button"
                  className="preview-zoom-btn"
                  onClick={() => zoomPreview(-PREVIEW_ZOOM_STEP)}
                  disabled={previewScale <= PREVIEW_ZOOM_MIN + 0.001}
                  aria-label="Zoom out preview"
                >
                  -
                </button>
                <span className="preview-zoom-value">{Math.round(previewScale * 100)}%</span>
                <button
                  type="button"
                  className="preview-zoom-btn"
                  onClick={() => zoomPreview(PREVIEW_ZOOM_STEP)}
                  disabled={previewScale >= PREVIEW_ZOOM_MAX - 0.001}
                  aria-label="Zoom in preview"
                >
                  +
                </button>
                <button
                  type="button"
                  className="preview-zoom-btn preview-zoom-reset"
                  onClick={resetPreviewView}
                  disabled={previewIsDefault}
                >
                  Reset
                </button>
                {showLegendTitle ? (
                  <button
                    type="button"
                    className="preview-zoom-btn preview-zoom-reset"
                    onClick={() => setShowLegendEditor((current) => !current)}
                  >
                    {showLegendEditor ? 'Hide Text' : 'Show Text'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="preview-frame">
          {record ? (
            <>
              <div
                className={previewDragging ? 'preview-canvas dragging' : 'preview-canvas'}
                style={{ transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewScale})` }}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerEnd}
                onPointerCancel={handlePreviewPointerEnd}
                onDoubleClick={resetPreviewView}
                title="Drag to pan. Double-click to reset view."
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${layout.widthPx} ${layout.heightPx}`}
                  role="img"
                  aria-label="Sequence art preview"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {renderSurface(layout.widthPx, layout.heightPx)}

                  {renderResult?.nodes}

                  {artSettings.showArtBorder ? (
                    <rect
                      x={layout.artRect.x}
                      y={layout.artRect.y}
                      width={layout.artRect.width}
                      height={layout.artRect.height}
                      fill="none"
                      stroke="rgba(15, 20, 30, 0.16)"
                      strokeWidth={Math.max(1, Math.round(layout.widthPx * 0.0013))}
                    />
                  ) : null}

                  {legendLayout ? (
                    <g data-legend="true">
                    <rect
                      x={legendLayout.boxX}
                      y={legendLayout.boxY}
                      width={legendLayout.boxWidth}
                      height={legendLayout.boxHeight}
                      fill="#ffffff"
                      stroke={artSettings.legend.showBorder ? 'rgba(10, 12, 20, 0.2)' : 'transparent'}
                      strokeWidth={artSettings.legend.showBorder ? Math.max(1, Math.round(layout.widthPx * 0.00095)) : 0}
                      rx={Math.max(8, Math.round(layout.widthPx * 0.006))}
                    />

                  {showLegendTitle ? (
                    <>
                      <text
                        x={legendTextX}
                        y={legendLayout.titleStartY}
                        fill={legendTextColor}
                        textAnchor={legendTextAnchor}
                        fontFamily={legendFontCss}
                        fontWeight={artSettings.legend.boldText ? 700 : 600}
                        fontSize={legendLayout.titleFont}
                      >
                        {legendLayout.titleLines.map((line, index) => (
                          <tspan
                            x={legendTextX}
                            dy={index === 0 ? 0 : `${1.15}em`}
                            key={`title-line-${line}-${index}`}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>

                      <text
                        x={legendTextX}
                        y={legendLayout.subtitleStartY}
                        fill={legendTextColor}
                        textAnchor={legendTextAnchor}
                        fontFamily={legendFontCss}
                        fontWeight={artSettings.legend.boldText ? 600 : 450}
                        fontSize={legendLayout.subtitleFont}
                      >
                        {legendLayout.subtitleLines.map((line, index) => (
                          <tspan
                            x={legendTextX}
                            dy={index === 0 ? 0 : `${1.2}em`}
                            key={`subtitle-line-${line}-${index}`}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>

                      <text
                        x={legendTextX}
                        y={legendLayout.footerStartY}
                        fill={legendTextColor}
                        textAnchor={legendTextAnchor}
                        fontFamily={legendFontCss}
                        fontWeight={artSettings.legend.boldText ? 600 : 450}
                        fontSize={legendLayout.footerFont}
                      >
                        {legendLayout.footerLines.map((line, index) => (
                          <tspan
                            x={legendTextX}
                            dy={index === 0 ? 0 : `${1.2}em`}
                            key={`footer-line-${line}-${index}`}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </>
                  ) : null}

                    {legendLayout.symbolCols > 0 ? (
                      <>
                        <text
                          x={legendLayout.boxX + legendLayout.padding}
                          y={legendLayout.symbolTitleY}
                          fill={legendTextColor}
                          fontFamily={legendFontCss}
                          fontWeight={artSettings.legend.boldText ? 700 : 600}
                          fontSize={Math.max(12, Math.round(legendLayout.subtitleFont * 0.94))}
                        >
                          {symbolLegendTitle(record.sequenceType, artSettings.mode)}
                        </text>

                        {activeSymbols.map((symbol, index) => {
                          const style = getStyleForSequenceSymbol(symbol, activeSequenceType, artSettings);
                          const legendColor =
                            artSettings.mode === 'wang_maze'
                              ? getWangSymbolColor(symbol, activeSequenceType, artSettings)
                              : style.color;
                          const row = Math.floor(index / legendLayout.symbolCols);
                          const col = index % legendLayout.symbolCols;

                          const cellX = legendLayout.boxX + legendLayout.padding + col * legendLayout.symbolCellW;
                          const cellY = legendLayout.symbolGridTop + row * legendLayout.symbolCellH;
                          const shapeSize = Math.min(legendLayout.symbolCellH * 0.78, legendLayout.symbolCellW * 0.35);

                          return (
                            <g key={`legend-symbol-${symbol}`}>
                              {renderLegendModeSymbol(
                                artSettings.mode,
                                style.shape,
                                cellX + shapeSize * 0.62,
                                cellY + legendLayout.symbolCellH * 0.5,
                                shapeSize,
                                legendColor,
                              )}
                              <text
                                x={cellX + shapeSize * 1.36}
                                y={cellY + legendLayout.symbolCellH * 0.62}
                                fill={legendTextColor}
                                fontFamily="'IBM Plex Mono', monospace"
                                fontSize={Math.max(10, Math.round(legendLayout.footerFont * 0.92))}
                              >
                                {symbol}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    ) : null}

                    <rect
                      x={legendLayout.boxX}
                      y={legendLayout.boxY}
                      width={legendLayout.boxWidth}
                      height={legendLayout.boxHeight}
                      fill="transparent"
                      stroke="transparent"
                      cursor="move"
                      onPointerDown={(event) => startLegendDrag(event, 'move')}
                      onPointerMove={handleLegendDragPointerMove}
                      onPointerUp={handleLegendDragPointerEnd}
                      onPointerCancel={handleLegendDragPointerEnd}
                    />
                    <rect
                      x={legendLayout.boxX + legendLayout.boxWidth - 16}
                      y={legendLayout.boxY + legendLayout.boxHeight - 16}
                      width={14}
                      height={14}
                      rx={3}
                      fill="rgba(30, 44, 56, 0.45)"
                      cursor="nwse-resize"
                      onPointerDown={(event) => startLegendDrag(event, 'resize')}
                      onPointerMove={handleLegendDragPointerMove}
                      onPointerUp={handleLegendDragPointerEnd}
                      onPointerCancel={handleLegendDragPointerEnd}
                    />
                    </g>
                  ) : null}
                </svg>
              </div>

              {showLegendTitle && showLegendEditor ? (
                <div
                  className="legend-editor"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <label className="stack">
                    Title
                    <input
                      value={metadata.title}
                      onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>
                  <label className="stack">
                    Subtitle
                    <input
                      value={metadata.subtitle}
                      onChange={(event) => setMetadata((current) => ({ ...current, subtitle: event.target.value }))}
                    />
                  </label>
                  <div className="legend-editor-grid">
                    <label className="stack">
                      Font
                      <select
                        value={artSettings.legend.fontFamily}
                        onChange={(event) =>
                          setArtSettings((current) => ({
                            ...current,
                            legend: { ...current.legend, fontFamily: event.target.value as ArtSettings['legend']['fontFamily'] },
                          }))
                        }
                      >
                        {LEGEND_FONT_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="stack">
                      Align
                      <select
                        value={artSettings.legend.textAlign}
                        onChange={(event) =>
                          setArtSettings((current) => ({
                            ...current,
                            legend: { ...current.legend, textAlign: event.target.value as ArtSettings['legend']['textAlign'] },
                          }))
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={artSettings.legend.boldText}
                      onChange={(event) =>
                        setArtSettings((current) => ({
                          ...current,
                          legend: { ...current.legend, boldText: event.target.checked },
                        }))
                      }
                    />
                    Bold text
                  </label>
                  <label className="stack">
                    Text size ({artSettings.legend.fontScale.toFixed(2)})
                    <input
                      type="range"
                      min={0.75}
                      max={1.5}
                      step={0.01}
                      value={artSettings.legend.fontScale}
                      onChange={(event) =>
                        setArtSettings((current) => ({
                          ...current,
                          legend: { ...current.legend, fontScale: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <div className="preview-empty">
              <h3>Ready for a sequence</h3>
              <p>Upload FASTA, paste sequence text, or fetch from UniProt/NCBI accessions to generate artwork.</p>
            </div>
          )}
        </div>

        {inputError ? <p className="error-text">{inputError}</p> : null}
        {status ? <p className="status-text">{status}</p> : null}
      </main>
    </div>
  );
}

export default App;
