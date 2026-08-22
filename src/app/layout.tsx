import './globals.css';

import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';
import { APP_DESCRIPTION, APP_NAME } from '@/config/constants';

// Display face — Space Grotesk carries the drafting-table personality (a
// geometric grotesk with a technical, instrument-panel character) but is
// used sparingly: page titles and hero figures only, never body copy.
const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
});

// Body/UI face — IBM Plex Sans, drawn from the same technical type family
// as the mono figures below, for everything a person reads or clicks:
// labels, buttons, navigation, paragraphs.
const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

// Every currency figure in the app renders in this — tabular lining
// numerals so amounts line up down a column, like a dimensioned drawing's
// measurements read in sequence.
const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ledger-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

// Runs before hydration to apply the stored theme without a flash of the
// wrong palette. Kept minimal and inlined — this is the one place a script
// tag is justified, since it must run before first paint.
const THEME_INIT_SCRIPT = `
  try {
    var stored = localStorage.getItem('hermes-theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col font-sans"
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
