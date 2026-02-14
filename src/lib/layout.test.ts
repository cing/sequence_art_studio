import { describe, expect, it } from 'vitest';
import { buildLayout } from './layout';

describe('layout builder', () => {
  it('creates legend at bottom and shrinks art area', () => {
    const withLegend = buildLayout(
      'a4_portrait',
      { enabled: true, position: 'bottom', showSymbolMap: true, fontScale: 1, paddingScale: 1, panelOpacity: 0.85 },
      300,
    );
    const withoutLegend = buildLayout(
      'a4_portrait',
      { enabled: false, position: 'bottom', showSymbolMap: false, fontScale: 1, paddingScale: 1, panelOpacity: 0.85 },
      300,
    );

    expect(withLegend.legendRect).toBeDefined();
    expect(withLegend.artRect.height).toBeLessThan(withoutLegend.artRect.height);
  });

  it('supports side legend positions', () => {
    const leftLayout = buildLayout(
      'square_12',
      { enabled: true, position: 'left', showSymbolMap: true, fontScale: 1, paddingScale: 1, panelOpacity: 0.85 },
      300,
    );
    const rightLayout = buildLayout(
      'square_12',
      { enabled: true, position: 'right', showSymbolMap: true, fontScale: 1, paddingScale: 1, panelOpacity: 0.85 },
      300,
    );

    expect(leftLayout.legendRect?.x).toBeLessThan(leftLayout.artRect.x);
    expect(rightLayout.legendRect?.x).toBeGreaterThan(rightLayout.artRect.x);
  });
});
