import type { ReactNode } from 'react';
import { resolveFontFamily } from '../lib/font-family';
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
    const jit = settings.jitter;
    const rawSizeFactor = 0.52 + ((hash >>> 9) % 200) / 500;
    const sizeFactor = 1 - jit * (1 - rawSizeFactor);
    const jitterX = ((((hash >>> 18) % 1000) / 1000) - 0.5) * slotW * jitterScale * jit;
    const jitterY = ((((hash >>> 5) % 1000) / 1000) - 0.5) * slotH * jitterScale * jit;

    const x = rect.x + col * slotW + slotW * 0.5 + jitterX;
    const y = rect.y + row * slotH + slotH * 0.5 + jitterY;

    const size = clamp(slot * sizeFactor * occupancy * (0.72 + settings.scale * 0.52), 2, slot * 1.04);
    const rotation = (hash % 360) * jit;

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

interface ShapeLayer {
  dx: number;
  dy: number;
  sizeScale: number;
  rotateJitter: number;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidthScale: number;
}

function renderShapeLayer(cell: GlyphCell, layer: ShapeLayer, key: string): ReactNode {
  const x = cell.x + layer.dx;
  const y = cell.y + layer.dy;
  const size = cell.size * layer.sizeScale;
  const rotation = cell.rotation + layer.rotateJitter;

  const common = {
    fill: cell.shape === 'ring' ? 'none' : cell.color,
    fillOpacity: cell.shape === 'ring' ? undefined : layer.fillOpacity,
    stroke: cell.shape === 'ring' ? cell.color : 'rgba(8, 15, 20, 0.2)',
    strokeOpacity: layer.strokeOpacity,
    strokeWidth: cell.shape === 'ring'
      ? Math.max(1, size * 0.2 * layer.strokeWidthScale)
      : Math.max(0.5, size * 0.08 * layer.strokeWidthScale),
  };

  if (cell.shape === 'circle') {
    return <circle key={key} cx={x} cy={y} r={size * 0.5} {...common} />;
  }

  if (cell.shape === 'square') {
    return (
      <rect
        key={key}
        x={x - size * 0.5}
        y={y - size * 0.5}
        width={size}
        height={size}
        transform={`rotate(${rotation} ${x} ${y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'triangle') {
    return (
      <polygon
        key={key}
        points={polygonPoints(x, y, size * 0.58, 3, -Math.PI / 2)}
        transform={`rotate(${rotation} ${x} ${y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'diamond') {
    return (
      <polygon
        key={key}
        points={polygonPoints(x, y, size * 0.55, 4, Math.PI / 4)}
        transform={`rotate(${rotation} ${x} ${y})`}
        {...common}
      />
    );
  }

  if (cell.shape === 'hex') {
    return (
      <polygon
        key={key}
        points={polygonPoints(x, y, size * 0.54, 6, Math.PI / 6)}
        transform={`rotate(${rotation} ${x} ${y})`}
        {...common}
      />
    );
  }

  return <circle key={key} cx={x} cy={y} r={size * 0.42} {...common} />;
}

function paintLayers(cell: GlyphCell, jit: number): ShapeLayer[] {
  const hash = residueHash(cell.index, cell.residue, 'paint-layers');
  const jitterX = ((((hash >>> 6) % 1000) / 1000) - 0.5) * cell.size * 0.14 * jit;
  const jitterY = ((((hash >>> 17) % 1000) / 1000) - 0.5) * cell.size * 0.14 * jit;
  const angleJitter = (((hash >>> 10) % 1000) / 1000 - 0.5) * 8 * jit;

  return [
    {
      dx: 0,
      dy: 0,
      sizeScale: 1,
      rotateJitter: 0,
      fillOpacity: 0.92,
      strokeOpacity: 0.2,
      strokeWidthScale: 1,
    },
    {
      dx: jitterX,
      dy: jitterY,
      sizeScale: 0.95,
      rotateJitter: angleJitter,
      fillOpacity: 0.42,
      strokeOpacity: 0.12,
      strokeWidthScale: 0.86,
    },
    {
      dx: -jitterX * 0.72,
      dy: -jitterY * 0.72,
      sizeScale: 0.9,
      rotateJitter: -angleJitter * 0.7,
      fillOpacity: 0.26,
      strokeOpacity: 0.1,
      strokeWidthScale: 0.8,
    },
  ];
}

export function renderGlyphGrid(model: GlyphGridModel, settings: ArtSettings, uid: string): ReactNode[] {
  const showGlyphText = settings.glyphLabels.enabled;
  const labelSizeScale = clamp(settings.glyphLabels.sizeScale, 0.5, 2.2);
  const labelFont = resolveFontFamily(settings.glyphLabels.fontFamily);
  const brushFilterId = `${uid}-glyph-brush`;

  return [
    (
      <defs key="glyph-grid-defs">
        <filter id={brushFilterId} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="1" seed="7" result="brushNoise" />
          <feDisplacementMap in="SourceGraphic" in2="brushNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    ),
    ...model.cells.map((cell) => {
      const groupKey = `glyph-cell-${cell.index}-${cell.x.toFixed(2)}-${cell.y.toFixed(2)}`;
      const layers = paintLayers(cell, settings.jitter);
      return (
        <g key={groupKey} opacity={0.94}>
          <g filter={`url(#${brushFilterId})`}>
            {layers.map((layer, index) => renderShapeLayer(cell, layer, `${groupKey}-layer-${index}`))}
          </g>
          {showGlyphText && cell.size > 7 ? (
            <text
              x={cell.x}
              y={cell.y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={Math.max(5, cell.size * 0.35 * labelSizeScale)}
              fill={settings.glyphLabels.color}
              stroke="rgba(255, 255, 255, 0.74)"
              strokeWidth={Math.max(0.6, cell.size * 0.06 * labelSizeScale)}
              paintOrder="stroke fill"
              fontFamily={labelFont}
              pointerEvents="none"
            >
              {cell.glyph}
            </text>
          ) : null}
        </g>
      );
    }),
  ];
}
