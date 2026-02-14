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
  const maxWedges = Math.round(3000 + settings.density * 6000);
  const { sampled, step } = sampleSequence(sequence, maxWedges);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { wedges: [], rings: 0, step: 1, totalLength };
  }

  const cx = rect.x + rect.width * 0.5;
  const cy = rect.y + rect.height * 0.5;
  const maxRadius = Math.min(rect.width, rect.height) * 0.48;
  const spokes = clamp(Math.round(18 + settings.density * 60), 18, 98);
  const rings = Math.ceil(sampled.length / spokes);
  const ringGap = maxRadius / (rings + 1.25);
  const baseInner = ringGap * 0.22;

  const wedges: BloomWedge[] = [];

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const ring = Math.floor(i / spokes);
    const spoke = i % spokes;
    const hash = residueHash(i, residue, 'bloom');

    const centerAngle = (Math.PI * 2 * spoke) / spokes + (ring % 2 === 0 ? 0 : Math.PI / spokes);
    const jitter = (((hash >>> 4) % 1000) / 1000 - 0.5) * (Math.PI / spokes) * 0.6;
    const span = (Math.PI * 2) / spokes * (0.74 + settings.spacing * 0.2);
    const startA = centerAngle + jitter - span * 0.5;
    const endA = centerAngle + jitter + span * 0.5;

    const innerR = baseInner + ring * ringGap;
    const outerR = Math.min(maxRadius, innerR + ringGap * (0.88 + settings.scale * 0.22));

    const opacity = clamp(0.5 + ((hash >>> 13) % 100) / 190, 0.44, 0.96);

    wedges.push({
      index: i * step,
      residue,
      path: wedgePath(cx, cy, innerR, outerR, startA, endA),
      color: getStyleForSequenceSymbol(residue, sequenceType, settings).color,
      opacity,
    });
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
      stroke="rgba(5, 8, 12, 0.08)"
      strokeWidth={0.65}
    />
  ));
}
