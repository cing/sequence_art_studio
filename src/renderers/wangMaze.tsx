import type { ReactNode } from 'react';
import { AMINO_ACIDS_20 } from '../lib/aa-map';
import { DNA_SYMBOLS } from '../lib/dna-map';
import { resolveFontFamily } from '../lib/font-family';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import type { ArtSettings, Rect, SequenceType, WangVariant } from '../types';

interface TileEdgeCodes {
  n: number;
  e: number;
  s: number;
  w: number;
}

interface TileCornerStates {
  nw: number;
  ne: number;
  se: number;
  sw: number;
}

export interface WangTile {
  index: number;
  residue: string;
  x: number;
  y: number;
  size: number;
  symbolState: number;
  primaryState: number;
  secondaryState: number;
  cornerMaskId: number;
  edgeCodes: TileEdgeCodes;
  corners: TileCornerStates;
}

export interface WangMazeModel {
  tiles: WangTile[];
  columns: number;
  rows: number;
  terrainStates: string[];
  variant: WangVariant;
  step: number;
  totalLength: number;
}

export interface WangLegendSwatch {
  maskId: number;
  primaryState: number;
  secondaryState: number;
}

type UnitPoint = readonly [number, number];

const UNIT = {
  nw: [0, 0] as UnitPoint,
  n: [0.5, 0] as UnitPoint,
  ne: [1, 0] as UnitPoint,
  e: [1, 0.5] as UnitPoint,
  se: [1, 1] as UnitPoint,
  s: [0.5, 1] as UnitPoint,
  sw: [0, 1] as UnitPoint,
  w: [0, 0.5] as UnitPoint,
};

const S_V2_MASK_POLYGONS: Record<number, UnitPoint[][]> = {
  0: [],
  1: [[UNIT.w, UNIT.sw, UNIT.s]],
  2: [[UNIT.s, UNIT.se, UNIT.e]],
  3: [[UNIT.w, UNIT.sw, UNIT.se, UNIT.e]],
  4: [[UNIT.n, UNIT.ne, UNIT.e]],
  5: [[UNIT.n, UNIT.ne, UNIT.e], [UNIT.w, UNIT.sw, UNIT.s]],
  6: [[UNIT.n, UNIT.ne, UNIT.se, UNIT.s]],
  7: [[UNIT.n, UNIT.ne, UNIT.se, UNIT.sw, UNIT.w]],
  8: [[UNIT.w, UNIT.n, UNIT.nw]],
  9: [[UNIT.n, UNIT.nw, UNIT.sw, UNIT.s]],
  10: [[UNIT.w, UNIT.n, UNIT.nw], [UNIT.s, UNIT.se, UNIT.e]],
  11: [[UNIT.n, UNIT.nw, UNIT.sw, UNIT.se, UNIT.e]],
  12: [[UNIT.w, UNIT.nw, UNIT.ne, UNIT.e]],
  13: [[UNIT.w, UNIT.nw, UNIT.ne, UNIT.e, UNIT.s, UNIT.sw]],
  14: [[UNIT.w, UNIT.nw, UNIT.ne, UNIT.se, UNIT.s]],
  15: [[UNIT.nw, UNIT.ne, UNIT.se, UNIT.sw]],
};

function orderedSymbols(sequenceType: SequenceType): readonly string[] {
  return sequenceType === 'protein' ? AMINO_ACIDS_20 : DNA_SYMBOLS;
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

function rgbDistanceSquared(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
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

function normalizeColor(color: string): string {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return color.trim();
  }
  return toHexColor(parsed.r, parsed.g, parsed.b);
}

function shiftedColor(color: string, hueShift: number, lightnessShift: number): string {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return color;
  }
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const rgb = hslToRgb(hsl.h + hueShift, hsl.s, clamp(hsl.l + lightnessShift, 22, 82));
  return toHexColor(rgb.r, rgb.g, rgb.b);
}

function resolveWangVariant(settings: ArtSettings): WangVariant {
  return settings.wang?.variant ?? 'corner_sv2';
}

function resolveTerrainCap(settings: ArtSettings): number {
  return clamp(Math.round(settings.wang?.terrainCap ?? 6), 2, 12);
}

