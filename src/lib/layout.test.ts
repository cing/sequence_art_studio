import { describe, expect, it } from 'vitest';
import { buildLayout } from './layout';

describe('layout builder', () => {
  it('creates legend at bottom and shrinks art area', () => {
    const withLegend = buildLayout(
      'a4_portrait',
      {
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
      300,
    );
    const withoutLegend = buildLayout(
      'a4_portrait',
      {
        enabled: false,
        position: 'bottom',
        showSymbolMap: false,
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
      300,
    );

    expect(withLegend.legendRect).toBeDefined();
    expect(withLegend.artRect.height).toBeLessThan(withoutLegend.artRect.height);
  });

  it('supports side legend positions', () => {
    const leftLayout = buildLayout(
      'square_12',
      {
        enabled: true,
        position: 'left',
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
      300,
    );
    const rightLayout = buildLayout(
      'square_12',
      {
        enabled: true,
        position: 'right',
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
      300,
    );

    expect(leftLayout.legendRect?.x).toBeLessThan(leftLayout.artRect.x);
    expect(rightLayout.legendRect?.x).toBeGreaterThan(rightLayout.artRect.x);
  });
});
