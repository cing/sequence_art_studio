import type { ReactNode } from 'react';
import { getBackground } from '../lib/aa-map';

export function renderBackground(
  backgroundId: string,
  width: number,
  height: number,
  uid: string,
): ReactNode {
  const background = getBackground(backgroundId);
  const gradientId = `${uid}-bg-gradient`;
  const grainId = `${uid}-bg-grain`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={background.base} />
          <stop offset="54%" stopColor={background.accentA} />
          <stop offset="100%" stopColor={background.accentB} />
        </linearGradient>
        <pattern id={grainId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="0.8" fill={`rgba(10, 10, 10, ${background.grainOpacity})`} />
          <circle cx="15" cy="14" r="0.6" fill={`rgba(10, 10, 10, ${background.grainOpacity * 0.9})`} />
          <circle cx="22" cy="7" r="0.75" fill={`rgba(255, 255, 255, ${background.grainOpacity * 0.8})`} />
          <circle cx="9" cy="20" r="0.5" fill={`rgba(255, 255, 255, ${background.grainOpacity})`} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
      <rect x={0} y={0} width={width} height={height} fill={`url(#${grainId})`} />
    </>
  );
}
