import { describe, expect, it } from 'vitest';
import type { ArtSettings } from '../types';
import { buildProteinStyleMapFromScheme } from '../lib/aa-map';
import { buildDnaStyleMapFromScheme } from '../lib/dna-map';
import { buildGlyphGridModel } from './glyphGrid';
import { buildRibbonModel } from './ribbonStripes';
import { buildRadialBloomModel } from './radialBloom';

const rect = { x: 100, y: 120, width: 2000, height: 1400 };

const settings: ArtSettings = {
  mode: 'glyph_grid',
  proteinSchemeId: 'protein_physicochemical_7',
  proteinResidueStyles: buildProteinStyleMapFromScheme('protein_physicochemical_7'),
  dnaSchemeId: 'dna_classic_4',
  dnaResidueStyles: buildDnaStyleMapFromScheme('dna_classic_4'),
  scale: 1,
  spacing: 1,
  density: 1,
  glyphLabels: {
    enabled: true,
    color: '#21303a',
    sizeScale: 1,
  },
  legend: {
    enabled: true,
    position: 'bottom',
    showSymbolMap: true,
    fontScale: 1,
    paddingScale: 1,
    panelOpacity: 0.85,
  },
};

const proteinSequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(35);
const dnaSequence = 'ACGTRYSWKMBDHVN'.repeat(45);

describe('renderer determinism', () => {
  it('protein glyph grid output is stable', () => {
    const modelA = buildGlyphGridModel(proteinSequence, rect, settings, 'protein');
    const modelB = buildGlyphGridModel(proteinSequence, rect, settings, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('DNA glyph grid output is stable', () => {
    const modelA = buildGlyphGridModel(dnaSequence, rect, settings, 'dna');
    const modelB = buildGlyphGridModel(dnaSequence, rect, settings, 'dna');
    expect(modelA).toEqual(modelB);
  });

  it('ribbon output is stable', () => {
    const modelA = buildRibbonModel(proteinSequence, rect, { ...settings, mode: 'ribbon_stripes' }, 'protein');
    const modelB = buildRibbonModel(proteinSequence, rect, { ...settings, mode: 'ribbon_stripes' }, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('radial bloom output is stable', () => {
    const modelA = buildRadialBloomModel(proteinSequence, rect, { ...settings, mode: 'radial_bloom' }, 'protein');
    const modelB = buildRadialBloomModel(proteinSequence, rect, { ...settings, mode: 'radial_bloom' }, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('glyph grid spacing changes occupancy', () => {
    const tight = buildGlyphGridModel(proteinSequence, rect, { ...settings, spacing: 0.6 }, 'protein');
    const loose = buildGlyphGridModel(proteinSequence, rect, { ...settings, spacing: 1.6 }, 'protein');

    const tightMean = tight.cells.reduce((sum, cell) => sum + cell.size, 0) / tight.cells.length;
    const looseMean = loose.cells.reduce((sum, cell) => sum + cell.size, 0) / loose.cells.length;

    expect(tightMean).toBeGreaterThan(looseMean);
  });

  it('glyph grid density changes column density', () => {
    const low = buildGlyphGridModel(proteinSequence, rect, { ...settings, density: 0.6 }, 'protein');
    const high = buildGlyphGridModel(proteinSequence, rect, { ...settings, density: 1.6 }, 'protein');
    expect(high.columns).toBeGreaterThan(low.columns);
  });
});
