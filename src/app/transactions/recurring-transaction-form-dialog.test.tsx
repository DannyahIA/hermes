import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecurringTransactionFormDialog } from '@/app/transactions/recurring-transaction-form-dialog';

vi.mock('@/app/transactions/recurring-actions', () => ({
  createRecurringTransactionAction: vi.fn(async () => ({ success: true })),
}));

const ACCOUNTS = [
  { id: 'acc-1', name: 'Conta corrente' },
  { id: 'acc-2', name: 'Poupança' },
];
const CATEGORIES = [{ id: 'cat-1', name: 'Salário' }];

describe('RecurringTransactionFormDialog', () => {
  it('não vem com "criar mais" marcado ao abrir', () => {
    render(
      <RecurringTransactionFormDialog
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }));

    expect(
      screen.getByRole('checkbox', { name: 'Criar mais uma recorrência' }),
    ).not.toBeChecked();
  });

  it('mantém conta, categoria, tipo, regra de repetição e data de início, mas limpa descrição e valor quando "criar mais" está marcado', async () => {
    render(
      <RecurringTransactionFormDialog
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma recorrência' }),
    );

    const descriptionInput = screen.getByLabelText('Descrição');
    const typeSelect = screen.getByLabelText('Tipo');
    const amountInput = screen.getByLabelText('Valor');
    const accountSelect = screen.getByLabelText('Conta');
    const categorySelect = screen.getByLabelText('Categoria');
    const dayRuleKindSelect = screen.getByLabelText('Repete');
    const startDateInput = screen.getByLabelText('Começa em');

    fireEvent.change(descriptionInput, { target: { value: 'Salário' } });
    fireEvent.change(typeSelect, { target: { value: 'income' } });
    fireEvent.change(amountInput, { target: { value: '5000' } });
    fireEvent.change(accountSelect, { target: { value: 'acc-2' } });
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });
    fireEvent.change(dayRuleKindSelect, {
      target: { value: 'first_business_day' },
    });
    fireEvent.change(startDateInput, { target: { value: '2026-09-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar recorrência' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(descriptionInput).toHaveValue('');
    expect(typeSelect).toHaveValue('income');
    expect(accountSelect).toHaveValue('acc-2');
    expect(categorySelect).toHaveValue('cat-1');
    expect(dayRuleKindSelect).toHaveValue('first_business_day');
    expect(startDateInput).toHaveValue('2026-09-01');
  });

  it('mantém o dia do mês quando a regra é "todo dia fixo do mês" e "criar mais" está marcado', async () => {
    render(
      <RecurringTransactionFormDialog
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma recorrência' }),
    );

    const descriptionInput = screen.getByLabelText('Descrição');
    const amountInput = screen.getByLabelText('Valor');
    const dayRuleKindSelect = screen.getByLabelText('Repete');
    // Já parte do valor default 'fixed_day', mas garante explicitamente que
    // o campo "Dia do mês" está visível antes de preenchê-lo.
    expect(dayRuleKindSelect).toHaveValue('fixed_day');
    const dayRuleDayInput = screen.getByLabelText('Dia do mês');

    fireEvent.change(descriptionInput, { target: { value: 'Aluguel' } });
    fireEvent.change(amountInput, { target: { value: '1500' } });
    fireEvent.change(dayRuleDayInput, { target: { value: '15' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar recorrência' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(descriptionInput).toHaveValue('');
    expect(screen.getByLabelText('Dia do mês')).toHaveValue(15);
  });
});
