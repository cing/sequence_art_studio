import type { ReactNode } from 'react';
import type { ArtSettings, Rect, SequenceType } from '../types';
import { buildGlyphGridModel, renderGlyphGrid } from './glyphGrid';
import { buildHexWeaveModel, renderHexWeaveModel } from './hexWeave';
import { buildRadialBloomModel, renderRadialBloom } from './radialBloom';
import { buildRibbonModel, renderRibbonModel } from './ribbonStripes';
import { buildTruchetModel, renderTruchetModel } from './truchetTiles';
import { buildWangMazeModel, renderWangMaze } from './wangMaze';

export interface RenderSummary {
  plotted: number;
  total: number;
  warning?: string;
}

export interface RenderOutput {
  nodes: ReactNode;
  summary: RenderSummary;
}

export function renderArt(
  sequence: string,
  sequenceType: SequenceType,
  rect: Rect,
  settings: ArtSettings,
  uid: string,
): RenderOutput {
  if (settings.mode === 'glyph_grid') {
    const model = buildGlyphGridModel(sequence, rect, settings, sequenceType);
    return {
      nodes: <>{renderGlyphGrid(model, settings, uid)}</>,
      summary: {
        plotted: model.cells.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

  if (settings.mode === 'ribbon_stripes') {
    const model = buildRibbonModel(sequence, rect, settings, sequenceType);
    return {
      nodes: <>{renderRibbonModel(model, rect, `${uid}-ribbon-clip`, settings)}</>,
      summary: {
        plotted: model.segments.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

  if (settings.mode === 'radial_bloom') {
    const model = buildRadialBloomModel(sequence, rect, settings, sequenceType);
    return {
      nodes: <>{renderRadialBloom(model)}</>,
      summary: {
        plotted: model.wedges.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

  if (settings.mode === 'truchet_tiles') {
    const model = buildTruchetModel(sequence, rect, settings, sequenceType);
    return {
      nodes: <>{renderTruchetModel(model, settings)}</>,
      summary: {
        plotted: model.tiles.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

  if (settings.mode === 'hex_weave') {
    const model = buildHexWeaveModel(sequence, rect, settings, sequenceType);
    return {
      nodes: <>{renderHexWeaveModel(model, settings)}</>,
      summary: {
        plotted: model.cells.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

  const model = buildWangMazeModel(sequence, rect, settings, sequenceType);
  return {
    nodes: <>{renderWangMaze(model, settings)}</>,
    summary: {
      plotted: model.tiles.length,
      total: model.totalLength,
      warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
    },
  };
}
