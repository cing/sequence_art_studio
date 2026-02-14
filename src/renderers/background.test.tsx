import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderSurface } from './background';

describe('surface renderer', () => {
  it('always paints a strict white base', () => {
    const markup = renderToStaticMarkup(<svg>{renderSurface(1600, 1200)}</svg>);
    expect(markup).toContain('fill="#ffffff"');
  });

  it('is stable for repeated renders', () => {
    const lowMarkup = renderToStaticMarkup(
      <svg>{renderSurface(1600, 1200)}</svg>,
    );
    const highMarkup = renderToStaticMarkup(
      <svg>{renderSurface(1600, 1200)}</svg>,
    );

    expect(lowMarkup).toContain('fill="#ffffff"');
    expect(highMarkup).toContain('fill="#ffffff"');
  });
});
