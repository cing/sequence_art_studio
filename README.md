# Sequence Art Studio

A React + Vite web app that converts protein or DNA sequences into printable artwork with optional sonification.

## Features

### Sequence Input
- FASTA file upload (auto-detects DNA vs protein per entry)
- Pasted FASTA text (auto-detects DNA vs protein)
- Accession lookups: UniProt (protein), NCBI Nucleotide (DNA)

### Art Modes
Six deterministic rendering modes:
- **Glyph Grid** — grid with per-residue shapes and colors
- **Ribbon Stripes** — curved ribbon color bands
- **Radial Bloom** — radial wedge pattern
- **Truchet Tiles** — Truchet tile mosaic (multiple variants: diagonal, quarter arcs, colored arcs, diagonal maze)
- **Hex Weave** — hexagonal interlocking
- **Wang Maze** — deterministic Wang tile maze

### Styling
- **Protein**: 5 color schemes (physicochemical, reduced 5/3-color, unique-20, gallery mosaic) with per-amino-acid color + shape overrides
- **DNA**: 4 color schemes (classic 4-base, purine/pyrimidine, IUPAC, mosaic contrast) with per-symbol overrides
- Glyph-grid labels: show/hide, font size, color, font family selection

### Canvas & Legend
- Configurable canvas background color (white/black presets or custom color picker)
- Dark mode toggle — switches UI, canvas background, and legend text color
- Editable legend with title, subtitle, and sequence type/length footer
- Toggleable symbol-key legend with per-mode shape rendering
- Legend text color picker, font family, alignment, bold, and size controls
- Legend vertically centered with unified typography

### Sonification
Multi-track audio playback of sequences using pure Web Audio API (no samples or dependencies):
- **Sequence-dependent palette** — each sequence derives a unique musical scale, root note, drum density, and swing from its composition
- **Melodic voice** — protein residues mapped by physicochemical group to pitch ranges; DNA reads codons translated to amino acids for warm, low-register melody
- **Synthesized drum track** — kick, snare, closed/open hi-hat with Euclidean rhythm distribution, looped as a steady groove
- **Scale-quantized harmony** — all notes constrained to the derived scale
- **Visual feedback** — synchronized SVG highlight rings on active residues with colored drum hit indicators; DNA highlights 3 nucleotides per codon simultaneously

### Fullscreen Preview
- Fullscreen mode hides all controls and fills the viewport with the art preview
- Floating toolbar with audio toggle and exit button
- Escape key to exit

### Export
- Canvas presets: A4, Letter, and square posters
- Export formats: SVG, PNG (with DPI scaling), PDF
- Export includes legend if visible in preview

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Validation

```bash
npm run test:run   # Run tests once
npm run build      # Type-check + production build
```

## Notes

- Rendering is deterministic: same sequence + settings produces identical art.
- Very long sequences are sampled for readability and browser performance.
- DNA autodetection is DNA-first for sequences composed only of DNA-compatible symbols.
- All sonification uses pure Web Audio API synthesis — zero external audio dependencies.
