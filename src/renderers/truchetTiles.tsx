import type { ReactNode } from 'react';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType } from '../types';

type TruchetOrientation = 'diag_tl_br' | 'diag_tr_bl';

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

function trianglePoints(tile: TruchetTile): { first: string; second: string } {
  const x = tile.x;
  const y = tile.y;
  const s = tile.size;
  if (tile.orientation === 'diag_tl_br') {
    return {
      first: `${x.toFixed(3)},${y.toFixed(3)} ${(x + s).toFixed(3)},${y.toFixed(3)} ${x.toFixed(3)},${(y + s).toFixed(3)}`,
      second: `${(x + s).toFixed(3)},${y.toFixed(3)} ${(x + s).toFixed(3)},${(y + s).toFixed(3)} ${x.toFixed(3)},${(y + s).toFixed(3)}`,
    };
  }
  return {
    first: `${x.toFixed(3)},${y.toFixed(3)} ${(x + s).toFixed(3)},${y.toFixed(3)} ${(x + s).toFixed(3)},${(y + s).toFixed(3)}`,
    second: `${x.toFixed(3)},${y.toFixed(3)} ${x.toFixed(3)},${(y + s).toFixed(3)} ${(x + s).toFixed(3)},${(y + s).toFixed(3)}`,
  };
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

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const row = Math.floor(i / columns);
    const col = i % columns;
    const hash = residueHash(i, residue, 'truchet');
    const baseColor = getStyleForSequenceSymbol(residue, sequenceType, settings).color;
    const primaryColor = baseColor;
    const secondaryColor = blendHexColors(baseColor, '#ffffff', 0.72);
    const accentColor = blendHexColors(baseColor, '#0f1218', 0.32);

    tiles.push({
      index: i * step,
      residue,
      x: originX + col * tileSpan + inset,
      y: originY + row * tileSpan + inset,
      size,
      primaryColor,
      secondaryColor,
      accentColor,
      orientation: (hash & 1) === 0 ? 'diag_tl_br' : 'diag_tr_bl',
      invert: ((hash >>> 1) & 1) === 1,
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

export function renderTruchetModel(model: TruchetModel): ReactNode[] {
  if (!model.tiles.length) {
    return [];
  }

  return [
    (
      <g key="truchet-tiles">
        {model.tiles.map((tile) => {
          const points = trianglePoints(tile);
          const firstColor = tile.invert ? tile.secondaryColor : tile.primaryColor;
          const secondColor = tile.invert ? tile.primaryColor : tile.secondaryColor;
          const lineStartX = tile.orientation === 'diag_tl_br' ? tile.x : tile.x + tile.size;
          const lineStartY = tile.y;
          const lineEndX = tile.orientation === 'diag_tl_br' ? tile.x + tile.size : tile.x;
          const lineEndY = tile.y + tile.size;

          return (
            <g key={`truchet-${tile.index}`}>
              <polygon points={points.first} fill={firstColor} />
              <polygon points={points.second} fill={secondColor} />
              <line
                x1={lineStartX}
                y1={lineStartY}
                x2={lineEndX}
                y2={lineEndY}
                stroke={tile.accentColor}
                strokeOpacity={0.18}
                strokeWidth={Math.max(0.25, tile.size * 0.025)}
              />
            </g>
          );
        })}
      </g>
    ),
  ];
}
