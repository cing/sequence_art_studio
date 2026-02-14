import type { ReactNode } from 'react';
import type { ArtSettings, Rect, SequenceType } from '../types';
import { buildGlyphGridModel, renderGlyphGrid } from './glyphGrid';
import { buildRadialBloomModel, renderRadialBloom } from './radialBloom';
import { buildRibbonModel, renderRibbonModel } from './ribbonStripes';

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
      nodes: <>{renderRibbonModel(model, rect, `${uid}-ribbon-clip`)}</>,
      summary: {
        plotted: model.segments.length,
        total: model.totalLength,
        warning: model.step > 1 ? `Showing every ${model.step}th symbol for readability.` : undefined,
      },
    };
  }

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
