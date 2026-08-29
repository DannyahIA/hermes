'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

import { createTransactionOrInstallmentAction } from '@/app/transactions/actions';
import { TransactionForm } from '@/app/transactions/transaction-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateTransactionDialogProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

/**
 * Montado uma única vez no `AppShellChrome` (Task 9) — este é o quick-add
 * global de transação, disponível de qualquer lugar do app pelo botão
 * "Nova transação" do header. Também é reaproveitado dentro de
 * `transactions/page.tsx` (Task 9) para o mesmo fluxo específico da página.
 */
export function CreateTransactionDialog({
  accounts,
  categories,
}: CreateTransactionDialogProps) {
  // Sem contas, o dialog não teria nada além do aviso de guarda para
  // mostrar — e `Dialog` não tem um "X" de fechar (só Escape/clique fora),
  // o que deixaria um usuário novo sem affordance visível de saída. Em vez
  // de abrir um dialog sem saída, o gatilho global já aponta direto para o
  // passo que falta.
  if (accounts.length === 0) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3"
        aria-label="Crie uma conta antes de registrar transações"
        asChild
      >
        <Link href="/accounts">
          <Plus className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Criar conta</span>
        </Link>
      </Button>
    );
  }

  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button
          size="icon"
          className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3"
          onClick={open}
          aria-label="Nova transação"
        >
          <Plus className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Nova transação</span>
        </Button>
      )}
      title="Nova transação"
      description="Registre uma receita ou despesa."
      action={createTransactionOrInstallmentAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
