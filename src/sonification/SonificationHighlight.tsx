import type { PlaybackEntry } from './playbackMap';
import type { DrumVoice } from './drumPatterns';

const DRUM_COLORS: Record<DrumVoice, string> = {
  kick: '#e05555',
  snare: '#55bbcc',
  closedHH: '#cccc55',
  openHH: '#cc88dd',
};

const DRUM_OFFSETS: [number, number][] = [
  [0, -1],  // top
  [1, 0],   // right
  [0, 1],   // bottom
  [-1, 0],  // left
];

interface Props {
  entry: PlaybackEntry | null;
  codonEntries?: PlaybackEntry[] | null;
  drumHits?: DrumVoice[];
}

function HighlightRing({ e, isPrimary }: { e: PlaybackEntry; isPrimary: boolean }) {
  const r = e.size * 0.6;
  const glowOpacity = isPrimary ? 0.18 : 0.10;
  const strokeOpacity = isPrimary ? '0.85;0.55;0.85' : '0.55;0.35;0.55';

  return (
    <>
      <circle cx={e.cx} cy={e.cy} r={r * 1.6} fill={`rgba(255,255,255,${glowOpacity})`}>
        <animate attributeName="r" values={`${r * 1.4};${r * 1.8};${r * 1.4}`} dur="0.4s" repeatCount="indefinite" />
      </circle>
      <circle
        cx={e.cx} cy={e.cy} r={r}
        fill="none" stroke="rgba(255,255,255,0.85)"
        strokeWidth={Math.max(1.5, r * 0.15)}
      >
        <animate attributeName="r" values={`${r * 0.9};${r * 1.1};${r * 0.9}`} dur="0.4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values={strokeOpacity} dur="0.4s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

export function SonificationHighlight({ entry, codonEntries, drumHits }: Props) {
  if (!entry) return null;

  // Determine which entries to highlight
  const entries = codonEntries ?? [entry];
  const primaryEntry = entries[0];
  const r = primaryEntry.size * 0.6;
  const dotRadius = Math.max(2, r * 0.15);
  const dotDist = r * 0.4;

  return (
    <g pointerEvents="none" className="sonify-highlight">
      {entries.map((e, i) => (
        <HighlightRing key={`ring-${e.seqIndex}`} e={e} isPrimary={i === 0} />
      ))}
      {/* Drum hit dots on the primary entry */}
      {drumHits && drumHits.map((voice, i) => {
        const offset = DRUM_OFFSETS[i % DRUM_OFFSETS.length];
        return (
          <circle
            key={`${voice}-${i}`}
            cx={primaryEntry.cx + offset[0] * dotDist}
            cy={primaryEntry.cy + offset[1] * dotDist}
            r={dotRadius}
            fill={DRUM_COLORS[voice]}
            opacity={0.9}
          >
            <animate
              attributeName="r"
              values={`${dotRadius * 1.2};${dotRadius * 0.6};${dotRadius}`}
              dur="0.3s"
              fill="freeze"
            />
          </circle>
        );
      })}
    </g>
  );
}
