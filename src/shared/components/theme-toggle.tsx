'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'hermes-theme';

/**
 * Persists the choice in localStorage and flips the `.dark` class the
 * blocking script in `app/layout.tsx` already applies on first paint — this
 * component only needs to keep it in sync after a user click.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Syncing from an external system (the DOM class the blocking script in
    // app/layout.tsx set before hydration) is exactly what effects are for —
    // there's no way to read it during render without risking a hydration
    // mismatch, since the server has no DOM to check against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
