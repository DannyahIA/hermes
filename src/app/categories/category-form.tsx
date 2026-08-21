'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import type { ActionResult } from '@/app/categories/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const INITIAL_STATE: ActionResult = { success: false };

export interface CategoryFormValues {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface CategoryFormProps {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  initialValues?: CategoryFormValues;
  submitLabel: string;
  onSuccess?: () => void;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? 'Salvando...' : label}
    </Button>
  );
}

export function CategoryForm({
  action,
  initialValues,
  submitLabel,
  onSuccess,
}: CategoryFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const successCountRef = useRef(0);

  useEffect(() => {
    if (state.success) {
      successCountRef.current += 1;
      formRef.current?.reset();
      onSuccess?.();
    }
    // onSuccess is intentionally excluded: it may be a fresh closure each
    // render and we only want to react to a new successful submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}

      <div className="space-y-2">
        <label htmlFor="name" className="text-muted-foreground text-sm">
          Nome
        </label>
        <Input
          id="name"
          name="name"
          placeholder="Alimentação"
          defaultValue={initialValues?.name}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-muted-foreground text-sm">
          Descrição
        </label>
        <Textarea
          id="description"
          name="description"
          placeholder="Opcional"
          defaultValue={initialValues?.description}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="color" className="text-muted-foreground text-sm">
          Cor
        </label>
        <Input
          id="color"
          name="color"
          type="color"
          className="h-11 w-20 cursor-pointer p-1"
          defaultValue={initialValues?.color ?? '#64748b'}
        />
      </div>

      {state.error ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
