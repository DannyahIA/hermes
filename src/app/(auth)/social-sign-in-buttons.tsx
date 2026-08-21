'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { authClient } from '@/infra/auth/client';

interface SocialSignInButtonsProps {
  google: boolean;
  github: boolean;
  redirectTo?: string;
}

/**
 * Renders only the providers actually configured server-side (see
 * `config/env.ts`'s `isGoogleAuthConfigured`/`isGithubAuthConfigured`) —
 * the page passes those flags in as props since env vars aren't available
 * in the browser bundle. Renders nothing if neither is configured.
 */
export function SocialSignInButtons({
  google,
  github,
  redirectTo,
}: SocialSignInButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingProvider, setPendingProvider] = useState<
    'google' | 'github' | null
  >(null);

  if (!google && !github) return null;

  function signInWith(provider: 'google' | 'github') {
    setPendingProvider(provider);
    startTransition(async () => {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo ?? ROUTES.dashboard,
      });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {google && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => signInWith('google')}
          >
            {isPending && pendingProvider === 'google'
              ? 'Conectando…'
              : 'Continuar com Google'}
          </Button>
        )}
        {github && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => signInWith('github')}
          >
            {isPending && pendingProvider === 'github'
              ? 'Conectando…'
              : 'Continuar com GitHub'}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="border-border h-px flex-1 border-t" />
        <span className="text-muted-foreground text-xs uppercase">ou</span>
        <div className="border-border h-px flex-1 border-t" />
      </div>
    </div>
  );
}
