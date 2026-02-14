import type { FontFamilyId } from '../types';

export const FONT_FAMILY_OPTIONS: Array<{ id: FontFamilyId; label: string; css: string }> = [
  { id: 'space_grotesk', label: 'Space Grotesk', css: "'Space Grotesk', 'Avenir Next', sans-serif" },
  { id: 'ibm_plex_sans', label: 'IBM Plex Sans', css: "'IBM Plex Sans', 'Segoe UI', sans-serif" },
  { id: 'ibm_plex_mono', label: 'IBM Plex Mono', css: "'IBM Plex Mono', 'JetBrains Mono', monospace" },
  { id: 'georgia', label: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
  { id: 'helvetica', label: 'Helvetica', css: "Helvetica, Arial, sans-serif" },
];

export function resolveFontFamily(id: FontFamilyId): string {
  return FONT_FAMILY_OPTIONS.find((item) => item.id === id)?.css ?? FONT_FAMILY_OPTIONS[0].css;
}
