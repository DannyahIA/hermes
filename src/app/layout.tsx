import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';
import { APP_DESCRIPTION, APP_NAME } from '@/config/constants';

// One family for the whole interface, like the system font it stands in
// for: Inter is the closest freely-licensed match to SF Pro. Hierarchy comes
// from size, weight and tracking, not from a second typeface. Currency
// figures use the same face with tabular numerals (`.dimension-figure`).
const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

// The browser chrome takes the window colour (--background in globals.css);
// a meta tag can't read a CSS variable, so the two values are repeated here.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#101010' },
  ],
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
      className={`${inter.variable} h-full antialiased`}
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
