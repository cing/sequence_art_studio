import type { ReactNode } from 'react';
import { clamp, residueHash, sampleSequence } from '../lib/utils';
import { getStyleForSequenceSymbol } from '../lib/style-map';
import type { ArtSettings, Rect, SequenceType } from '../types';

export interface RibbonSegment {
  index: number;
  residue: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  rotation: number;
  color: string;
  opacity: number;
}

export interface RibbonModel {
  segments: RibbonSegment[];
  rows: number;
  step: number;
  totalLength: number;
}

export function buildRibbonModel(
  sequence: string,
  rect: Rect,
  settings: ArtSettings,
  sequenceType: SequenceType,
): RibbonModel {
  const maxSegments = Math.round(2600 + settings.density * 4200);
  const { sampled, step } = sampleSequence(sequence, maxSegments);
  const totalLength = sequence.length;

  if (!sampled.length) {
    return { segments: [], rows: 0, step: 1, totalLength };
  }

  const rows = clamp(Math.round(7 + settings.density * 22), 7, 40);
  const perRow = Math.ceil(sampled.length / rows);
  const cellW = rect.width / perRow;
  const stripeH = rect.height / rows;

  const segments: RibbonSegment[] = [];

  for (let i = 0; i < sampled.length; i += 1) {
    const residue = sampled[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const hash = residueHash(i, residue, 'ribbon');

    const wave = (((hash >>> 3) % 1000) / 1000 - 0.5) * stripeH * 0.7 * (0.6 + settings.scale * 0.5);
    const wobble = (((hash >>> 12) % 1000) / 1000 - 0.5) * cellW * 0.2;
    const x = rect.x + col * cellW + wobble;
    const y = rect.y + row * stripeH + wave;

    const width = Math.max(1, cellW * (1.05 + ((hash >>> 19) % 100) / 650) * (0.8 + settings.spacing * 0.4));
    const height = Math.max(1, stripeH * (0.66 + ((hash >>> 24) % 80) / 220));
    const radius = Math.max(1, Math.min(width, height) * 0.48);
    const rotation = ((hash >>> 7) % 16) - 8;
    const opacity = clamp(0.52 + ((hash >>> 14) % 100) / 210, 0.45, 0.95);

    segments.push({
      index: i * step,
      residue,
      x,
      y,
      width,
      height,
      radius,
      rotation,
      color: getStyleForSequenceSymbol(residue, sequenceType, settings).color,
      opacity,
    });
  }

  return {
    segments,
    rows,
    step,
    totalLength,
  };
}

export function renderRibbonModel(model: RibbonModel, rect: Rect, clipId: string): ReactNode {
  if (!model.segments.length) {
    return null;
  }

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {model.segments.map((segment) => {
          const cx = segment.x + segment.width * 0.5;
          const cy = segment.y + segment.height * 0.5;
          return (
            <rect
              key={`ribbon-${segment.index}`}
              x={segment.x}
              y={segment.y}
              width={segment.width}
              height={segment.height}
              rx={segment.radius}
              fill={segment.color}
              fillOpacity={segment.opacity}
              stroke="rgba(9, 10, 14, 0.10)"
              strokeWidth={Math.max(0.3, segment.height * 0.045)}
              transform={`rotate(${segment.rotation} ${cx} ${cy})`}
            />
          );
        })}
      </g>
    </>
  );
}
