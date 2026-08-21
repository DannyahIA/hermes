'use client';

import { useState, useTransition } from 'react';

import { resendVerificationEmailAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/shared/hooks/use-toast';

export function ResendVerificationButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <Button
      className="w-full"
      disabled={isPending || sent}
      onClick={() =>
        startTransition(async () => {
          const result = await resendVerificationEmailAction(email);
          if (result.success) {
            setSent(true);
            toast({ title: 'E-mail reenviado.', variant: 'success' });
          } else {
            toast({
              title: result.error ?? 'Não foi possível reenviar.',
              variant: 'error',
            });
          }
        })
      }
    >
      {sent ? 'E-mail reenviado' : isPending ? 'Enviando…' : 'Reenviar e-mail'}
    </Button>
  );
}
