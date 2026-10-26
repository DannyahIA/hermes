'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hermes-theme';

/**
 * Persists the choice in localStorage and flips the `.dark` class the
 * blocking script in `app/layout.tsx` already applies on first paint — this
 * hook only needs to keep it in sync after a user choice.
 */
export function useTheme(): { isDark: boolean; toggle: () => void } {
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

  return { isDark, toggle };
}
