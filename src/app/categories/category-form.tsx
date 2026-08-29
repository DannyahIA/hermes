'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import type { ActionResult } from '@/app/categories/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CategoryFormProps {
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

/**
 * Nenhum campo de categoria sobrevive a um "criar mais" — cada categoria é
 * conceitualmente única (ver a tabela de retenção no spec), então o único
 * trabalho extra aqui além de renderizar os campos é resetar o formulário e
 * devolver o foco ao nome, para digitação rápida em sequência. O reset roda
 * em um `useEffect` (após o commit), não durante o render — mesma convenção
 * de `DialogForm` (ver seu comentário sobre efeitos pós-sucesso).
 */
export function CategoryForm({
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: CategoryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
    // Reage a toda mudança genuína de estado (um novo resultado de action é
    // sempre uma nova referência de objeto), não apenas a uma transição para
    // sucesso.
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-muted-foreground text-sm">
          Nome
        </label>
        <Input
          id="name"
          name="name"
          ref={nameRef}
          placeholder="Alimentação"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-muted-foreground text-sm">
          Descrição
        </label>
        <Textarea id="description" name="description" placeholder="Opcional" />
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
          defaultValue="#64748b"
        />
      </div>

      {state.error ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma categoria"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? 'Salvando...' : 'Criar categoria'}
    </Button>
  );
}
