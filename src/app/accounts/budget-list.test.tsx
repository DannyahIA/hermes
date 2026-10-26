import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BudgetList } from '@/app/accounts/budget-list';
import type { BudgetRowProps } from '@/app/budgets/budget-row';

vi.mock('@/app/budgets/actions', () => ({
  changeBudgetLimitAction: vi.fn(async () => ({ success: true })),
  deleteBudgetAction: vi.fn(async () => ({ success: true })),
}));

function row(budgetId: string, name: string, status: BudgetRowProps['status']) {
  return {
    budgetId,
    name,
    color: '#10b981',
    kindLabel: status === 'ended' ? 'Encerrado' : 'Todo mês',
    spent: 100,
    amount: 500,
    status,
  } satisfies BudgetRowProps;
}

describe('BudgetList', () => {
  it('keeps an ended budget at the end, collapsed', () => {
    render(
      <BudgetList
        running={[row('a', 'Mercado', 'on-pace')]}
        ended={[row('b', 'Viagem', 'ended'), row('c', 'Reforma', 'ended')]}
      />,
    );

    expect(screen.getByText('Mercado')).toBeVisible();
    const summary = screen.getByText('Encerrados (2)');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(
      within(details as HTMLElement).getByText('Viagem'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Mercado').compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no "Encerrados" when none ended', () => {
    render(
      <BudgetList running={[row('a', 'Mercado', 'on-pace')]} ended={[]} />,
    );

    expect(screen.queryByText(/Encerrados/)).not.toBeInTheDocument();
  });

  it('says how much the installments are of the month, only above zero', () => {
    const { rerender } = render(
      <BudgetList
        running={[row('a', 'Mercado', 'on-pace')]}
        ended={[]}
        installmentsLabel="Parcelas de novembro: R$ 320,00"
      />,
    );
    expect(
      screen.getByText('Parcelas de novembro: R$ 320,00'),
    ).toBeInTheDocument();

    rerender(
      <BudgetList running={[row('a', 'Mercado', 'on-pace')]} ended={[]} />,
    );
    expect(screen.queryByText(/Parcelas de/)).not.toBeInTheDocument();
  });
});
