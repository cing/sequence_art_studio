import { describe, expect, it } from 'vitest';
import { buildProteinStyleMapFromScheme } from './aa-map';

describe('protein physicochemical scheme', () => {
  it('uses conventional acidic/basic colors', () => {
    const map = buildProteinStyleMapFromScheme('protein_physicochemical_7');

    expect(map.D.color).toBe('#e41a1c');
    expect(map.E.color).toBe('#e41a1c');
    expect(map.K.color).toBe('#377eb8');
    expect(map.R.color).toBe('#377eb8');
    expect(map.H.color).toBe('#377eb8');
  });

  it('keeps charge groups distinct', () => {
    const map = buildProteinStyleMapFromScheme('protein_physicochemical_7');

    expect(map.D.color).not.toBe(map.K.color);
    expect(map.E.color).not.toBe(map.R.color);
  });
});
