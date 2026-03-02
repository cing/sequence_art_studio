import { describe, expect, it } from 'vitest';
import type { ArtSettings } from '../types';
import { AMINO_ACIDS_20, buildProteinStyleMapFromScheme } from '../lib/aa-map';
import { buildDnaStyleMapFromScheme } from '../lib/dna-map';
import { buildGlyphGridModel } from './glyphGrid';
import { buildHexWeaveModel } from './hexWeave';
import { buildRibbonModel } from './ribbonStripes';
import { buildRadialBloomModel } from './radialBloom';
import { buildTruchetModel } from './truchetTiles';
import { buildWangMazeModel, resolveWangTerrainStates } from './wangMaze';

const rect = { x: 100, y: 120, width: 2000, height: 1400 };

const settings: ArtSettings = {
  mode: 'glyph_grid',
  proteinSchemeId: 'protein_physicochemical_7',
  proteinResidueStyles: buildProteinStyleMapFromScheme('protein_physicochemical_7'),
  dnaSchemeId: 'dna_classic_4',
  dnaResidueStyles: buildDnaStyleMapFromScheme('dna_classic_4'),
  wang: {
    variant: 'corner_sv2',
    terrainCap: 6,
    lockSymbolTiles: true,
  },
  truchet: {
    variant: 'diagonal',
    tileOverrides: {},
    whiteBackground: false,
  },
  showArtBorder: true,
  scale: 1,
  spacing: 1,
  density: 1,
  jitter: 1,
  glyphLabels: {
    enabled: true,
    color: '#21303a',
    sizeScale: 1,
    fontFamily: 'ibm_plex_mono',
  },
  legend: {
    enabled: true,
    position: 'bottom',
    showSymbolMap: true,
    showTypeLength: true,
    showSymbolKeyTitle: true,
    showBorder: true,
    fontScale: 1,
    paddingScale: 1,
    textAlign: 'left',
    boldText: false,
    fontFamily: 'space_grotesk',
    xOffset: 0,
    yOffset: 0,
    widthScale: 1,
    heightScale: 1,
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

  it('wang maze output is stable', () => {
    const modelA = buildWangMazeModel(proteinSequence, rect, { ...settings, mode: 'wang_maze' }, 'protein');
    const modelB = buildWangMazeModel(proteinSequence, rect, { ...settings, mode: 'wang_maze' }, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('wang edge legacy output is stable', () => {
    const modelA = buildWangMazeModel(
      proteinSequence,
      rect,
      {
        ...settings,
        mode: 'wang_maze',
        wang: { ...settings.wang, variant: 'edge_legacy' },
      },
      'protein',
    );
    const modelB = buildWangMazeModel(
      proteinSequence,
      rect,
      {
        ...settings,
        mode: 'wang_maze',
        wang: { ...settings.wang, variant: 'edge_legacy' },
      },
      'protein',
    );
    expect(modelA).toEqual(modelB);
  });

  it('wang lock keeps one tile profile per symbol', () => {
    const sequence = 'DDDDCCCCEEEEDDDDCCCCEEEE';
    const assertLockedProfiles = (variant: ArtSettings['wang']['variant']): void => {
      const model = buildWangMazeModel(
        sequence,
        rect,
        {
          ...settings,
          mode: 'wang_maze',
          wang: { ...settings.wang, variant, lockSymbolTiles: true },
        },
        'protein',
      );

      const bySymbol = new Map<string, string>();
      model.tiles.forEach((tile) => {
        const symbol = tile.residue.toUpperCase();
        const signature = [
          tile.primaryState,
          tile.secondaryState,
          tile.cornerMaskId,
          tile.edgeCodes.n,
          tile.edgeCodes.e,
          tile.edgeCodes.s,
          tile.edgeCodes.w,
        ].join('|');

        const known = bySymbol.get(symbol);
        if (known === undefined) {
          bySymbol.set(symbol, signature);
        } else {
          expect(signature).toBe(known);
        }
      });
    };

    assertLockedProfiles('corner_sv2');
    assertLockedProfiles('edge_legacy');
  });

  it('wang uses minimal palette size for unique symbol tiles', () => {
    const sixteenSymbols = AMINO_ACIDS_20.slice(0, 16);
    const seventeenSymbols = AMINO_ACIDS_20.slice(0, 17);

    const palette16 = resolveWangTerrainStates('protein', { ...settings, mode: 'wang_maze' }, sixteenSymbols);
    const palette17 = resolveWangTerrainStates('protein', { ...settings, mode: 'wang_maze' }, seventeenSymbols);

    expect(palette16.length).toBe(2);
    expect(palette17.length).toBe(3);
  });

  it('truchet tile output is stable', () => {
    const modelA = buildTruchetModel(proteinSequence, rect, { ...settings, mode: 'truchet_tiles' }, 'protein');
    const modelB = buildTruchetModel(proteinSequence, rect, { ...settings, mode: 'truchet_tiles' }, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('hex weave output is stable', () => {
    const modelA = buildHexWeaveModel(proteinSequence, rect, { ...settings, mode: 'hex_weave' }, 'protein');
    const modelB = buildHexWeaveModel(proteinSequence, rect, { ...settings, mode: 'hex_weave' }, 'protein');
    expect(modelA).toEqual(modelB);
  });

  it('wang maze colors change with scheme presets', () => {
    const schemeA = {
      ...settings,
      mode: 'wang_maze' as const,
      proteinSchemeId: 'protein_physicochemical_7',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_physicochemical_7'),
    };
    const schemeB = {
      ...settings,
      mode: 'wang_maze' as const,
      proteinSchemeId: 'protein_gallery_20',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_gallery_20'),
    };

    const modelA = buildWangMazeModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeA, 'protein');
    const modelB = buildWangMazeModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeB, 'protein');
    expect(modelA.terrainStates[0]).not.toEqual(modelB.terrainStates[0]);
  });

  it('wang terrain state cap is enforced', () => {
    const terrainStates = resolveWangTerrainStates('protein', {
      ...settings,
      mode: 'wang_maze',
      proteinSchemeId: 'protein_unique_20',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_unique_20'),
      wang: {
        variant: 'corner_sv2',
        terrainCap: 6,
        lockSymbolTiles: true,
      },
    });
    expect(terrainStates.length).toBeLessThanOrEqual(6);
    expect(terrainStates.length).toBeGreaterThanOrEqual(2);
  });

  it('truchet colors change with scheme presets', () => {
    const schemeA = {
      ...settings,
      mode: 'truchet_tiles' as const,
      proteinSchemeId: 'protein_physicochemical_7',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_physicochemical_7'),
    };
    const schemeB = {
      ...settings,
      mode: 'truchet_tiles' as const,
      proteinSchemeId: 'protein_gallery_20',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_gallery_20'),
    };

    const modelA = buildTruchetModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeA, 'protein');
    const modelB = buildTruchetModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeB, 'protein');
    expect(modelA.tiles[0]?.primaryColor).not.toEqual(modelB.tiles[0]?.primaryColor);
  });

  it('hex weave colors change with scheme presets', () => {
    const schemeA = {
      ...settings,
      mode: 'hex_weave' as const,
      proteinSchemeId: 'protein_physicochemical_7',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_physicochemical_7'),
    };
    const schemeB = {
      ...settings,
      mode: 'hex_weave' as const,
      proteinSchemeId: 'protein_gallery_20',
      proteinResidueStyles: buildProteinStyleMapFromScheme('protein_gallery_20'),
    };

    const modelA = buildHexWeaveModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeA, 'protein');
    const modelB = buildHexWeaveModel('AAAAAAAAAAAAAAAAAAAA', rect, schemeB, 'protein');
    expect(modelA.cells[0]?.fillColor).not.toEqual(modelB.cells[0]?.fillColor);
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
