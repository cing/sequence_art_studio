import type { ReactNode } from 'react';
import { resolveFontFamily } from '../lib/font-family';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType, TruchetTileType, TruchetVariant } from '../types';

type TruchetOrientation = 'diag_tl' | 'diag_tr' | 'diag_bl' | 'diag_br' | 'arc_a' | 'arc_b' | 'rot_0' | 'rot_90' | 'rot_180' | 'rot_270' | 'line_a' | 'line_b';

const VARIANT_ORIENTATIONS: Record<TruchetVariant, TruchetOrientation[]> = {
  diagonal: ['diag_tl', 'diag_tr', 'diag_bl', 'diag_br'],
  quarter_arcs: ['arc_a', 'arc_b'],
  quarter_arc_strokes: ['arc_a', 'arc_b'],
  colored_arcs: ['rot_0', 'rot_90', 'rot_180', 'rot_270'],
  diagonal_maze: ['line_a', 'line_b'],
};

export const TILE_TYPE_LABELS: Record<TruchetTileType, string> = {
  any: 'Any',
  diag_tl: '◤ TL',
  diag_tr: '◥ TR',
  diag_bl: '◣ BL',
  diag_br: '◢ BR',
  arc_a: '↰ Arc A',
  arc_b: '↱ Arc B',
  rot_0: '0°',
  rot_90: '90°',
  rot_180: '180°',
  rot_270: '270°',
  line_a: '╲ Line A',
  line_b: '╱ Line B',
};

export function getTileTypesForVariant(variant: TruchetVariant): TruchetTileType[] {
  return ['any', ...VARIANT_ORIENTATIONS[variant]];
}

function isValidOverride(override: TruchetTileType, variant: TruchetVariant): override is TruchetOrientation {
  if (override === 'any') return false;
  return (VARIANT_ORIENTATIONS[variant] as string[]).includes(override);
}

export interface TruchetTile {
  index: number;
  residue: string;
  x: number;
  y: number;
  size: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  orientation: TruchetOrientation;
  variant: TruchetVariant;
  invert: boolean;
}

