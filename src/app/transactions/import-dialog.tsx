'use client';

import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

import {
  confirmImportAction,
  type ImportPreviewRow,
  type ImportPreviewState,
  previewImportAction,
} from '@/app/transactions/actions';
import { ImportPreviewTable } from '@/app/transactions/import-preview-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';

const INITIAL_STATE: ImportPreviewState = { success: false };

/**
 * Two-step CSV import: step 1 uploads and validates the file
 * (`previewImportAction`) without persisting anything; step 2 renders the
 * parsed rows in `ImportPreviewTable` for the user to review/uncheck
 * possible duplicates, then persists only the checked rows
 * (`confirmImportAction`). `DialogForm`'s `closeOnSuccess={false}` keeps the
 * dialog open when the preview step succeeds, since "success" there means
 * "preview ready," not "done" — the dialog only closes once the confirm
 * step actually succeeds.
 */
export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[] | null>(
    null,
  );
  const [isConfirming, startConfirming] = useTransition();

  function handleConfirm(selectedRows: ImportPreviewRow[]) {
    startConfirming(async () => {
      const result = await confirmImportAction(selectedRows);
      toast({
        title:
          result.message ??
          (result.success
            ? 'Importação concluída.'
            : (result.error ?? 'Erro ao importar.')),
        variant: result.success ? 'success' : 'error',
      });
      if (result.success) {
        setOpen(false);
        setPreviewRows(null);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setPreviewRows(null);
          setOpen(true);
        }}
      >
        Importar CSV
      </Button>
      <DialogForm
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPreviewRows(null);
        }}
        action={previewImportAction}
        initialState={INITIAL_STATE}
        closeOnSuccess={false}
        onSuccess={(state) => {
          if (state.rows) setPreviewRows(state.rows);
        }}
      >
        {({ state, formAction }) =>
          previewRows ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar importação</DialogTitle>
                <DialogDescription>
                  Revise as linhas antes de confirmar.
                </DialogDescription>
              </DialogHeader>
              <ImportPreviewTable
                rows={previewRows}
                onConfirm={handleConfirm}
                onCancel={() => setPreviewRows(null)}
                isConfirming={isConfirming}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Importar transações</DialogTitle>
                <DialogDescription>
                  Envie um CSV no formato exportado (Data, Descrição, Conta,
                  Categoria, Tipo, Valor). Conta e categoria são casadas pelo
                  nome. Transferências não são importadas.
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
            </>
          )
        }
      </DialogForm>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Analisando…' : 'Avançar'}
    </Button>
  );
}
