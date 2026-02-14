export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function residueHash(index: number, residue: string, salt: string): number {
  const text = `${salt}:${index}:${residue}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sampleSequence(sequence: string, maxPoints: number): { sampled: string; step: number } {
  if (sequence.length <= maxPoints) {
    return { sampled: sequence, step: 1 };
  }
  const step = Math.ceil(sequence.length / maxPoints);
  let sampled = '';
  for (let i = 0; i < sequence.length; i += step) {
    sampled += sequence[i];
  }
  return { sampled, step };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function wrapWords(text: string, maxChars: number): string[] {
  if (!text.trim()) {
    return [];
  }
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}
