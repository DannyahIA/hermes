'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type ActionResult,
  createImportAction,
} from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';

const INITIAL_STATE: ActionResult = { success: false };

/**
 * Imports transactions from a CSV in the same shape `/api/transactions/export`
 * produces. The summary ("N importadas, M ignoradas") is surfaced through
 * the toast system rather than inline, since it isn't a form field error.
 */
export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createImportAction, INITIAL_STATE);
  const lastState = useRef(INITIAL_STATE);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;

    if (state.message) {
      toast({
        title: state.message,
        variant: state.success ? 'success' : 'error',
      });
    }
  }, [state]);

  if (state.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Importar CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Importar transações</DialogTitle>
          <DialogDescription>
            Envie um CSV no formato exportado (Data, Descrição, Conta,
            Categoria, Tipo, Valor). Conta e categoria são casadas pelo nome.
            Transferências não são importadas.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state.error && (
            <Alert variant="error">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="import-file">
              Arquivo CSV
            </label>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className={FIELD_BASE_CLASSES}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Importando…' : 'Importar'}
    </Button>
  );
}