export function getWangSymbolColor(symbol: string, sequenceType: SequenceType, settings: ArtSettings): string {
  const styleColor = getStyleForSequenceSymbol(symbol.toUpperCase(), sequenceType, settings).color;
  return normalizeColor(styleColor);
}

export function resolveWangTerrainStates(
  sequenceType: SequenceType,
  settings: ArtSettings,
  symbols?: readonly string[],
): string[] {
  const sourceSymbols = symbols && symbols.length > 0
    ? symbols.map((symbol) => symbol.toUpperCase())
    : [...orderedSymbols(sequenceType)];

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const symbol of sourceSymbols) {
    const color = getWangSymbolColor(symbol, sequenceType, settings);
    const key = color.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(color);
  }

  const cap = resolveTerrainCap(settings);
  let states = unique.slice(0, cap);

  if (!states.length) {
    states = ['#4472c4'];
  }

  while (states.length < 2) {
    states.push(shiftedColor(states[0], 168, 10));
  }

  return states;
}

function nearestTerrainIndex(color: string, terrainStates: string[], fallbackSeed: string): number {
  if (terrainStates.length <= 1) {
    return 0;
  }

  const normalized = normalizeColor(color).toLowerCase();
  const exact = terrainStates.findIndex((state) => state.toLowerCase() === normalized);
  if (exact >= 0) {
    return exact;
  }

  const sourceRgb = parseHexColor(normalized);
  if (sourceRgb) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    terrainStates.forEach((state, index) => {
      const targetRgb = parseHexColor(state);
      if (!targetRgb) {
        return;
      }
      const distance = rgbDistanceSquared(sourceRgb, targetRgb);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (Number.isFinite(nearestDistance)) {
      return nearestIndex;
    }
  }

  return residueHash(0, fallbackSeed, 'wang-state-fallback') % terrainStates.length;
}

export function resolveWangStateIndex(
  symbol: string,
  sequenceType: SequenceType,
  settings: ArtSettings,
  terrainStates: string[],
  cache?: Map<string, number>,
): number {
  const residue = symbol.toUpperCase();
  if (cache) {
    const cached = cache.get(residue);
    if (cached !== undefined) {
      return cached;
    }
  }

  const state = nearestTerrainIndex(
    getWangSymbolColor(residue, sequenceType, settings),
    terrainStates,
    residue,
  );
  cache?.set(residue, state);
  return state;
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

function pointList(points: readonly UnitPoint[], x: number, y: number, size: number): string {
  return points
    .map(([px, py]) => `${(x + px * size).toFixed(3)},${(y + py * size).toFixed(3)}`)
    .join(' ');
}

function pickSecondaryState(
  primaryState: number,
  corners: TileCornerStates,
  terrainCount: number,
  index: number,
  residue: string,
): number {
  const counts = new Map<number, number>();
  [corners.nw, corners.ne, corners.se, corners.sw]
    .filter((state) => state !== primaryState)
    .forEach((state) => counts.set(state, (counts.get(state) ?? 0) + 1));

  if (counts.size > 0) {
    const maxCount = Math.max(...counts.values());
    const candidates = Array.from(counts.entries())
      .filter(([, count]) => count === maxCount)
      .map(([state]) => state)
      .sort((a, b) => a - b);

    const tieHash = residueHash(index, residue, 'wang-secondary');
    return candidates[tieHash % candidates.length];
  }

  if (terrainCount <= 1) {
    return primaryState;
  }

  const offset = 1 + (residueHash(index, residue, 'wang-secondary-fallback') % (terrainCount - 1));
  return (primaryState + offset) % terrainCount;
}

function cornerMaskForPrimary(primaryState: number, corners: TileCornerStates, index: number, residue: string): number {
  let mask = 0;
  if (corners.nw === primaryState) {
    mask |= 8;
  }
  if (corners.ne === primaryState) {
    mask |= 4;
  }
  if (corners.se === primaryState) {
    mask |= 2;
  }
  if (corners.sw === primaryState) {
    mask |= 1;
  }

  if (mask === 0) {
    const cornerBits = [8, 4, 2, 1];
    const choice = residueHash(index, residue, 'wang-mask-force') % cornerBits.length;
    mask = cornerBits[choice];
  }

  return mask;
}

function buildCornerStateGrid(
  rows: number,
  columns: number,
  hasCell: (row: number, col: number) => boolean,
  cellStates: number[][],
  terrainCount: number,
): number[][] {
  const corners = Array.from({ length: rows + 1 }, () => Array.from({ length: columns + 1 }, () => 0));

  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= columns; col += 1) {
      const adjacent: number[] = [];
      if (hasCell(row - 1, col - 1)) {
        adjacent.push(cellStates[row - 1][col - 1]);
      }
      if (hasCell(row - 1, col)) {
        adjacent.push(cellStates[row - 1][col]);
      }
      if (hasCell(row, col - 1)) {
        adjacent.push(cellStates[row][col - 1]);
      }
      if (hasCell(row, col)) {
        adjacent.push(cellStates[row][col]);
      }

      if (!adjacent.length) {
        corners[row][col] = residueHash(row * 131 + col * 173, `${rows}x${columns}`, 'wang-corner-empty') % terrainCount;
        continue;
      }

      const counts = new Map<number, number>();
      adjacent.forEach((state) => counts.set(state, (counts.get(state) ?? 0) + 1));
      const maxCount = Math.max(...counts.values());
      const candidates = Array.from(counts.entries())
        .filter(([, count]) => count === maxCount)
        .map(([state]) => state)
        .sort((a, b) => a - b);

      const tieHash = residueHash(row * 541 + col * 983, adjacent.join(','), 'wang-corner-tie');
      corners[row][col] = candidates[tieHash % candidates.length];
    }
  }

  return corners;
}

