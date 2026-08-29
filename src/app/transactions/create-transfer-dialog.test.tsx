import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateTransferDialog } from '@/app/transactions/create-transfer-dialog';

vi.mock('@/app/transactions/actions', () => ({
  transferMoneyAction: vi.fn(async () => ({ success: true })),
}));

const ACCOUNTS = [
  { id: 'acc-1', name: 'Conta corrente' },
  { id: 'acc-2', name: 'Poupança' },
];

describe('CreateTransferDialog', () => {
  it('mantém as contas mas limpa o valor e a descrição quando "criar mais" está marcado', async () => {
    render(<CreateTransferDialog accounts={ACCOUNTS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Transferência' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma transferência' }),
    );

    const fromSelect = screen.getByLabelText('De');
    const toSelect = screen.getByLabelText('Para');
    fireEvent.change(toSelect, { target: { value: 'acc-2' } });
    const amountInput = screen.getByLabelText('Valor');
    fireEvent.change(amountInput, { target: { value: '100' } });
    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, {
      target: { value: 'Reserva' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(descriptionInput).toHaveValue('');
    // O resync dos selects retidos acontece em um efeito separado, disparado
    // depois do reset nativo do formulário — esperar a mutação real do DOM
    // em vez de assumir que ela já aconteceu no mesmo tick do valor.
    await waitFor(() => expect(fromSelect).toHaveValue('acc-1'));
    await waitFor(() => expect(toSelect).toHaveValue('acc-2'));
  });
});
