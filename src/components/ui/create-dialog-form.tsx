'use client';

import * as React from 'react';

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';

export interface CreateDialogFormRenderArgs<State> {
  state: State;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  close: () => void;
}

export interface CreateDialogFormProps<State extends { success: boolean }> {
  /** Render-prop: recebe `open` para o chamador conectar ao próprio botão
   * (o botão pode viver em lugares diferentes — cabeçalho de página, estado
   * vazio, header global — sem duplicar o estado do dialog). */
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  children: (args: CreateDialogFormRenderArgs<State>) => React.ReactNode;
}

/**
 * A base de todo fluxo de "criar X": um gatilho que abre um `Dialog` sob
 * demanda (em vez de o formulário ocupar espaço fixo na página), mais um
 * toggle opcional "Criar mais" que, quando marcado, mantém o dialog aberto
 * após um envio bem-sucedido em vez de fechá-lo, para lançar vários
 * registros em sequência sem reabrir o dialog toda vez.
 *
 * Compõe `DialogForm` em vez de alterá-lo — dialogs de edição, que nunca
 * precisam de "criar mais", continuam exatamente como estavam. Decidir
 * quais campos sobrevivem a um "criar mais" e quais são limpos é
 * responsabilidade de cada formulário-filho (ver `TransactionForm`); este
 * componente só decide se o *dialog* continua aberto, reaproveitando o
 * `closeOnSuccess` que `DialogForm` já expõe.
 */
export function CreateDialogForm<State extends { success: boolean }>({
  trigger,
  title,
  description,
  action,
  initialState,
  children,
}: CreateDialogFormProps<State>) {
  const [open, setOpen] = React.useState(false);
  const [repeating, setRepeating] = React.useState(false);

  function openDialog() {
    // "Criar mais" nunca começa marcado — decisão explícita do usuário
    // (sem persistência entre aberturas).
    setRepeating(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      {trigger(openDialog)}
      <DialogForm
        open={open}
        onOpenChange={setOpen}
        action={action}
        initialState={initialState}
        closeOnSuccess={!repeating}
      >
        {({ state, formAction }) => (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? (
                <DialogDescription>{description}</DialogDescription>
              ) : null}
            </DialogHeader>
            {children({
              state,
              formAction,
              repeating,
              onRepeatingChange: setRepeating,
              close,
            })}
          </>
        )}
      </DialogForm>
    </>
  );
}

export interface RepeatToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** O checkbox "Criar mais" que todo formulário de criação renderiza dentro
 * do seu próprio `DialogFooter` — compartilhado para que tenha a mesma
 * aparência e comportamento em todo lugar (ui-ux.md: "elementos iguais
 * devem sempre possuir o mesmo comportamento"). */
export function RepeatToggle({ checked, onChange, label }: RepeatToggleProps) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="border-input h-4 w-4 rounded"
      />
      {label}
    </label>
  );
}
