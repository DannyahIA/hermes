# Fonts for the PDF export

The app's three typefaces (see `src/app/layout.tsx`), as TTF files for
`@react-pdf/renderer`. `next/font` only serves fonts to the browser, so the
server-side PDF renderer needs its own copies.

These are the latin subsets from `@fontsource/*@5.3.0`, converted from WOFF to
TTF. They are TTF because react-pdf's font parser (fontkit) fails on the
IBM Plex Mono WOFF ("Offset is outside the bounds of the DataView"). The latin
subset covers pt-BR accents, the NBSP that `Intl` puts inside "R$ 1,00",
en dashes, and the ↑/↓ arrows used for deltas.

| File                              | Face                                    |
| --------------------------------- | --------------------------------------- |
| `ibm-plex-sans-{400,500,600}.ttf` | IBM Plex Sans: body text                |
| `ibm-plex-mono-{400,500}.ttf`     | IBM Plex Mono: currency figures         |
| `space-grotesk-{500,600}.ttf`     | Space Grotesk: sheet and section titles |

All three are licensed under the SIL Open Font License 1.1; see the
`*-OFL.txt` file for each one.
