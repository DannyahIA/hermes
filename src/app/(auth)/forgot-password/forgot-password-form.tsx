'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type AuthActionState,
  requestPasswordResetAction,
} from '@/app/(auth)/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL_STATE: AuthActionState = { success: false };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    INITIAL_STATE,
  );

  if (state.success) {
    return (
      <Alert variant="success">
        <AlertDescription>
          Se esse e-mail estiver cadastrado, você receberá um link de
          recuperação em instantes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email}
          placeholder="voce@exemplo.com"
        />
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar link de recuperação'}
    </Button>
  );
}
