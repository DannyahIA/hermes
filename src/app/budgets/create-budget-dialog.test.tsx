import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';

vi.mock('@/app/budgets/actions', () => ({
  createBudgetAction: vi.fn(async () => ({ success: true })),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Alimentação' },
  { id: 'cat-2', name: 'Transporte' },
];

describe('CreateBudgetDialog', () => {
  it('mantém o período mas limpa o valor quando "criar mais" está marcado', async () => {
    render(<CreateBudgetDialog categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole('button', { name: 'Novo orçamento' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais um orçamento' }),
    );

    const startInput = screen.getByLabelText('Início do período');
    const endInput = screen.getByLabelText('Fim do período');
    fireEvent.change(startInput, { target: { value: '2026-08-01' } });
    fireEvent.change(endInput, { target: { value: '2026-08-31' } });

    const amountInput = screen.getByLabelText('Valor do orçamento');
    fireEvent.change(amountInput, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(startInput).toHaveValue('2026-08-01');
    expect(endInput).toHaveValue('2026-08-31');
  });
});
