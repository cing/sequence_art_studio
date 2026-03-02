import type { ReactNode } from 'react';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType } from '../types';

export interface BloomWedge {
  index: number;
  residue: string;
  path: string;
  color: string;
  opacity: number;
}

export interface RadialBloomModel {
  wedges: BloomWedge[];
  rings: number;
  step: number;
  totalLength: number;
}

function parseHexColor(text: string): { r: number; g: number; b: number } | null {
  const value = text.trim().toLowerCase();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return {
      r: parseInt(`${hex[0]}${hex[0]}`, 16),
      g: parseInt(`${hex[1]}${hex[1]}`, 16),
      b: parseInt(`${hex[2]}${hex[2]}`, 16),
    };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function toHexColor(r: number, g: number, b: number): string {
  const clampByte = (value: number) => clamp(Math.round(value), 0, 255);
  return `#${
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  }`;
}

function blendHexColors(base: string, target: string, ratio: number): string {
  const baseRgb = parseHexColor(base);
  const targetRgb = parseHexColor(target);
  if (!baseRgb || !targetRgb) {
    return base;
  }
  const mix = clamp(ratio, 0, 1);
  return toHexColor(
    baseRgb.r * (1 - mix) + targetRgb.r * mix,
    baseRgb.g * (1 - mix) + targetRgb.g * mix,
    baseRgb.b * (1 - mix) + targetRgb.b * mix,
  );
}

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function wedgePath(cx: number, cy: number, innerR: number, outerR: number, startA: number, endA: number): string {
  const a = polar(cx, cy, innerR, startA);
  const b = polar(cx, cy, outerR, startA);
  const c = polar(cx, cy, outerR, endA);
  const d = polar(cx, cy, innerR, endA);
  const outerArcFlag = endA - startA > Math.PI ? 1 : 0;

  return [
    `M ${a.x.toFixed(3)} ${a.y.toFixed(3)}`,
    `L ${b.x.toFixed(3)} ${b.y.toFixed(3)}`,
    `A ${outerR.toFixed(3)} ${outerR.toFixed(3)} 0 ${outerArcFlag} 1 ${c.x.toFixed(3)} ${c.y.toFixed(3)}`,
    `L ${d.x.toFixed(3)} ${d.y.toFixed(3)}`,
    `A ${innerR.toFixed(3)} ${innerR.toFixed(3)} 0 ${outerArcFlag} 0 ${a.x.toFixed(3)} ${a.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

export function buildRadialBloomModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): RadialBloomModel {
  const spacing = clamp(settings.spacing, 0.55, 1.7);
  const spacingRatio = clamp((spacing - 0.55) / 1.15, 0, 1);
  const maxWedges = Math.round(3000 + settings.density * 6000);
  const { sampled, step } = sampleSequence(sequence, maxWedges);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { wedges: [], rings: 0, step: 1, totalLength };
  }

  const cx = rect.x + rect.width * 0.5;
  const cy = rect.y + rect.height * 0.5;
  const maxRadius = Math.min(rect.width, rect.height) * 0.48;

  // scale controls spoke growth: low = proportional to radius, high = constant
  const growth = clamp(1 - (settings.scale - 0.6) / 1.0, 0, 1);
  const outerSpokes = clamp(Math.round(18 + settings.density * 60), 18, 98);

  // Iteratively determine ring count since variable spokes changes total capacity.
  let rings = Math.max(3, Math.ceil(sampled.length / outerSpokes));
  for (let iter = 0; iter < 8; iter++) {
    const gap = maxRadius / (rings + 1.25);
    const inner = gap * 0.22;
    let totalSlots = 0;
    for (let r = 0; r < rings; r++) {
      const fraction = clamp((inner + (r + 0.5) * gap) / maxRadius, 0.05, 1);
      totalSlots += Math.max(3, Math.round(outerSpokes * (1 - growth * (1 - fraction))));
    }
    if (totalSlots >= sampled.length) break;
    rings += Math.max(1, Math.ceil((sampled.length - totalSlots) / outerSpokes));
  }

  const ringGap = maxRadius / (rings + 1.25);
  const baseInner = ringGap * 0.22;
  const angularCoverage = 1.06 - spacingRatio * 0.34;
  const jitterBaseScale = 0.02 + spacingRatio * 0.38;
  const radialCoverage = 1.04 + (1 - spacingRatio) * 0.14;

  const wedges: BloomWedge[] = [];
  let residueIdx = 0;

  for (let ring = 0; ring < rings && residueIdx < sampled.length; ring++) {
    const fraction = clamp((baseInner + (ring + 0.5) * ringGap) / maxRadius, 0.05, 1);
    const ringSpokes = Math.max(3, Math.round(outerSpokes * (1 - growth * (1 - fraction))));
    const count = Math.min(ringSpokes, sampled.length - residueIdx);
    const angularStep = (Math.PI * 2) / ringSpokes;
    const jitterScale = angularStep * jitterBaseScale;
    const swirl = ring * angularStep * (0.08 + (1 - spacingRatio) * 0.06);

    for (let spoke = 0; spoke < count; spoke++) {
      const residue = sampled[residueIdx];
      const hash = residueHash(residueIdx, residue, 'bloom');

      const centerAngle = angularStep * spoke + (ring % 2 === 0 ? 0 : angularStep * 0.5) + swirl;
      const jitter = (((hash >>> 4) % 1000) / 1000 - 0.5) * jitterScale;
      const span = angularStep * angularCoverage;
      const startA = centerAngle + jitter - span * 0.5;
      const endA = centerAngle + jitter + span * 0.5;

      const innerR = baseInner + ring * ringGap;
      const outerR = Math.min(maxRadius, innerR + ringGap * radialCoverage);

      const baseColor = getStyleForSequenceSymbol(residue, sequenceType, settings).color;
      const toneRatio = ((hash >>> 11) % 100) / 100;
      const color = toneRatio > 0.52
        ? blendHexColors(baseColor, '#ffffff', 0.06 + ((hash >>> 16) % 20) / 500)
        : blendHexColors(baseColor, '#0f1722', 0.05 + ((hash >>> 18) % 24) / 520);
      const opacityBoost = (1 - spacingRatio) * 0.24;
      const opacity = clamp(0.58 + ((hash >>> 13) % 100) / 260 + opacityBoost, 0.56, 0.98);

      wedges.push({
        index: residueIdx * step,
        residue,
        path: wedgePath(cx, cy, innerR, outerR, startA, endA),
        color,
        opacity,
      });
      residueIdx++;
    }
  }

  return {
    wedges,
    rings,
    step,
    totalLength,
  };
}

export function renderRadialBloom(model: RadialBloomModel): ReactNode[] {
  return model.wedges.map((wedge) => (
    <path
      key={`bloom-${wedge.index}`}
      d={wedge.path}
      fill={wedge.color}
      fillOpacity={wedge.opacity}
      stroke={wedge.color}
      strokeOpacity={Math.min(1, wedge.opacity * 0.94)}
      strokeWidth={0.42}
      strokeLinejoin="round"
    />
  ));
}
