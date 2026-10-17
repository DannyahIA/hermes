import path from 'node:path';

import { Font, StyleSheet } from '@react-pdf/renderer';

/*
 * The PDF is the one place the "Prancheta" metaphor (see globals.css) stops
 * being a metaphor: the export is laid out as an actual drawing sheet.
 *
 * Colors are literal hex rather than the app's CSS variables — a PDF has no
 * stylesheet or theme to resolve them against. They are the light-mode
 * tokens, on white paper instead of --background's pale blue because a
 * printer can't bleed a tint to the edge anyway.
 */
export const INK = {
  paper: '#ffffff',
  /** --foreground */
  text: '#12233d',
  /** --primary: the blueline the frame, title block and income are drawn in. */
  blueline: '#1d4e89',
  /** --destructive: redline, for expense, deficit and over-budget. */
  redline: '#b23a2c',
  /** --muted-foreground */
  graphite: '#5a7185',
  /** --border: construction lines (row rules, chart baselines). */
  construction: '#b8cedd',
  /** --muted: the unfilled track of a meter. */
  track: '#e5edf3',
  /** --ring / --warning: registration marks and the 80–100% budget band only. */
  amber: '#e8a23d',
} as const;

/*
 * The app's own three faces (see app/layout.tsx). next/font only serves
 * them to the browser, so the PDF renderer reads its own TTF copies — see
 * ./fonts/README.md for where they come from and why they're TTF.
 */
const FONT_DIR = path.join(
  process.cwd(),
  'src/modules/reports/infra/pdf/fonts',
);

function registerFamily(name: string, file: string, weights: number[]) {
  Font.register({
    family: name,
    fonts: weights.map((weight) => ({
      src: path.join(FONT_DIR, `${file}-${weight}.ttf`),
      fontWeight: weight,
    })),
  });
}

registerFamily('IBM Plex Sans', 'ibm-plex-sans', [400, 500, 600]);
registerFamily('IBM Plex Mono', 'ibm-plex-mono', [400, 500]);
registerFamily('Space Grotesk', 'space-grotesk', [500, 600]);

// react-pdf hyphenates with English rules by default, which splits
// Portuguese words in the wrong places — wrap on whole words instead.
Font.registerHyphenationCallback((word) => [word]);

export const FONT = {
  /** Everything a person reads: labels, captions, table text. */
  body: 'IBM Plex Sans',
  /** Every currency figure, so amounts line up down a column. */
  figure: 'IBM Plex Mono',
  /** Sheet title and section headings only. */
  display: 'Space Grotesk',
} as const;

/** Point sizes, stepped on the classic typographic scale. */
export const TYPE = {
  label: 7,
  caption: 8,
  body: 9,
  heading: 11,
  figure: 12,
  title: 16,
} as const;

const MM = 72 / 25.4;
const A4_WIDTH = 595.28;

/*
 * ISO 5457 sheet margins: 20 mm on the left is the filing margin (room to
 * punch or bind a printed copy), 10 mm everywhere else. That leaves a frame
 * exactly 180 mm wide — the width ISO 7200 gives a title block, so the
 * title block spans the whole bottom of an A4 portrait sheet.
 */
export const SHEET = {
  filingMargin: 20 * MM,
  margin: 10 * MM,
  titleBlockHeight: 56,
  /** Clear space between the frame and the content. */
  gutter: 18,
} as const;

export const CONTENT_WIDTH =
  A4_WIDTH - SHEET.filingMargin - SHEET.margin - SHEET.gutter * 2;

/** Width of one column when a row holds two views side by side. */
export const COLUMN_GAP = 20;
export const HALF_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2;

export const textStyles = StyleSheet.create({
  heading: {
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: TYPE.heading,
    color: INK.text,
  },
  caption: {
    fontSize: TYPE.caption,
    color: INK.graphite,
    lineHeight: 1.4,
  },
  label: {
    fontSize: TYPE.label,
    color: INK.graphite,
  },
  figure: {
    fontFamily: FONT.figure,
    fontSize: TYPE.body,
    color: INK.text,
  },
  empty: {
    fontSize: TYPE.body,
    color: INK.graphite,
    lineHeight: 1.4,
  },
});