export interface TruchetModel {
  tiles: TruchetTile[];
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

/**
 * Returns triangle vertices for the 4 diagonal tile orientations.
 * The name (TL/TR/BL/BR) indicates which triangle receives the primary color.
 *
 * ╲ diagonal (TL↔BR split):
 *   diag_tl → upper-left  triangle colored,  diag_br → lower-right triangle colored
 * ╱ diagonal (TR↔BL split):
 *   diag_tr → upper-right triangle colored,  diag_bl → lower-left  triangle colored
 */
function diagonalTriangles(tile: TruchetTile): { colored: string; other: string; isBackslash: boolean } {
  const x = tile.x;
  const y = tile.y;
  const s = tile.size;

  const TL = `${x.toFixed(3)},${y.toFixed(3)}`;
  const TR = `${(x + s).toFixed(3)},${y.toFixed(3)}`;
  const BL = `${x.toFixed(3)},${(y + s).toFixed(3)}`;
  const BR = `${(x + s).toFixed(3)},${(y + s).toFixed(3)}`;

  // ╲ split tiles
  const upperLeft = `${TL} ${TR} ${BL}`;
  const lowerRight = `${TR} ${BR} ${BL}`;
  // ╱ split tiles
  const upperRight = `${TL} ${TR} ${BR}`;
  const lowerLeft = `${TL} ${BL} ${BR}`;

  switch (tile.orientation) {
    case 'diag_tl': return { colored: upperLeft, other: lowerRight, isBackslash: true };
    case 'diag_br': return { colored: lowerRight, other: upperLeft, isBackslash: true };
    case 'diag_tr': return { colored: upperRight, other: lowerLeft, isBackslash: false };
    case 'diag_bl': return { colored: lowerLeft, other: upperRight, isBackslash: false };
    default:        return { colored: upperLeft, other: lowerRight, isBackslash: true };
  }
}

export function buildTruchetModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): TruchetModel {
  const density = clamp(settings.density, 0.55, 1.6);
  const spacing = clamp(settings.spacing, 0.55, 1.7);
  const maxTiles = Math.round(2000 + density * 7600);
  const { sampled, step } = sampleSequence(sequence, maxTiles);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { tiles: [], columns: 0, rows: 0, step: 1, totalLength };
  }

  const aspect = rect.width / rect.height;
  const baseColumns = Math.sqrt(sampled.length * aspect);
  const maxColumns = Math.max(1, Math.min(240, sampled.length));
  const minColumns = Math.min(4, maxColumns);
  const desiredColumns = Math.round(baseColumns * (0.58 + density * 0.8));
  const columns = Math.max(minColumns, Math.min(maxColumns, desiredColumns));
  const rows = Math.max(1, Math.ceil(sampled.length / columns));

  const tileSpan = Math.min(rect.width / columns, rect.height / rows);
  const gridWidth = tileSpan * columns;
  const gridHeight = tileSpan * rows;
  const originX = rect.x + (rect.width - gridWidth) * 0.5;
  const originY = rect.y + (rect.height - gridHeight) * 0.5;

  const gapRatio = clamp((spacing - 0.55) / 1.15, 0, 1) * 0.1;
  const size = tileSpan * (1 - gapRatio);
  const inset = (tileSpan - size) * 0.5;

  const tiles: TruchetTile[] = [];
  const variant = settings.truchet.variant;
  const overrides = settings.truchet.tileOverrides;
  const validOrientations = VARIANT_ORIENTATIONS[variant];

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const row = Math.floor(i / columns);
    const col = i % columns;
    const hash = residueHash(i, residue, 'truchet');
    const baseColor = getStyleForSequenceSymbol(residue, sequenceType, settings).color;
    const primaryColor = baseColor;
    const secondaryColor = settings.truchet.whiteBackground
      ? '#ffffff'
      : blendHexColors(baseColor, '#ffffff', 0.72);
    const accentColor = blendHexColors(baseColor, '#0f1218', 0.32);

    const symbolOverride = overrides[residue.toUpperCase()];
    const hasOverride = symbolOverride !== undefined && isValidOverride(symbolOverride, variant);
    let orientation: TruchetOrientation;
    if (hasOverride) {
      orientation = symbolOverride;
    } else {
      orientation = validOrientations[hash % validOrientations.length];
    }

    // Only colored_arcs uses invert for variety. Diagonal encodes color in
    // orientation; quarter-arc variants need consistent stroke/leaf coloring.
    const useInvert = variant === 'colored_arcs' && !hasOverride && ((hash >>> 1) & 1) === 1;

    tiles.push({
      index: i * step,
      residue,
      x: originX + col * tileSpan + inset,
      y: originY + row * tileSpan + inset,
      size,
      primaryColor,
      secondaryColor,
      accentColor,
      orientation,
      variant,
      invert: useInvert,
    });
  }

  return {
    tiles,
    columns,
    rows,
    step,
    totalLength,
  };
}

export function renderTruchetModel(model: TruchetModel, settings: ArtSettings): ReactNode[] {
  if (!model.tiles.length) {
    return [];
  }

  const showGlyphText = settings.glyphLabels.enabled;
  const labelSizeScale = clamp(settings.glyphLabels.sizeScale, 0.5, 2.2);
  const labelFont = resolveFontFamily(settings.glyphLabels.fontFamily);

  return [
    (
      <g key="truchet-tiles">
        {model.tiles.map((tile) => {
          const glyphLabel = showGlyphText && tile.size > 8 ? (
            <text
              x={tile.x + tile.size * 0.5}
              y={tile.y + tile.size * 0.62}
              textAnchor="middle"
              fontSize={Math.max(5, tile.size * 0.34 * labelSizeScale)}
              fill={settings.glyphLabels.color}
              stroke="rgba(255, 255, 255, 0.78)"
              strokeWidth={Math.max(0.45, tile.size * 0.055 * labelSizeScale)}
              paintOrder="stroke fill"
              fontFamily={labelFont}
              pointerEvents="none"
            >
              {tile.residue.toUpperCase()}
            </text>
          ) : null;

          if (tile.variant === 'quarter_arcs') {
            return renderQuarterArcsTile(tile, glyphLabel);
          }
          if (tile.variant === 'quarter_arc_strokes') {
            return renderQuarterArcStrokesTile(tile, glyphLabel);
          }
          if (tile.variant === 'colored_arcs') {
            return renderColoredArcsTile(tile, glyphLabel);
          }
          if (tile.variant === 'diagonal_maze') {
            return renderDiagonalMazeTile(tile, glyphLabel);
          }
          return renderDiagonalTile(tile, glyphLabel);
        })}
      </g>
    ),
  ];
}

