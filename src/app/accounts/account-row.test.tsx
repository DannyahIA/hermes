import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountRow } from '@/app/accounts/account-row';
import { deleteAccountAction } from '@/app/accounts/actions';
import type { AccountLine } from '@/modules/accounts/application/get-money-overview.use-case';

vi.mock('@/app/accounts/actions', () => ({
  archiveAccountAction: vi.fn(async () => ({ success: true })),
  deleteAccountAction: vi.fn(async () => ({ success: true })),
  updateAccountAction: vi.fn(async () => ({ success: true })),
  payCreditCardBillAction: vi.fn(async () => ({ success: true })),
}));

const checking: AccountLine = {
  id: 'account-corrente',
  name: 'Itaú',
  type: 'checking',
  balance: 1500,
  currency: 'BRL',
  archived: false,
  hidden: false,
};

const card: AccountLine = {
  id: 'account-cartao',
  name: 'Nubank',
  type: 'credit',
  balance: 900,
  currency: 'BRL',
  archived: false,
  hidden: false,
  closingDay: 10,
  dueDay: 17,
};

const recent = [
  {
    id: 't1',
    description: 'Padaria Real',
    amount: 18.5,
    type: 'expense' as const,
    occurredAt: new Date(2026, 9, 24, 12).toISOString(),
  },
  {
    id: 't2',
    description: 'Salário',
    amount: 8500,
    type: 'income' as const,
    occurredAt: new Date(2026, 9, 20, 12).toISOString(),
  },
];

const payingAccounts = [{ id: 'account-corrente', name: 'Itaú' }];

describe('AccountRow', () => {
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

  it('opens the account in place with its last transactions and a link to all of them', () => {
    render(
      <ul>
        <AccountRow
          account={checking}
          recent={recent}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    const toggle = screen.getByRole('button', { name: /^Itaú/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Padaria Real')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute(
      'aria-controls',
      screen.getByText('Padaria Real').closest('[id]')?.id,
    );
    expect(screen.getByText('Padaria Real')).toBeInTheDocument();
    expect(screen.getByText('− R$ 18,50')).toBeInTheDocument();
    expect(screen.getByText('+ R$ 8.500,00')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver transações' }),
    ).toHaveAttribute('href', '/transactions?accountId=account-corrente');

    fireEvent.click(toggle);
    expect(screen.queryByText('Padaria Real')).not.toBeInTheDocument();
  });

  it('says so when the account has no transactions yet', () => {
    render(
      <ul>
        <AccountRow
          account={checking}
          recent={[]}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Itaú/ }));
    expect(screen.getByText('Nenhuma transação ainda.')).toBeInTheDocument();
  });

  it('shows the open and the closed bill of a card', () => {
    render(
      <ul>
        <AccountRow
          account={card}
          recent={[]}
          statement={{ open: 400, closed: 500, dueLabel: '17 de nov. de 2026' }}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Nubank/ }));
    expect(screen.getByText('Fatura aberta')).toBeInTheDocument();
    expect(screen.getByText('R$ 400,00')).toBeInTheDocument();
    expect(screen.getByText('Fatura fechada')).toBeInTheDocument();
    expect(screen.getByText('R$ 500,00')).toBeInTheDocument();
    expect(screen.getByText(/vence 17 de nov. de 2026/)).toBeInTheDocument();
  });

  it('offers "Pagar fatura" only on a card', () => {
    const { unmount } = render(
      <ul>
        <AccountRow
          account={checking}
          recent={[]}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Itaú/ }));
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pagar fatura' }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <ul>
        <AccountRow
          account={card}
          recent={[]}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Nubank/ }));
    expect(
      screen.getByRole('button', { name: 'Pagar fatura' }),
    ).toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    render(
      <ul>
        <AccountRow
          account={checking}
          recent={[]}
          payingAccounts={payingAccounts}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Itaú/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Itaú' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(screen.getByText('Excluir conta')).toBeInTheDocument();
    expect(deleteAccountAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() =>
      expect(deleteAccountAction).toHaveBeenCalledWith('account-corrente'),
    );
  });
});
