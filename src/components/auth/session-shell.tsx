import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface SessionShellProps {
  children: React.ReactNode;
}

export function SessionShell({ children }: SessionShellProps) {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-border/70 bg-background/70 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Hermes
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
