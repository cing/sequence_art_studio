import type { ReactNode } from 'react';
import { AMINO_ACIDS_20 } from '../lib/aa-map';
import { DNA_SYMBOLS } from '../lib/dna-map';
import { resolveFontFamily } from '../lib/font-family';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import type { ArtSettings, Rect, SequenceType } from '../types';

interface TileEdgeCodes {
  n: number;
  e: number;
  s: number;
  w: number;
}

export interface WangTile {
  index: number;
  residue: string;
  x: number;
  y: number;
  size: number;
  baseColor: string;
  edgeCodes: TileEdgeCodes;
}

export interface WangMazeModel {
  tiles: WangTile[];
  columns: number;
  rows: number;
  edgePalette: string[];
  step: number;
  totalLength: number;
}

function orderedSymbols(sequenceType: SequenceType): readonly string[] {
  return sequenceType === 'protein' ? AMINO_ACIDS_20 : DNA_SYMBOLS;
}

function fallbackHue(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
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

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
  }

  const l = (max + min) * 0.5;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, sPercent: number, lPercent: number): { r: number; g: number; b: number } {
  const hNorm = ((h % 360) + 360) % 360;
  const s = clamp(sPercent, 0, 100) / 100;
  const l = clamp(lPercent, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hNorm / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = l - c * 0.5;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return toHexColor(rgb.r, rgb.g, rgb.b);
}

function shiftedHex(text: string, hueShift: number, lightnessShift: number): string {
  const parsed = parseHexColor(text);
  if (!parsed) {
    return text;
  }
  const base = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const h = (base.h + hueShift + 360) % 360;
  const s = clamp(base.s, 48, 82);
  const l = clamp(base.l + lightnessShift, 34, 72);
  return hslToHex(h, s, l);
}

export function getWangSymbolColor(symbol: string, sequenceType: SequenceType, settings: ArtSettings): string {
  const residue = symbol.toUpperCase();
  const symbols = orderedSymbols(sequenceType);
  const index = symbols.indexOf(residue);
  const styleColor = getStyleForSequenceSymbol(residue, sequenceType, settings).color;
  const usingCustomManualScheme =
    sequenceType === 'dna'
      ? settings.dnaSchemeId === 'dna_custom_manual'
      : settings.proteinSchemeId === 'protein_custom_manual';
  if (usingCustomManualScheme) {
    return styleColor;
  }
  const parsedRgb = parseHexColor(styleColor);
  const base = parsedRgb
    ? rgbToHsl(parsedRgb.r, parsedRgb.g, parsedRgb.b)
    : { h: fallbackHue(styleColor), s: 66, l: 52 };

  const uniqueHue = index >= 0 ? (index * 137.507764) % 360 : fallbackHue(residue);
  const hue = (base.h * 0.62 + uniqueHue * 0.38 + 360) % 360;
  const saturation = clamp(base.s * 0.82 + 10, 50, 84);
  const lightness = clamp(base.l * 0.78 + 11, 36, 68);
  return hslToHex(hue, saturation, lightness);
}

function buildEdgePalette(sequenceType: SequenceType, settings: ArtSettings): string[] {
  const symbols = orderedSymbols(sequenceType);
  const candidates = symbols.map((symbol) => getWangSymbolColor(symbol, sequenceType, settings));
  const unique = Array.from(new Set(candidates));

  if (unique.length >= 4) {
    return [
      unique[0],
      unique[Math.floor(unique.length * 0.25)],
      unique[Math.floor(unique.length * 0.5)],
      unique[Math.floor(unique.length * 0.75)],
    ];
  }

  const seed = unique[0] ?? hslToHex(sequenceType === 'protein' ? 196 : 172, 68, 54);
  const palette = [seed];
  while (palette.length < 4) {
    const shift = palette.length * 88;
    const lightnessShift = palette.length % 2 === 0 ? -8 : 8;
    palette.push(shiftedHex(seed, shift, lightnessShift));
  }
  return palette;
}

function trianglePoints(x: number, y: number, size: number, edge: keyof TileEdgeCodes): string {
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  if (edge === 'n') {
    return `${x.toFixed(3)},${y.toFixed(3)} ${(x + size).toFixed(3)},${y.toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`;
  }
  if (edge === 'e') {
    return `${(x + size).toFixed(3)},${y.toFixed(3)} ${(x + size).toFixed(3)},${(y + size).toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`;
  }
  if (edge === 's') {
    return `${x.toFixed(3)},${(y + size).toFixed(3)} ${(x + size).toFixed(3)},${(y + size).toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`;
  }
  return `${x.toFixed(3)},${y.toFixed(3)} ${x.toFixed(3)},${(y + size).toFixed(3)} ${cx.toFixed(3)},${cy.toFixed(3)}`;
}

export function buildWangMazeModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): WangMazeModel {
  const density = clamp(settings.density, 0.55, 1.6);
  const spacing = clamp(settings.spacing, 0.55, 1.7);

  const maxTiles = Math.round(1800 + density * 7000);
  const { sampled, step } = sampleSequence(sequence, maxTiles);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { tiles: [], columns: 0, rows: 0, edgePalette: [], step: 1, totalLength };
  }

  const aspect = rect.width / rect.height;
  const baseColumns = Math.sqrt(sampled.length * aspect);
  const maxColumns = Math.max(1, Math.min(220, sampled.length));
  const minColumns = Math.min(4, maxColumns);
  const desiredColumns = Math.round(baseColumns * (0.55 + density * 0.78));
  const columns = Math.max(minColumns, Math.min(maxColumns, desiredColumns));
  const rows = Math.max(1, Math.ceil(sampled.length / columns));

  const hasCell = (row: number, col: number): boolean =>
    row >= 0 && col >= 0 && row < rows && col < columns && row * columns + col < sampled.length;

  const tileSpan = Math.min(rect.width / columns, rect.height / rows);
  const gridWidth = tileSpan * columns;
  const gridHeight = tileSpan * rows;
  const originX = rect.x + (rect.width - gridWidth) * 0.5;
  const originY = rect.y + (rect.height - gridHeight) * 0.5;

  const gapRatio = clamp((spacing - 0.55) / 1.15, 0, 1) * 0.08;
  const size = tileSpan * (1 - gapRatio);
  const inset = (tileSpan - size) * 0.5;
  const edgePalette = buildEdgePalette(sequenceType, settings);
  const edgeColorCount = Math.max(2, edgePalette.length);

  const vertical = Array.from({ length: rows }, () => Array.from({ length: columns + 1 }, () => 0));
  const horizontal = Array.from({ length: rows + 1 }, () => Array.from({ length: columns }, () => 0));

  const edgeCode = (salt: string, a: number, b: number, text: string): number =>
    residueHash(a * 131 + b * 197, text, salt) % edgeColorCount;

  for (let row = 0; row < rows; row += 1) {
    if (hasCell(row, 0)) {
      const leftIndex = row * columns;
      vertical[row][0] = edgeCode('wang-v-left', leftIndex, row, sampled[leftIndex]);
    }

    for (let col = 1; col < columns; col += 1) {
      const leftExists = hasCell(row, col - 1);
      const rightExists = hasCell(row, col);
      if (leftExists && rightExists) {
        const leftIndex = row * columns + (col - 1);
        const rightIndex = row * columns + col;
        vertical[row][col] = edgeCode('wang-v-mid', leftIndex, rightIndex, `${sampled[leftIndex]}${sampled[rightIndex]}`);
      } else if (leftExists) {
        const leftIndex = row * columns + (col - 1);
        vertical[row][col] = edgeCode('wang-v-tail', leftIndex, row, sampled[leftIndex]);
      } else if (rightExists) {
        const rightIndex = row * columns + col;
        vertical[row][col] = edgeCode('wang-v-head', rightIndex, row, sampled[rightIndex]);
      }
    }

    if (hasCell(row, columns - 1)) {
      const rightIndex = row * columns + (columns - 1);
      vertical[row][columns] = edgeCode('wang-v-right', rightIndex, row, sampled[rightIndex]);
    }
  }

  for (let col = 0; col < columns; col += 1) {
    if (hasCell(0, col)) {
      horizontal[0][col] = edgeCode('wang-h-top', col, 0, sampled[col]);
    }

    for (let row = 1; row < rows; row += 1) {
      const topExists = hasCell(row - 1, col);
      const bottomExists = hasCell(row, col);
      if (topExists && bottomExists) {
        const upperIndex = (row - 1) * columns + col;
        const lowerIndex = row * columns + col;
        horizontal[row][col] = edgeCode('wang-h-mid', upperIndex, lowerIndex, `${sampled[upperIndex]}${sampled[lowerIndex]}`);
      } else if (topExists) {
        const upperIndex = (row - 1) * columns + col;
        horizontal[row][col] = edgeCode('wang-h-tail', upperIndex, row, sampled[upperIndex]);
      } else if (bottomExists) {
        const lowerIndex = row * columns + col;
        horizontal[row][col] = edgeCode('wang-h-head', lowerIndex, row, sampled[lowerIndex]);
      }
    }

    if (hasCell(rows - 1, col)) {
      const lowerIndex = (rows - 1) * columns + col;
      horizontal[rows][col] = edgeCode('wang-h-bottom', lowerIndex, col, sampled[lowerIndex]);
    }
  }

  const tiles: WangTile[] = [];

  for (let i = 0; i < sampled.length; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const residue = sampled[i];

    const x = originX + col * tileSpan + inset;
    const y = originY + row * tileSpan + inset;
    const edgeCodes: TileEdgeCodes = {
      n: horizontal[row][col],
      e: vertical[row][col + 1],
      s: horizontal[row + 1][col],
      w: vertical[row][col],
    };

    tiles.push({
      index: i * step,
      residue,
      x,
      y,
      size,
      baseColor: getWangSymbolColor(residue, sequenceType, settings),
      edgeCodes,
    });
  }

  return {
    tiles,
    columns,
    rows,
    edgePalette,
    step,
    totalLength,
  };
}