function renderDiagonalTile(tile: TruchetTile, glyphLabel: ReactNode): ReactNode {
  const tri = diagonalTriangles(tile);
  // ╲ line: (x,y) → (x+s,y+s);  ╱ line: (x+s,y) → (x,y+s)
  const lineX1 = tri.isBackslash ? tile.x : tile.x + tile.size;
  const lineY1 = tri.isBackslash ? tile.y : tile.y;
  const lineX2 = tri.isBackslash ? tile.x + tile.size : tile.x;
  const lineY2 = tile.y + tile.size;

  return (
    <g key={`truchet-${tile.index}`}>
      <polygon points={tri.colored} fill={tile.primaryColor} />
      <polygon points={tri.other} fill={tile.secondaryColor} />
      <line
        x1={lineX1}
        y1={lineY1}
        x2={lineX2}
        y2={lineY2}
        stroke={tile.accentColor}
        strokeOpacity={0.18}
        strokeWidth={Math.max(0.25, tile.size * 0.025)}
      />
      {glyphLabel}
    </g>
  );
}

function renderQuarterArcsTile(tile: TruchetTile, glyphLabel: ReactNode): ReactNode {
  const { x, y, size, primaryColor, secondaryColor } = tile;
  const r = size * 0.5;
  const sw = Math.max(1.2, size * 0.1);

  // Midpoints of each side
  const midT = { x: x + r, y };
  const midB = { x: x + r, y: y + size };
  const midL = { x, y: y + r };
  const midR = { x: x + size, y: y + r };

  let arc1: string;
  let arc2: string;
  let fill1: string;
  let fill2: string;

  if (tile.orientation === 'arc_a') {
    // Arcs from mid-top→mid-left and mid-bottom→mid-right
    // Top-left region: arc from midT to midL sweeping through the top-left corner
    fill1 = `M ${x.toFixed(3)} ${y.toFixed(3)} L ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)} Z`;
    // Bottom-right region: arc from midB to midR sweeping through the bottom-right corner
    fill2 = `M ${(x + size).toFixed(3)} ${(y + size).toFixed(3)} L ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)} Z`;
    arc1 = `M ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)}`;
    arc2 = `M ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)}`;
  } else {
    // Arcs from mid-top→mid-right and mid-bottom→mid-left
    fill1 = `M ${(x + size).toFixed(3)} ${y.toFixed(3)} L ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)} Z`;
    fill2 = `M ${x.toFixed(3)} ${(y + size).toFixed(3)} L ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)} Z`;
    arc1 = `M ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)}`;
    arc2 = `M ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)}`;
  }

  return (
    <g key={`truchet-${tile.index}`}>
      <rect x={x} y={y} width={size} height={size} fill={secondaryColor} />
      <path d={fill1} fill={primaryColor} />
      <path d={fill2} fill={primaryColor} />
      <path d={arc1} fill="none" stroke={tile.accentColor} strokeOpacity={0.22} strokeWidth={sw * 0.4} />
      <path d={arc2} fill="none" stroke={tile.accentColor} strokeOpacity={0.22} strokeWidth={sw * 0.4} />
      {glyphLabel}
    </g>
  );
}

function renderQuarterArcStrokesTile(tile: TruchetTile, glyphLabel: ReactNode): ReactNode {
  const { x, y, size, primaryColor, secondaryColor } = tile;
  const r = size * 0.5;
  const sw = Math.max(2, size * 0.18);

  const midT = { x: x + r, y };
  const midB = { x: x + r, y: y + size };
  const midL = { x, y: y + r };
  const midR = { x: x + size, y: y + r };

  let arc1: string;
  let arc2: string;

  if (tile.orientation === 'arc_a') {
    arc1 = `M ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)}`;
    arc2 = `M ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)}`;
  } else {
    arc1 = `M ${midT.x.toFixed(3)} ${midT.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midR.x.toFixed(3)} ${midR.y.toFixed(3)}`;
    arc2 = `M ${midB.x.toFixed(3)} ${midB.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${midL.x.toFixed(3)} ${midL.y.toFixed(3)}`;
  }

  return (
    <g key={`truchet-${tile.index}`}>
      <rect x={x} y={y} width={size} height={size} fill={secondaryColor} />
      <path d={arc1} fill="none" stroke={primaryColor} strokeWidth={sw} strokeLinecap="butt" />
      <path d={arc2} fill="none" stroke={primaryColor} strokeWidth={sw} strokeLinecap="butt" />
      {glyphLabel}
    </g>
  );
}

