# Sequence Art Studio

A React + Vite web app that converts protein or DNA sequences into printable artwork.

## Features

- Input from:
  - FASTA file upload (auto-detects DNA vs protein per entry)
  - pasted FASTA text (auto-detects DNA vs protein)
  - accession lookups:
    - UniProt (protein)
    - NCBI Nucleotide (DNA)
- Three deterministic art modes:
  - `Glyph Grid`
  - `Ribbon Stripes`
  - `Radial Bloom`
- White print canvas in preview/export artboard.
- Protein styling:
  - physicochemical grouping scheme
  - reduced 5-color and 3-color schemes
  - unique 20-color scheme
  - full per-amino-acid manual color + glyph overrides
- DNA styling:
  - classic 4-base scheme
  - reduced 2-group scheme
  - IUPAC-distinct scheme
  - full per-symbol manual color + glyph overrides
- Glyph-grid label controls:
  - show/hide glyph letters
  - glyph-letter font size scaling
  - glyph-letter color
- Editable legend metadata (title, subtitle, accession) and sequence length/type (`aa` or `nt`).
- Toggleable symbol-key legend (amino acids for proteins, IUPAC symbols for DNA).
- Adjustable metadata legend formatting:
  - text scale
  - box padding
  - panel opacity
- Print-oriented presets: A4, Letter, and square posters.
- Export formats: SVG, PNG, PDF.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Validation

```bash
npm run test:run
npm run build
```

## Notes

- Rendering is deterministic: same sequence + settings produces identical art.
- Very long sequences are sampled for readability and browser performance.
- Glyph-grid spacing and density sliders actively change glyph occupancy and packing.
- DNA autodetection is DNA-first for sequences composed only of DNA-compatible symbols.