export function getWangCornerMaskPolygons(maskId: number): UnitPoint[][] {
  const normalized = maskId & 15;
  return S_V2_MASK_POLYGONS[normalized] ?? [];
}

export function buildWangLegendSwatches(terrainCount: number, variant: WangVariant): WangLegendSwatch[] {
  const count = Math.max(2, terrainCount);
  if (variant === 'edge_legacy') {
    return [
      { maskId: 3, primaryState: 0, secondaryState: 1 % count },
      { maskId: 6, primaryState: 1 % count, secondaryState: 0 },
      { maskId: 12, primaryState: 0, secondaryState: 1 % count },
      { maskId: 5, primaryState: 1 % count, secondaryState: 0 },
    ];
  }

  return [
    { maskId: 1, primaryState: 0, secondaryState: 1 % count },
    { maskId: 6, primaryState: 1 % count, secondaryState: 0 },
    { maskId: 12, primaryState: 0, secondaryState: 1 % count },
    { maskId: 15, primaryState: 1 % count, secondaryState: 0 },
  ];
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
  const variant = resolveWangVariant(settings);

  if (!sampled.length) {
    return {
      tiles: [],
      columns: 0,
      rows: 0,
      terrainStates: [],
      variant,
      step: 1,
      totalLength,
    };
  }

  const sampledSymbols = Array.from(new Set(sampled.toUpperCase().split('')));
  const terrainStates = resolveWangTerrainStates(sequenceType, settings, sampledSymbols);
  const terrainCount = Math.max(2, terrainStates.length);

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

  const symbolStateCache = new Map<string, number>();
  const cellStates = Array.from({ length: rows }, () => Array.from({ length: columns }, () => 0));
  for (let i = 0; i < sampled.length; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    cellStates[row][col] = resolveWangStateIndex(
      sampled[i],
      sequenceType,
      settings,
      terrainStates,
      symbolStateCache,
    );
  }

  const tiles: WangTile[] = [];

  if (variant === 'edge_legacy') {
    const vertical = Array.from({ length: rows }, () => Array.from({ length: columns + 1 }, () => 0));
    const horizontal = Array.from({ length: rows + 1 }, () => Array.from({ length: columns }, () => 0));

    const edgeCode = (salt: string, a: number, b: number, text: string): number =>
      residueHash(a * 131 + b * 197, text, salt) % terrainCount;

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

    for (let i = 0; i < sampled.length; i += 1) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const residue = sampled[i];
      const symbolState = cellStates[row][col];

      const x = originX + col * tileSpan + inset;
      const y = originY + row * tileSpan + inset;

      tiles.push({
        index: i * step,
        residue,
        x,
        y,
        size,
        symbolState,
        primaryState: symbolState,
        secondaryState: (symbolState + 1) % terrainCount,
        cornerMaskId: [3, 6, 9, 12][residueHash(i, residue, 'wang-edge-mask') % 4],
        edgeCodes: {
          n: horizontal[row][col],
          e: vertical[row][col + 1],
          s: horizontal[row + 1][col],
          w: vertical[row][col],
        },
        corners: {
          nw: symbolState,
          ne: symbolState,
          se: symbolState,
          sw: symbolState,
        },
      });
    }
  } else {
    const cornerStates = buildCornerStateGrid(rows, columns, hasCell, cellStates, terrainCount);

    for (let i = 0; i < sampled.length; i += 1) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const residue = sampled[i];
      const symbolState = cellStates[row][col];

      const x = originX + col * tileSpan + inset;
      const y = originY + row * tileSpan + inset;

      const corners: TileCornerStates = {
        nw: cornerStates[row][col],
        ne: cornerStates[row][col + 1],
        se: cornerStates[row + 1][col + 1],
        sw: cornerStates[row + 1][col],
      };

      const primaryState = symbolState;
      const secondaryState = pickSecondaryState(primaryState, corners, terrainCount, i, residue);
      const cornerMaskId = cornerMaskForPrimary(primaryState, corners, i, residue);

      tiles.push({
        index: i * step,
        residue,
        x,
        y,
        size,
        symbolState,
        primaryState,
        secondaryState,
        cornerMaskId,
        edgeCodes: {
          n: 0,
          e: 0,
          s: 0,
          w: 0,
        },
        corners,
      });
    }
  }

  return {
    tiles,
    columns,
    rows,
    terrainStates,
    variant,
    step,
    totalLength,
  };
}