function renderColoredArcsTile(tile: TruchetTile, glyphLabel: ReactNode): ReactNode {
  const { x, y, size, primaryColor, secondaryColor } = tile;
  const r = size * 0.5;

  const bgColor = tile.invert ? primaryColor : secondaryColor;
  const fgColor = tile.invert ? secondaryColor : primaryColor;

  // Two filled quarter-circle wedges at opposite corners, rotated by orientation
  let wedge1: string;
  let wedge2: string;

  if (tile.orientation === 'rot_0') {
    // Wedges at top-left and bottom-right
    wedge1 = `M ${x.toFixed(3)} ${y.toFixed(3)} L ${(x + r).toFixed(3)} ${y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${x.toFixed(3)} ${(y + r).toFixed(3)} Z`;
    wedge2 = `M ${(x + size).toFixed(3)} ${(y + size).toFixed(3)} L ${(x + r).toFixed(3)} ${(y + size).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + size).toFixed(3)} ${(y + r).toFixed(3)} Z`;
  } else if (tile.orientation === 'rot_90') {
    // Wedges at top-right and bottom-left
    wedge1 = `M ${(x + size).toFixed(3)} ${y.toFixed(3)} L ${(x + size).toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + r).toFixed(3)} ${y.toFixed(3)} Z`;
    wedge2 = `M ${x.toFixed(3)} ${(y + size).toFixed(3)} L ${x.toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + r).toFixed(3)} ${(y + size).toFixed(3)} Z`;
  } else if (tile.orientation === 'rot_180') {
    // Wedges at bottom-right and top-left (reversed arc direction from rot_0)
    wedge1 = `M ${(x + size).toFixed(3)} ${(y + size).toFixed(3)} L ${(x + size).toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${(x + r).toFixed(3)} ${(y + size).toFixed(3)} Z`;
    wedge2 = `M ${x.toFixed(3)} ${y.toFixed(3)} L ${x.toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${(x + r).toFixed(3)} ${y.toFixed(3)} Z`;
  } else {
    // rot_270: Wedges at bottom-left and top-right
    wedge1 = `M ${x.toFixed(3)} ${(y + size).toFixed(3)} L ${(x + r).toFixed(3)} ${(y + size).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${x.toFixed(3)} ${(y + r).toFixed(3)} Z`;
    wedge2 = `M ${(x + size).toFixed(3)} ${y.toFixed(3)} L ${(x + r).toFixed(3)} ${y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${(x + size).toFixed(3)} ${(y + r).toFixed(3)} Z`;
  }

  return (
    <g key={`truchet-${tile.index}`}>
      <rect x={x} y={y} width={size} height={size} fill={bgColor} />
      <path d={wedge1} fill={fgColor} />
      <path d={wedge2} fill={fgColor} />
      {glyphLabel}
    </g>
  );
}

function renderDiagonalMazeTile(tile: TruchetTile, glyphLabel: ReactNode): ReactNode {
  const { x, y, size, primaryColor, secondaryColor } = tile;
  const sw = Math.max(1.5, size * 0.18);

  // line_a = ╲ backslash: top-left to bottom-right
  // line_b = ╱ forward slash: top-right to bottom-left
  const isBackslash = tile.orientation === 'line_a';
  const x1 = isBackslash ? x : x + size;
  const y1 = y;
  const x2 = isBackslash ? x + size : x;
  const y2 = y + size;

  return (
    <g key={`truchet-${tile.index}`}>
      <rect x={x} y={y} width={size} height={size} fill={secondaryColor} />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={primaryColor}
        strokeWidth={sw}
        strokeLinecap="butt"
      />
      {glyphLabel}
    </g>
  );
}
