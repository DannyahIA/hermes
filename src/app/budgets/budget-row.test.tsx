import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changeBudgetLimitAction,
  deleteBudgetAction,
} from '@/app/budgets/actions';
import { BudgetRow, type BudgetRowProps } from '@/app/budgets/budget-row';
import { toast } from '@/shared/hooks/use-toast';

vi.mock('@/app/budgets/actions', () => ({
  changeBudgetLimitAction: vi.fn(async () => ({ success: true })),
  deleteBudgetAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/shared/hooks/use-toast', () => ({ toast: vi.fn() }));

const base: BudgetRowProps = {
  budgetId: 'budget-mercado',
  name: 'Mercado',
  color: '#10b981',
  kindLabel: 'Todo mês',
  spent: 400,
  amount: 500,
  status: 'ahead',
  limitDay: '13',
};

function renderRow(props: Partial<BudgetRowProps> = {}) {
  return render(
    <ul>
      <BudgetRow {...base} {...props} />
    </ul>,
  );
}

describe('BudgetRow', () => {
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

  it('shows how much went, the stage, the pace and the day it blows', () => {
    renderRow();

    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('R$ 400,00 de R$ 500,00')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Passou de 75%')).toBeInTheDocument();
    expect(screen.getByText('Acima do ritmo')).toBeInTheDocument();
    expect(screen.getByText('Estoura dia 13')).toBeInTheDocument();
    expect(screen.getByText('Todo mês')).toBeInTheDocument();
  });

  it('names the highest stage reached, and none below 75%', () => {
    const { rerender } = renderRow({ spent: 460 });
    expect(screen.getByText('Passou de 90%')).toBeInTheDocument();

    rerender(
      <ul>
        <BudgetRow {...base} spent={480} />
      </ul>,
    );
    expect(screen.getByText('Passou de 95%')).toBeInTheDocument();

    rerender(
      <ul>
        <BudgetRow
          {...base}
          spent={100}
          status="on-pace"
          limitDay={undefined}
        />
      </ul>,
    );
    expect(screen.queryByText(/^Passou de/)).not.toBeInTheDocument();
    expect(screen.getByText('No ritmo')).toBeInTheDocument();
    expect(screen.queryByText(/Estoura dia/)).not.toBeInTheDocument();
  });

  it('colours the figure and the bar by the share spent', () => {
    const { rerender } = renderRow({ spent: 100, status: 'on-pace' });
    const figure = () => screen.getByText(/^R\$ [\d.,]+ de /);
    const bar = () => screen.getByRole('progressbar').firstElementChild;

    expect(figure()).toHaveClass('text-foreground');
    expect(bar()).toHaveClass('bg-foreground');

    rerender(
      <ul>
        <BudgetRow {...base} spent={400} />
      </ul>,
    );
    expect(figure()).toHaveClass('text-warning-strong');
    expect(bar()).toHaveClass('bg-warning-strong');

    rerender(
      <ul>
        <BudgetRow {...base} spent={500} status="at" limitDay={undefined} />
      </ul>,
    );
    expect(figure()).toHaveClass('text-destructive');
    expect(bar()).toHaveClass('bg-destructive');
  });

  it('turns red past the limit and says by how much', () => {
    renderRow({ spent: 620, status: 'over', limitDay: undefined });

    expect(screen.getByText('R$ 620,00 de R$ 500,00')).toHaveClass(
      'text-destructive',
    );
    expect(screen.getByText('124%')).toBeInTheDocument();
    expect(screen.getByText('Passou do limite')).toBeInTheDocument();
    expect(screen.getByText('R$ 120,00 acima')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('says "No limite" at exactly the limit, red, with no stage or overage', () => {
    renderRow({ spent: 500, status: 'at', limitDay: undefined });

    expect(screen.getByText('No limite')).toBeInTheDocument();
    expect(screen.queryByText('Passou do limite')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Passou de /)).not.toBeInTheDocument();
    expect(screen.queryByText(/acima$/)).not.toBeInTheDocument();
    expect(screen.getByText('R$ 500,00 de R$ 500,00')).toHaveClass(
      'text-destructive',
    );
  });

  it('names the 75% stage and turns to warning at exactly 75%', () => {
    renderRow({ spent: 375, status: 'ahead', limitDay: undefined });

    expect(screen.getByText('Passou de 75%')).toBeInTheDocument();
    expect(screen.getByText('R$ 375,00 de R$ 500,00')).toHaveClass(
      'text-warning-strong',
    );
  });

  it('gives the name its own line with the menu, so a phone does not crush it', () => {
    renderRow({ name: 'Alimentação fora de casa' });

    const name = screen.getByText('Alimentação fora de casa');
    const menu = screen.getByRole('button', { name: /^Ações de / });
    const figure = screen.getByText('R$ 400,00 de R$ 500,00');
    expect(name).toHaveClass('truncate');
    expect(figure.parentElement).toHaveClass('w-full', 'sm:w-auto');
    expect(menu.parentElement).toHaveClass('order-2');
    expect(figure.parentElement).toHaveClass('order-3');
  });

  it('gives an ended budget no pace', () => {
    renderRow({ status: 'ended', kindLabel: 'Encerrado', limitDay: undefined });

    expect(screen.getByText('Encerrado')).toBeInTheDocument();
    expect(screen.queryByText('Acima do ritmo')).not.toBeInTheDocument();
    expect(screen.queryByText('No ritmo')).not.toBeInTheDocument();
  });

  it('changes the limit from the menu and tells so', async () => {
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Mercado' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alterar limite' }));
    fireEvent.change(screen.getByLabelText('Novo limite'), {
      target: { value: '650' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(changeBudgetLimitAction).toHaveBeenCalledWith(
        'budget-mercado',
        650,
      ),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      ),
    );
  });

  it('asks before deleting', async () => {
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Mercado' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(screen.getByText('Excluir orçamento')).toBeInTheDocument();
    expect(deleteBudgetAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() =>
      expect(deleteBudgetAction).toHaveBeenCalledWith('budget-mercado'),
    );
  });
});