export function renderWangMaze(model: WangMazeModel, settings: ArtSettings): ReactNode[] {
  if (!model.tiles.length || model.terrainStates.length === 0) {
    return [];
  }

  const states = model.terrainStates;
  const showGlyphText = settings.glyphLabels.enabled;
  const labelSizeScale = clamp(settings.glyphLabels.sizeScale, 0.5, 2.2);
  const labelFont = resolveFontFamily(settings.glyphLabels.fontFamily);

  return [
    (
      <g key="wang-tiles">
        {model.tiles.map((tile) => {
          const cx = tile.x + tile.size * 0.5;
          const cy = tile.y + tile.size * 0.5;
          const primaryColor = states[tile.primaryState % states.length] ?? states[0];
          const secondaryColor = states[tile.secondaryState % states.length] ?? states[0];

          if (model.variant === 'edge_legacy') {
            const nColor = states[tile.edgeCodes.n % states.length] ?? states[0];
            const eColor = states[tile.edgeCodes.e % states.length] ?? states[0];
            const sColor = states[tile.edgeCodes.s % states.length] ?? states[0];
            const wColor = states[tile.edgeCodes.w % states.length] ?? states[0];

            return (
              <g key={`wang-tile-${tile.index}`}>
                <rect
                  x={tile.x}
                  y={tile.y}
                  width={tile.size}
                  height={tile.size}
                  fill={secondaryColor}
                  fillOpacity={0.95}
                />
                <polygon points={trianglePoints(tile.x, tile.y, tile.size, 'n')} fill={nColor} fillOpacity={0.98} />
                <polygon points={trianglePoints(tile.x, tile.y, tile.size, 'e')} fill={eColor} fillOpacity={0.98} />
                <polygon points={trianglePoints(tile.x, tile.y, tile.size, 's')} fill={sColor} fillOpacity={0.98} />
                <polygon points={trianglePoints(tile.x, tile.y, tile.size, 'w')} fill={wColor} fillOpacity={0.98} />
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
          }

          const polygons = getWangCornerMaskPolygons(tile.cornerMaskId);

          return (
            <g key={`wang-tile-${tile.index}`}>
              <rect
                x={tile.x}
                y={tile.y}
                width={tile.size}
                height={tile.size}
                fill={secondaryColor}
                fillOpacity={0.98}
              />
              {polygons.map((polygon, polygonIndex) => (
                <polygon
                  key={`wang-corner-mask-${tile.index}-${polygonIndex}`}
                  points={pointList(polygon, tile.x, tile.y, tile.size)}
                  fill={primaryColor}
                  fillOpacity={0.98}
                />
              ))}
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
