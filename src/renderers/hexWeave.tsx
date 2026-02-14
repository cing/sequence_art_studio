import type { ReactNode } from 'react';
import { resolveFontFamily } from '../lib/font-family';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType } from '../types';

export interface HexWeaveCell {
  index: number;
  residue: string;
  cx: number;
  cy: number;
  radius: number;
  fillColor: string;
  highlightColor: string;
  shadowColor: string;
  outlineColor: string;
  textureColor: string;
  gradientAngle: number;
  textureAngle: number;
  textureLength: number;
  textureOpacity: number;
  opacity: number;
}

export interface HexWeaveModel {
  cells: HexWeaveCell[];
  columns: number;
  rows: number;
  step: number;
  totalLength: number;
}

function parseHexColor(text: string): { r: number; g: number; b: number } | null {
  const value = text.trim().toLowerCase();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return {
      r: parseInt(`${hex[0]}${hex[0]}`, 16),
      g: parseInt(`${hex[1]}${hex[1]}`, 16),
      b: parseInt(`${hex[2]}${hex[2]}`, 16),
    };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function toHexColor(r: number, g: number, b: number): string {
  const rc = Math.round(clamp(r, 0, 255)).toString(16).padStart(2, '0');
  const gc = Math.round(clamp(g, 0, 255)).toString(16).padStart(2, '0');
  const bc = Math.round(clamp(b, 0, 255)).toString(16).padStart(2, '0');
  return `#${rc}${gc}${bc}`;
}

function blendHexColors(base: string, target: string, ratio: number): string {
  const baseRgb = parseHexColor(base);
  const targetRgb = parseHexColor(target);
  if (!baseRgb || !targetRgb) {
    return base;
  }
  const mix = clamp(ratio, 0, 1);
  return toHexColor(
    baseRgb.r * (1 - mix) + targetRgb.r * mix,
    baseRgb.g * (1 - mix) + targetRgb.g * mix,
    baseRgb.b * (1 - mix) + targetRgb.b * mix,
  );
}

function colorLuma(color: string): number {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return 0.5;
  }
  return (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
}

function hexPoints(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI / 3) * i;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${x.toFixed(3)},${y.toFixed(3)}`);
  }
  return points.join(' ');
}

function textureSegments(cell: HexWeaveCell): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  opacity: number;
}> {
  const angle = (cell.textureAngle * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const normalX = -dirY;
  const normalY = dirX;
  const half = cell.radius * cell.textureLength;
  const offsets = [-0.34, -0.14, 0.08, 0.28];

  return offsets.map((factor, index) => {
    const offset = factor * cell.radius;
    const cx = cell.cx + normalX * offset;
    const cy = cell.cy + normalY * offset;
    return {
      x1: cx - dirX * half,
      y1: cy - dirY * half,
      x2: cx + dirX * half,
      y2: cy + dirY * half,
      width: Math.max(0.26, cell.radius * (0.08 - index * 0.011)),
      opacity: cell.textureOpacity * (1 - index * 0.18),
    };
  });
}

export function buildHexWeaveModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): HexWeaveModel {
  const density = clamp(settings.density, 0.55, 1.6);
  const spacing = clamp(settings.spacing, 0.55, 1.7);
  const maxCells = Math.round((2200 + density * 7600) * (1.1 - (spacing - 1) * 0.08));
  const { sampled, step } = sampleSequence(sequence, maxCells);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { cells: [], columns: 0, rows: 0, step: 1, totalLength };
  }

  const aspect = rect.width / rect.height;
  const baseColumns = Math.sqrt(sampled.length * aspect * 0.92);
  const maxColumns = Math.max(1, Math.min(260, sampled.length));
  const minColumns = Math.min(4, maxColumns);
  const desiredColumns = Math.round(baseColumns * (0.6 + density * 0.72));
  const columns = Math.max(minColumns, Math.min(maxColumns, desiredColumns));
  const rows = Math.max(1, Math.ceil(sampled.length / columns));

  const sqrt3 = Math.sqrt(3);
  const radiusFromWidth = rect.width / (2 + sqrt3 * (columns - 1 + (rows > 1 ? 0.5 : 0)));
  const radiusFromHeight = rect.height / (2 + 1.5 * Math.max(0, rows - 1));
  const baseRadius = Math.max(1.2, Math.min(radiusFromWidth, radiusFromHeight));
  const hStep = sqrt3 * baseRadius;
  const vStep = 1.5 * baseRadius;

  const gridWidth = 2 * baseRadius + (columns - 1) * hStep + (rows > 1 ? hStep * 0.5 : 0);
  const gridHeight = 2 * baseRadius + (rows - 1) * vStep;
  const originX = rect.x + (rect.width - gridWidth) * 0.5;
  const originY = rect.y + (rect.height - gridHeight) * 0.5;

  const gapRatio = clamp((spacing - 0.55) / 1.15, 0, 1) * 0.34;
  const scaleFactor = clamp(0.82 + settings.scale * 0.24, 0.64, 1.08);
  const radius = Math.max(1, baseRadius * scaleFactor * (1 - gapRatio));

  const cells: HexWeaveCell[] = [];

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const row = Math.floor(i / columns);
    const rowOffset = i % columns;
    const col = row % 2 === 0 ? rowOffset : columns - 1 - rowOffset;
    const shiftX = row % 2 === 1 ? hStep * 0.5 : 0;
    const cx = originX + baseRadius + col * hStep + shiftX;
    const cy = originY + baseRadius + row * vStep;

    const hash = residueHash(i, residue, 'hex-weave');
    const baseColor = getStyleForSequenceSymbol(residue, sequenceType, settings).color;
    const luma = colorLuma(baseColor);
    const fillColor = blendHexColors(baseColor, '#ffffff', 0.18);
    const highlightColor = blendHexColors(fillColor, '#ffffff', 0.26 + ((hash >>> 10) % 20) / 200);
    const shadowColor = blendHexColors(fillColor, '#0f1722', 0.17 + ((hash >>> 14) % 24) / 260);
    const outlineColor = luma > 0.56 ? blendHexColors(fillColor, '#0f1720', 0.42) : blendHexColors(fillColor, '#ffffff', 0.34);
    const textureColor = luma > 0.56 ? blendHexColors(fillColor, '#0b1018', 0.5) : blendHexColors(fillColor, '#ffffff', 0.56);

    cells.push({
      index: i * step,
      residue,
      cx,
      cy,
      radius,
      fillColor,
      highlightColor,
      shadowColor,
      outlineColor,
      textureColor,
      gradientAngle: (hash % 180) + (((hash >>> 7) % 3) * 12 - 12),
      textureAngle: ((hash % 180) + (((hash >>> 6) & 1) === 0 ? 28 : -32) + 360) % 360,
      textureLength: clamp(0.5 + ((hash >>> 9) % 40) / 200, 0.5, 0.72),
      textureOpacity: clamp(0.1 + ((hash >>> 3) % 80) / 720, 0.1, 0.22),
      opacity: clamp(0.9 + ((hash >>> 4) % 80) / 600, 0.9, 0.99),
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

export function renderHexWeaveModel(model: HexWeaveModel, settings: ArtSettings): ReactNode[] {
  if (!model.cells.length) {
    return [];
  }

  const textureFilterId = 'hex-weave-texture-filter';
  const showGlyphText = settings.glyphLabels.enabled;
  const labelSizeScale = clamp(settings.glyphLabels.sizeScale, 0.5, 2.2);
  const labelFont = resolveFontFamily(settings.glyphLabels.fontFamily);

  return [
    (
      <defs key="hex-weave-defs">
        <filter id={textureFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="1" seed="19" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.72" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {model.cells.map((cell) => {
          const angle = (cell.gradientAngle * Math.PI) / 180;
          const dx = Math.cos(angle) * cell.radius;
          const dy = Math.sin(angle) * cell.radius;
          const gradientId = `hex-weave-gradient-${cell.index}`;
          return (
            <linearGradient
              key={gradientId}
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={(cell.cx - dx).toFixed(3)}
              y1={(cell.cy - dy).toFixed(3)}
              x2={(cell.cx + dx).toFixed(3)}
              y2={(cell.cy + dy).toFixed(3)}
            >
              <stop offset="0%" stopColor={cell.highlightColor} />
              <stop offset="58%" stopColor={cell.fillColor} />
              <stop offset="100%" stopColor={cell.shadowColor} />
            </linearGradient>
          );
        })}
      </defs>
    ),
    (
      <g key="hex-weave">
        {model.cells.map((cell) => {
          const segments = textureSegments(cell);
          const gradientId = `hex-weave-gradient-${cell.index}`;
          const points = hexPoints(cell.cx, cell.cy, cell.radius);
          return (
            <g key={`hex-cell-${cell.index}`}>
              <polygon
                points={points}
                fill={`url(#${gradientId})`}
                fillOpacity={cell.opacity}
                stroke={cell.outlineColor}
                strokeOpacity={0.34}
                strokeWidth={Math.max(0.18, cell.radius * 0.08)}
              />
              <g filter={`url(#${textureFilterId})`}>
                {segments.map((segment, segmentIndex) => (
                  <line
                    key={`hex-texture-${cell.index}-${segmentIndex}`}
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    stroke={cell.textureColor}
                    strokeOpacity={segment.opacity}
                    strokeLinecap="round"
                    strokeWidth={segment.width}
                  />
                ))}
              </g>
              {showGlyphText && cell.radius > 7 ? (
                <text
                  x={cell.cx}
                  y={cell.cy + cell.radius * 0.22}
                  textAnchor="middle"
                  fontSize={Math.max(5, cell.radius * 0.62 * labelSizeScale)}
                  fill={settings.glyphLabels.color}
                  stroke="rgba(255, 255, 255, 0.82)"
                  strokeWidth={Math.max(0.4, cell.radius * 0.11 * labelSizeScale)}
                  paintOrder="stroke fill"
                  fontFamily={labelFont}
                  pointerEvents="none"
                >
                  {cell.residue.toUpperCase()}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    ),
  ];
}
