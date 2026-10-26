import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteLoanAction } from '@/app/loans/actions';
import { LoanRow } from '@/app/loans/loan-card';
import { toast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/format-currency';

vi.mock('@/app/loans/actions', () => ({
  deleteLoanAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/shared/hooks/use-toast', () => ({ toast: vi.fn() }));

const base = {
  id: 'loan-carro',
  description: 'Financiamento do carro',
  principal: 25000,
  monthlyInterestRate: 0.02,
  installmentCount: 16,
  paidCount: 3,
  currency: 'BRL',
};

/** Matches an element by its exact text, however the currency spaces it. */
function withText(text: string) {
  return (_content: string, element: Element | null) =>
    element?.children.length === 0 && element.textContent === text;
}

function renderRow(props: Partial<typeof base> = {}) {
  return render(
    <ul>
      <LoanRow {...base} {...props} />
    </ul>,
  );
}

describe('LoanRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no popover API; the menu closes itself through it.
    for (const method of [
      'showPopover',
      'hidePopover',
      'togglePopover',
    ] as const) {
      Object.defineProperty(HTMLElement.prototype, method, {
        value: vi.fn(),
        configurable: true,
      });
    }
  });

  it('shows the rate, the installment, what is paid and what is left', () => {
    renderRow();

    expect(screen.getByText('Financiamento do carro')).toBeInTheDocument();
    expect(screen.getByText('2% ao mês')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s1\.841,25/)).toBeInTheDocument();
    expect(
      screen.getByText(withText(`Pago ${formatCurrency(5523.75)}`)),
    ).toBeVisible();
    expect(
      screen.getByText(withText(`Falta ${formatCurrency(23936.29)}`)),
    ).toBeVisible();
    expect(screen.getByText('13 parcelas restantes')).toBeInTheDocument();
    expect(screen.getByText('3 de 16 parcelas')).toBeInTheDocument();
  });

  it('says what the loan costs in all, and how much of it is interest', () => {
    renderRow();

    expect(
      screen.getByText(
        withText(
          `Custo total ${formatCurrency(29460.04)} (${formatCurrency(4460.04)} de juros)`,
        ),
      ),
    ).toBeInTheDocument();
  });

  it('shows a fractional rate with its decimals', () => {
    renderRow({ monthlyInterestRate: 0.0199 });

    expect(screen.getByText('1,99% ao mês')).toBeInTheDocument();
  });

  it('speaks of one installment in the singular, and of a settled loan as such', () => {
    const { rerender } = renderRow({ paidCount: 15 });
    expect(screen.getByText('1 parcela restante')).toBeInTheDocument();

    rerender(
      <ul>
        <LoanRow {...base} paidCount={16} />
      </ul>,
    );
    expect(screen.getByText('Quitado')).toBeInTheDocument();
  });

  it('gives the name its own line with the menu, so a phone does not crush it', () => {
    renderRow({ description: 'Financiamento do carro da família inteira' });

    const name = screen.getByText('Financiamento do carro da família inteira');
    const menu = screen.getByRole('button', { name: /^Ações de / });
    const rate = screen.getByText('2% ao mês');
    expect(name).toHaveClass('truncate');
    expect(rate.parentElement).toHaveClass('w-full', 'sm:w-auto');
    expect(menu.parentElement).toHaveClass('order-2');
    expect(rate.parentElement).toHaveClass('order-3');
  });

  it('shows the amortization schedule behind a toggle', () => {
    renderRow();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: 'Ver parcelas detalhadas',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ocultar parcelas' }),
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar parcelas' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('asks before deleting, then tells so', async () => {
    renderRow();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ações de Financiamento do carro' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(screen.getByText('Excluir empréstimo')).toBeInTheDocument();
    expect(deleteLoanAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() =>
      expect(deleteLoanAction).toHaveBeenCalledWith('loan-carro'),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      ),
    );
  });
});
