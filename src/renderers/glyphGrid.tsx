import type { ReactNode } from 'react';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType, ShapeKind } from '../types';

export interface GlyphCell {
  index: number;
  residue: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  shape: ShapeKind;
  glyph: string;
}

export interface GlyphGridModel {
  cells: GlyphCell[];
  columns: number;
  rows: number;
  step: number;
  totalLength: number;
}

export function buildGlyphGridModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): GlyphGridModel {
  const density = clamp(settings.density, 0.55, 1.6);
  const spacing = clamp(settings.spacing, 0.55, 1.7);

  const maxCells = Math.round((1400 + density * 7600) * (1.15 - (spacing - 1) * 0.24));
  const { sampled, step } = sampleSequence(sequence, maxCells);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { cells: [], columns: 0, rows: 0, step: 1, totalLength };
  }

  const aspect = rect.width / rect.height;
  const baseColumns = Math.sqrt(sampled.length * aspect);
  const columns = Math.max(1, Math.floor(baseColumns * (0.56 + density * 0.72)));
  const rows = Math.ceil(sampled.length / columns);

  const slotW = rect.width / columns;
  const slotH = rect.height / rows;
  const slot = Math.min(slotW, slotH);

  // spacing = 1 keeps balanced occupancy, higher values open visible gaps.
  const occupancy = clamp(1.08 - (spacing - 0.6) * 0.56, 0.28, 1.12);
  const jitterScale = clamp((1.28 - spacing) * 0.16, 0.01, 0.14);

  const cells: GlyphCell[] = [];

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const style = getStyleForSequenceSymbol(residue, sequenceType, settings);

    const row = Math.floor(i / columns);
    const col = i % columns;

    const hash = residueHash(i, residue, 'grid');
    const sizeFactor = 0.52 + ((hash >>> 9) % 200) / 500;
    const jitterX = ((((hash >>> 18) % 1000) / 1000) - 0.5) * slotW * jitterScale;
    const jitterY = ((((hash >>> 5) % 1000) / 1000) - 0.5) * slotH * jitterScale;

    const x = rect.x + col * slotW + slotW * 0.5 + jitterX;
    const y = rect.y + row * slotH + slotH * 0.5 + jitterY;

    const size = clamp(slot * sizeFactor * occupancy * (0.72 + settings.scale * 0.52), 2, slot * 1.04);
    const rotation = hash % 360;

    cells.push({
      index: i * step,
      residue,
      x,
      y,
      size,
      rotation,
      color: style.color,
      shape: style.shape,
      glyph: style.glyph || residue.toUpperCase(),
    });
  }

  return {
    cells,
    columns,
    rows,
    step,
    totalLength,
  };
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

function renderShape(cell: GlyphCell): ReactNode {
  const common = {
    fill: cell.shape === 'ring' ? 'none' : cell.color,
    stroke: cell.shape === 'ring' ? cell.color : 'rgba(8, 15, 20, 0.18)',
    strokeWidth: cell.shape === 'ring' ? Math.max(1, cell.size * 0.18) : Math.max(0.45, cell.size * 0.07),
  };

  if (cell.shape === 'circle') {
    return <circle cx={cell.x} cy={cell.y} r={cell.size * 0.5} {...common} />;
  }

  if (cell.shape === 'square') {
    return (
      <rect
        x={cell.x - cell.size * 0.5}
        y={cell.y - cell.size * 0.5}
        width={cell.size}
        height={cell.size}
        transform={`rotate(${cell.rotation} ${cell.x} ${cell.y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'triangle') {
    return (
      <polygon
        points={polygonPoints(cell.x, cell.y, cell.size * 0.58, 3, -Math.PI / 2)}
        transform={`rotate(${cell.rotation} ${cell.x} ${cell.y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'diamond') {
    return (
      <polygon
        points={polygonPoints(cell.x, cell.y, cell.size * 0.55, 4, Math.PI / 4)}
        transform={`rotate(${cell.rotation} ${cell.x} ${cell.y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'hex') {
    return (
      <polygon
        points={polygonPoints(cell.x, cell.y, cell.size * 0.54, 6, Math.PI / 6)}
        transform={`rotate(${cell.rotation} ${cell.x} ${cell.y})`}
        {...common}
      />
    );
  }

  return <circle cx={cell.x} cy={cell.y} r={cell.size * 0.42} {...common} />;
}

export function renderGlyphGrid(model: GlyphGridModel): ReactNode[] {
  const showGlyphText = model.cells.length < 3200;

  return model.cells.map((cell) => {
    const groupKey = `glyph-cell-${cell.index}-${cell.x.toFixed(2)}-${cell.y.toFixed(2)}`;
    return (
      <g key={groupKey} opacity={0.92}>
        {renderShape(cell)}
        {showGlyphText && cell.size > 11 ? (
          <text
            x={cell.x}
            y={cell.y + cell.size * 0.16}
            textAnchor="middle"
            fontSize={Math.max(6, cell.size * 0.35)}
            fill="rgba(12, 12, 16, 0.55)"
            fontFamily="'IBM Plex Mono', 'JetBrains Mono', monospace"
            pointerEvents="none"
          >
            {cell.glyph}
          </text>
        ) : null}
      </g>
    );
  });
}
