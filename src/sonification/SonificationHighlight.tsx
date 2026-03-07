import type { PlaybackEntry } from './playbackMap';

interface Props {
  entry: PlaybackEntry | null;
}

export function SonificationHighlight({ entry }: Props) {
  if (!entry) return null;

  const r = entry.size * 0.6;

  return (
    <g pointerEvents="none" className="sonify-highlight">
      {/* Glow */}
      <circle
        cx={entry.cx}
        cy={entry.cy}
        r={r * 1.6}
        fill="rgba(255,255,255,0.18)"
      >
        <animate
          attributeName="r"
          values={`${r * 1.4};${r * 1.8};${r * 1.4}`}
          dur="0.4s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Ring */}
      <circle
        cx={entry.cx}
        cy={entry.cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={Math.max(1.5, r * 0.15)}
      >
        <animate
          attributeName="r"
          values={`${r * 0.9};${r * 1.1};${r * 0.9}`}
          dur="0.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-opacity"
          values="0.85;0.55;0.85"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}
