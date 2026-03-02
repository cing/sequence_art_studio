# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check (tsc -b) then Vite production build
npm test             # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI-friendly)
npx vitest run src/lib/fasta.test.ts          # Run a single test file
npx vitest run -t "parses single record"      # Run a single test by name
```

## Architecture

Sequence Art Studio is a React/TypeScript app (Vite) that renders biological sequences (DNA/protein) as artistic SVG visualizations.

**Data flow:** Sequence input (paste, file upload, or API fetch) → FASTA parsing & type detection → style scheme lookup → model building → SVG rendering → optional export (SVG/PNG/PDF).

### Key directories

- `src/lib/` — Pure utility modules: FASTA parsing, sequence type detection, amino acid & DNA style schemes, UniProt/NCBI API clients, layout presets, font resolution
- `src/renderers/` — Six rendering modes, each following a **build model → render SVG** pattern
- `src/export/` — SVG/PNG/PDF export (clones SVG, optional legend via `data-legend` attribute)
- `src/App.tsx` — Main component; contains all UI state, control panels, and preview canvas
- `src/types.ts` — Central type definitions (`ArtSettings`, `SequenceType`, `ResidueStyle`, etc.)

### Rendering modes

Each renderer in `src/renderers/` exports a `buildXxxModel()` and `renderXxx()` pair. The dispatch in `src/renderers/index.tsx` selects based on `settings.mode`:

| Mode | File | Description |
|------|------|-------------|
| `glyph_grid` | `glyphGrid.tsx` | Grid with per-residue shapes/colors |
| `ribbon_stripes` | `ribbonStripes.tsx` | Curved ribbon color bands |
| `radial_bloom` | `radialBloom.tsx` | Radial wedge pattern |
| `truchet_tiles` | `truchetTiles.tsx` | Truchet tile mosaic |
| `hex_weave` | `hexWeave.tsx` | Hexagonal interlocking |
| `wang_maze` | `wangMaze.tsx` | Deterministic Wang tile maze (S-V2) |

### Style scheme system

- Protein schemes (5 options) in `src/lib/aa-map.ts` — physicochemical grouping, reduced palettes, unique-20, gallery mosaic
- DNA schemes (4 options) in `src/lib/dna-map.ts` — classic 4-base, purine/pyrimidine, IUPAC, mosaic contrast
- Per-residue customization: color picker, 6 shape options, manual glyph override

### Sequence type detection

DNA-first detection in `src/lib/sequence-type.ts`: sequences composed only of ACGT (+ IUPAC ambiguity codes) are classified as DNA; everything else is protein. The extended protein alphabet includes X, U, O, B, Z, J plus the canonical 20.

## Important patterns

- **Determinism**: Renderers use `residueHash()` (position + residue character) for reproducible pseudo-randomness. Wang tile tests explicitly verify deterministic output.
- **All rendering is SVG via React elements** — no canvas. Export to PNG uses an offscreen canvas for DPI upscaling.
- **No ESLint/Prettier configured** — TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) is the main code quality gate.
- **Testing**: Vitest with jsdom environment. Tests cover parsing, detection, layout math, API response normalization, and renderer determinism.
