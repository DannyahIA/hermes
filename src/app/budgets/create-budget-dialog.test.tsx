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
    fireEvent.click(screen.getByRole('radio', { name: 'Por prazo' }));

    const startInput = screen.getByLabelText('De');
    const endInput = screen.getByLabelText('Até');
    fireEvent.change(startInput, { target: { value: '2026-08-01' } });
    fireEvent.change(endInput, { target: { value: '2026-08-31' } });

    const amountInput = screen.getByLabelText('Valor do orçamento');
    fireEvent.change(amountInput, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(startInput).toHaveValue('2026-08-01');
    expect(endInput).toHaveValue('2026-08-31');
  });

  it('asks for dates only when "Por prazo" is chosen', () => {
    render(<CreateBudgetDialog categories={CATEGORIES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo orçamento' }));

    expect(screen.getByRole('radio', { name: 'Todo mês' })).toBeChecked();
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Até')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Por prazo' }));

    expect(screen.getByLabelText('De')).toBeRequired();
    expect(screen.getByLabelText('Até')).toBeRequired();

    fireEvent.click(screen.getByRole('radio', { name: 'Todo mês' }));

    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
  });
});
