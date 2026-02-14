import type { LayoutResult, LegendSettings, PrintPreset } from '../types';
import { clamp } from './utils';

export const PRINT_PRESETS: PrintPreset[] = [
  { id: 'a4_portrait', label: 'A4 Portrait', widthIn: 8.27, heightIn: 11.69 },
  { id: 'a4_landscape', label: 'A4 Landscape', widthIn: 11.69, heightIn: 8.27 },
  { id: 'letter_portrait', label: 'Letter Portrait', widthIn: 8.5, heightIn: 11 },
  { id: 'letter_landscape', label: 'Letter Landscape', widthIn: 11, heightIn: 8.5 },
  { id: 'square_12', label: 'Square 12x12 in', widthIn: 12, heightIn: 12 },
  { id: 'square_18', label: 'Square 18x18 in', widthIn: 18, heightIn: 18 },
];

export function getPrintPreset(id: string): PrintPreset {
  return PRINT_PRESETS.find((preset) => preset.id === id) ?? PRINT_PRESETS[0];
}

export function toPixels(inches: number, dpi = 300): number {
  return Math.round(inches * dpi);
}

export function buildLayout(presetId: string, legend: LegendSettings, dpi = 300): LayoutResult {
  const preset = getPrintPreset(presetId);
  const widthPx = toPixels(preset.widthIn, dpi);
  const heightPx = toPixels(preset.heightIn, dpi);

  const margin = Math.round(Math.min(widthPx, heightPx) * 0.04);
  let artX = margin;
  let artY = margin;
  let artWidth = widthPx - margin * 2;
  let artHeight = heightPx - margin * 2;

  let legendRect: LayoutResult['legendRect'];

  if (legend.enabled) {
    const reserve = clamp(Math.round(Math.min(widthPx, heightPx) * 0.16), 160, 900);
    if (legend.position === 'bottom') {
      legendRect = { x: artX, y: heightPx - margin - reserve, width: artWidth, height: reserve };
      artHeight -= reserve + Math.round(margin * 0.4);
    } else if (legend.position === 'top') {
      legendRect = { x: artX, y: artY, width: artWidth, height: reserve };
      artY += reserve + Math.round(margin * 0.4);
      artHeight -= reserve + Math.round(margin * 0.4);
    } else if (legend.position === 'left') {
      legendRect = { x: artX, y: artY, width: reserve, height: artHeight };
      artX += reserve + Math.round(margin * 0.4);
      artWidth -= reserve + Math.round(margin * 0.4);
    } else {
      legendRect = { x: widthPx - margin - reserve, y: artY, width: reserve, height: artHeight };
      artWidth -= reserve + Math.round(margin * 0.4);
    }
  }

  return {
    widthPx,
    heightPx,
    artRect: {
      x: artX,
      y: artY,
      width: Math.max(artWidth, 1),
      height: Math.max(artHeight, 1),
    },
    legendRect,
  };
}
