import { useId } from 'react';
import { useFormStatus } from 'react-dom';

import type { ActionResult } from '@/app/categories/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const DEFAULT_COLOR = '#94a3b8';

interface RenameFormProps {
  id: string;
  name: string;
  color?: string;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}

/** The "Renomear e cor" dialog's form: posts the id, name and color to `updateCategoryAction`. */
export function RenameForm({
  id,
  name,
  color,
  state,
  formAction,
  onCancel,
}: RenameFormProps) {
  const fieldId = useId();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Renomear e cor</DialogTitle>
        <DialogDescription>
          Altere o nome ou a cor da categoria.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={id} />

        {state.error && (
          <Alert variant="error">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label
            htmlFor={`${fieldId}-name`}
            className="text-muted-foreground text-sm"
          >
            Nome
          </label>
          <Input
            id={`${fieldId}-name`}
            name="name"
            defaultValue={name}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`${fieldId}-color`}
            className="text-muted-foreground text-sm"
          >
            Cor
          </label>
          <Input
            id={`${fieldId}-color`}
            name="color"
            type="color"
            className="h-11 w-20 cursor-pointer p-1"
            defaultValue={color ?? DEFAULT_COLOR}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </DialogFooter>
      </form>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar'}
    </Button>
  );
}
