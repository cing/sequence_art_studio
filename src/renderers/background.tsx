import type { ReactNode } from 'react';
export function renderSurface(width: number, height: number): ReactNode {
  return <rect x={0} y={0} width={width} height={height} fill="#ffffff" />;
}
