import './globals.css';

import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Public_Sans } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';
import { APP_DESCRIPTION, APP_NAME } from '@/config/constants';

// Display face — Fraunces carries the "bound ledger" personality (soft,
// ink-like terminals) but is used sparingly: page titles and hero figures
// only, never body copy.
const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
});

// Body/UI face — a precise, form-like sans for everything a person reads
// or clicks: labels, buttons, navigation, paragraphs.
const publicSans = Public_Sans({
  variable: '--font-body',
  subsets: ['latin'],
});

// Every currency figure in the app renders in this — tabular lining
// numerals so amounts line up down a column, like a real ledger page.
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
      className={`${fraunces.variable} ${publicSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
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
