import type { ArtSettings, Rect, SequenceType } from '../types';
import { buildGlyphGridModel } from '../renderers/glyphGrid';
import { buildRibbonModel } from '../renderers/ribbonStripes';
import { buildRadialBloomModel } from '../renderers/radialBloom';
import { buildTruchetModel } from '../renderers/truchetTiles';
import { buildHexWeaveModel } from '../renderers/hexWeave';
import { buildWangMazeModel } from '../renderers/wangMaze';

export interface PlaybackEntry {
  seqIndex: number;
  residue: string;
  cx: number;
  cy: number;
  size: number;
}

export function buildPlaybackMap(
  sequence: string,
  sequenceType: SequenceType,
  rect: Rect,
  settings: ArtSettings,
): PlaybackEntry[] {
  const mode = settings.mode;

  if (mode === 'glyph_grid') {
    const model = buildGlyphGridModel(sequence, rect, settings, sequenceType);
    return model.cells.map((c) => ({
      seqIndex: c.index,
      residue: c.residue,
      cx: c.x,
      cy: c.y,
      size: c.size,
    }));
  }

  if (mode === 'ribbon_stripes') {
    const model = buildRibbonModel(sequence, rect, settings, sequenceType);
    return model.segments.map((s) => ({
      seqIndex: s.index,
      residue: s.residue,
      cx: s.x + s.width * 0.5,
      cy: s.y + s.height * 0.5,
      size: Math.min(s.width, s.height),
    }));
  }

  if (mode === 'radial_bloom') {
    const model = buildRadialBloomModel(sequence, rect, settings, sequenceType);
    return model.wedges.map((w) => ({
      seqIndex: w.index,
      residue: w.residue,
      cx: w.cx,
      cy: w.cy,
      size: w.size,
    }));
  }

  if (mode === 'truchet_tiles') {
    const model = buildTruchetModel(sequence, rect, settings, sequenceType);
    return model.tiles.map((t) => ({
      seqIndex: t.index,
      residue: t.residue,
      cx: t.x + t.size * 0.5,
      cy: t.y + t.size * 0.5,
      size: t.size,
    }));
  }

  if (mode === 'hex_weave') {
    const model = buildHexWeaveModel(sequence, rect, settings, sequenceType);
    return model.cells.map((c) => ({
      seqIndex: c.index,
      residue: c.residue,
      cx: c.cx,
      cy: c.cy,
      size: c.radius * 2,
    }));
  }

  // wang_maze
  const model = buildWangMazeModel(sequence, rect, settings, sequenceType);
  return model.tiles.map((t) => ({
    seqIndex: t.index,
    residue: t.residue,
    cx: t.x + t.size * 0.5,
    cy: t.y + t.size * 0.5,
    size: t.size,
  }));
}