export function renderWangMaze(model: WangMazeModel, settings: ArtSettings): ReactNode[] {
  if (!model.tiles.length) {
    return [];
  }

  const palette = model.edgePalette.length > 0 ? model.edgePalette : ['#3563ff', '#f05454', '#46c86f', '#f2f2f2'];
  const showGlyphText = settings.glyphLabels.enabled;
  const labelSizeScale = clamp(settings.glyphLabels.sizeScale, 0.5, 2.2);
  const labelFont = resolveFontFamily(settings.glyphLabels.fontFamily);

  return [
    (
      <g key="wang-tiles">
        {model.tiles.map((tile) => {
          const cx = tile.x + tile.size * 0.5;
          const cy = tile.y + tile.size * 0.5;
          const nColor = palette[tile.edgeCodes.n % palette.length];
          const eColor = palette[tile.edgeCodes.e % palette.length];
          const sColor = palette[tile.edgeCodes.s % palette.length];
          const wColor = palette[tile.edgeCodes.w % palette.length];

          return (
            <g key={`wang-tile-${tile.index}`}>
              <rect
                x={tile.x}
                y={tile.y}
                width={tile.size}
                height={tile.size}
                fill={tile.baseColor}
                fillOpacity={0.28}
              />
              <polygon
                points={trianglePoints(tile.x, tile.y, tile.size, 'n')}
                fill={nColor}
                fillOpacity={0.95}
              />
              <polygon
                points={trianglePoints(tile.x, tile.y, tile.size, 'e')}
                fill={eColor}
                fillOpacity={0.95}
              />
              <polygon
                points={trianglePoints(tile.x, tile.y, tile.size, 's')}
                fill={sColor}
                fillOpacity={0.95}
              />
              <polygon
                points={trianglePoints(tile.x, tile.y, tile.size, 'w')}
                fill={wColor}
                fillOpacity={0.95}
              />
              {showGlyphText && tile.size > 8 ? (
                <text
                  x={cx}
                  y={cy + tile.size * 0.14}
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
              ) : null}
            </g>
          );
        })}
      </g>
    ),
  ];
}
