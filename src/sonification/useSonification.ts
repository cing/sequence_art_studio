import { useCallback, useEffect, useRef, useState } from 'react';
import type { SequenceType } from '../types';
import type { PlaybackEntry } from './playbackMap';
import { SequenceAudioEngine } from './audioEngine';
import { getFrequency, getNoteDuration, getVelocity } from './pitchMap';

const NOTE_INTERVAL = 0.125; // ~8 notes/sec
const LOOKAHEAD = 0.15; // schedule audio this far ahead

interface ScheduledVisual {
  entry: PlaybackEntry;
  time: number; // audio-clock time when this note starts
}

export function useSonification(
  playbackMap: PlaybackEntry[] | null,
  sequenceType: SequenceType,
  sequence: string,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<PlaybackEntry | null>(null);

  const engineRef = useRef<SequenceAudioEngine | null>(null);
  const rafRef = useRef<number>(0);
  const audioIndexRef = useRef(0);
  const nextNoteTimeRef = useRef(0);
  const prevMapRef = useRef<PlaybackEntry[] | null>(null);
  // Queue of upcoming visual highlights, ordered by time
  const visualQueueRef = useRef<ScheduledVisual[]>([]);
  const activeVisualIndexRef = useRef(-1);

  // Stop when playbackMap changes (new sequence/mode loaded)
  useEffect(() => {
    if (prevMapRef.current !== null && prevMapRef.current !== playbackMap) {
      setIsPlaying(false);
      setCurrentEntry(null);
      audioIndexRef.current = 0;
      engineRef.current?.stop();
      visualQueueRef.current = [];
      activeVisualIndexRef.current = -1;
    }
    prevMapRef.current = playbackMap;
  }, [playbackMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Main playback loop
  useEffect(() => {
    if (!isPlaying || !playbackMap || playbackMap.length === 0) {
      cancelAnimationFrame(rafRef.current);
      if (!isPlaying) {
        engineRef.current?.stop();
        setCurrentEntry(null);
        audioIndexRef.current = 0;
        visualQueueRef.current = [];
        activeVisualIndexRef.current = -1;
      }
      return;
    }

    if (!engineRef.current) {
      engineRef.current = new SequenceAudioEngine();
    }
    const engine = engineRef.current;
    engine.init();
    engine.resume();

    nextNoteTimeRef.current = engine.currentTime + 0.05;
    visualQueueRef.current = [];
    activeVisualIndexRef.current = -1;

    const scheduler = () => {
      const now = engine.currentTime;

      // 1. Schedule audio + enqueue visuals ahead of time
      while (nextNoteTimeRef.current < now + LOOKAHEAD) {
        const idx = audioIndexRef.current % playbackMap.length;
        const entry = playbackMap[idx];

        const freq = getFrequency(entry.residue, sequenceType);
        const vel = getVelocity(entry.residue, sequenceType, sequence, entry.seqIndex);
        const dur = getNoteDuration(entry.residue, sequenceType);

        engine.playNote(freq, vel, dur, nextNoteTimeRef.current);

        // Enqueue for visual display at the right moment
        visualQueueRef.current.push({ entry, time: nextNoteTimeRef.current });

        nextNoteTimeRef.current += NOTE_INTERVAL;
        audioIndexRef.current++;
      }

      // 2. Update visual highlight: find the latest note whose time has arrived
      const queue = visualQueueRef.current;
      let newVisualIdx = activeVisualIndexRef.current;
      while (newVisualIdx + 1 < queue.length && queue[newVisualIdx + 1].time <= now) {
        newVisualIdx++;
      }

      if (newVisualIdx !== activeVisualIndexRef.current && newVisualIdx >= 0) {
        activeVisualIndexRef.current = newVisualIdx;
        setCurrentEntry(queue[newVisualIdx].entry);

        // Trim consumed entries from queue to avoid unbounded growth
        // Keep a small buffer so we don't trim the active one
        if (newVisualIdx > 50) {
          const trim = newVisualIdx - 10;
          queue.splice(0, trim);
          activeVisualIndexRef.current -= trim;
          newVisualIdx -= trim;
        }
      }

      rafRef.current = requestAnimationFrame(scheduler);
    };

    rafRef.current = requestAnimationFrame(scheduler);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackMap, sequenceType, sequence]);

  const toggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return { isPlaying, currentEntry, toggle };
}
