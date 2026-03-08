import { useCallback, useEffect, useRef, useState } from 'react';
import type { SequenceType } from '../types';
import type { PlaybackEntry } from './playbackMap';
import { SequenceAudioEngine } from './audioEngine';
import { getFrequency, getNoteDuration, getVelocity } from './pitchMap';
import { deriveSequencePalette, type SequencePalette } from './sequencePalette';
import { buildDrumPattern, type DrumPattern, type DrumVoice } from './drumPatterns';

const NOTE_INTERVAL = 0.125; // ~8 notes/sec
const LOOKAHEAD = 0.15; // schedule audio this far ahead

interface ScheduledVisual {
  entry: PlaybackEntry;
  codonEntries: PlaybackEntry[] | null; // for DNA: all 3 nucleotide entries in the codon
  time: number; // audio-clock time when this note starts
  activeDrumHits: DrumVoice[];
}

export function useSonification(
  playbackMap: PlaybackEntry[] | null,
  sequenceType: SequenceType,
  sequence: string,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<PlaybackEntry | null>(null);
  const [codonEntries, setCodonEntries] = useState<PlaybackEntry[] | null>(null);
  const [activeDrumHits, setActiveDrumHits] = useState<DrumVoice[]>([]);

  const engineRef = useRef<SequenceAudioEngine | null>(null);
  const rafRef = useRef<number>(0);
  const audioIndexRef = useRef(0);
  const nextNoteTimeRef = useRef(0);
  const prevMapRef = useRef<PlaybackEntry[] | null>(null);
  const visualQueueRef = useRef<ScheduledVisual[]>([]);
  const activeVisualIndexRef = useRef(-1);
  const paletteRef = useRef<SequencePalette | null>(null);
  const drumPatternRef = useRef<DrumPattern | null>(null);
  const drumStepRef = useRef(0);

  // Stop when playbackMap changes (new sequence/mode loaded)
  useEffect(() => {
    if (prevMapRef.current !== null && prevMapRef.current !== playbackMap) {
      setIsPlaying(false);
      setCurrentEntry(null);
      setCodonEntries(null);
      setActiveDrumHits([]);
      audioIndexRef.current = 0;
      engineRef.current?.stop();
      visualQueueRef.current = [];
      activeVisualIndexRef.current = -1;
      paletteRef.current = null;
      drumPatternRef.current = null;
      drumStepRef.current = 0;
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
        setCodonEntries(null);
        setActiveDrumHits([]);
        audioIndexRef.current = 0;
        visualQueueRef.current = [];
        activeVisualIndexRef.current = -1;
        paletteRef.current = null;
        drumPatternRef.current = null;
        drumStepRef.current = 0;
      }
      return;
    }

    if (!engineRef.current) {
      engineRef.current = new SequenceAudioEngine();
    }
    const engine = engineRef.current;
    engine.init();
    engine.resume();

    // Compute palette and drum pattern once per playback start
    if (!paletteRef.current) {
      paletteRef.current = deriveSequencePalette(sequence, sequenceType);
    }
    if (!drumPatternRef.current) {
      drumPatternRef.current = buildDrumPattern(sequence, sequenceType, paletteRef.current);
    }
    drumStepRef.current = 0;

    nextNoteTimeRef.current = engine.currentTime + 0.05;
    visualQueueRef.current = [];
    activeVisualIndexRef.current = -1;

    const palette = paletteRef.current;
    const drumPattern = drumPatternRef.current;

    const scheduler = () => {
      const now = engine.currentTime;

      // 1. Schedule audio + enqueue visuals ahead of time
      const isDna = sequenceType === 'dna';
      const stepSize = isDna ? 3 : 1; // DNA reads codons (3 nucleotides at a time)

      while (nextNoteTimeRef.current < now + LOOKAHEAD) {
        const idx = audioIndexRef.current % playbackMap.length;
        const entry = playbackMap[idx];

        let codon: string | undefined;
        let codonEntriesForStep: PlaybackEntry[] | null = null;

        if (isDna) {
          // Gather 3 nucleotide entries for this codon
          codonEntriesForStep = [];
          for (let k = 0; k < 3; k++) {
            const ci = (audioIndexRef.current + k) % playbackMap.length;
            codonEntriesForStep.push(playbackMap[ci]);
          }
          codon = codonEntriesForStep.map((e) => e.residue).join('');
        }

        const freq = getFrequency(entry.residue, sequenceType, palette, codon);
        const vel = getVelocity(entry.residue, sequenceType, sequence, entry.seqIndex);
        const dur = getNoteDuration(entry.residue, sequenceType);

        engine.playNote(freq, vel, dur, nextNoteTimeRef.current);

        // Schedule drum hits for current step
        const drumStep = drumStepRef.current % 16;
        const stepHits = drumPattern.steps[drumStep];
        const swingOffset = (drumStep % 2 === 1) ? palette.swingAmount * NOTE_INTERVAL : 0;
        const drumHitsForStep: DrumVoice[] = [];

        if (stepHits) {
          for (const hit of stepHits) {
            engine.playDrumHit(hit.voice, hit.velocity, nextNoteTimeRef.current + swingOffset);
            drumHitsForStep.push(hit.voice);
          }
        }
        drumStepRef.current = (drumStepRef.current + 1) % 16;

        visualQueueRef.current.push({
          entry,
          codonEntries: codonEntriesForStep,
          time: nextNoteTimeRef.current,
          activeDrumHits: drumHitsForStep,
        });

        nextNoteTimeRef.current += NOTE_INTERVAL;
        audioIndexRef.current += stepSize;
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
        setCodonEntries(queue[newVisualIdx].codonEntries);
        setActiveDrumHits(queue[newVisualIdx].activeDrumHits);

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

  return { isPlaying, currentEntry, codonEntries, activeDrumHits, toggle };
}
