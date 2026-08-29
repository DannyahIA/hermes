import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateLoanDialog } from '@/app/loans/create-loan-dialog';

vi.mock('@/app/loans/actions', () => ({
  createLoanAction: vi.fn(async () => ({ success: true })),
}));

const ACCOUNTS = [
  { id: 'acc-1', name: 'Conta corrente' },
  { id: 'acc-2', name: 'Poupança' },
];

describe('CreateLoanDialog', () => {
  it('mantém as contas escolhidas mas limpa a descrição quando "criar mais" está marcado', async () => {
    render(<CreateLoanDialog accounts={ACCOUNTS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Novo empréstimo' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais um empréstimo' }),
    );

    const disbursementSelect = screen.getByLabelText('Conta de recebimento');
    fireEvent.change(disbursementSelect, { target: { value: 'acc-2' } });

    const repaymentSelect = screen.getByLabelText('Conta de pagamento');
    fireEvent.change(repaymentSelect, { target: { value: 'acc-2' } });

    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, { target: { value: 'Carro' } });
    const principalInput = screen.getByLabelText('Valor do principal');
    fireEvent.change(principalInput, {
      target: { value: '1000' },
    });
    const rateInput = screen.getByLabelText('Taxa de juros mensal (%)');
    fireEvent.change(rateInput, {
      target: { value: '2' },
    });
    const installmentInput = screen.getByLabelText('Número de parcelas');
    fireEvent.change(installmentInput, {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar empréstimo' }));

    await waitFor(() => expect(descriptionInput).toHaveValue(''));
    expect(principalInput).toHaveValue(null);
    expect(rateInput).toHaveValue(null);
    expect(installmentInput).toHaveValue(null);
    // O resync dos selects retidos acontece em um efeito separado, disparado
    // depois do reset nativo do formulário — esperar a mutação real do DOM
    // em vez de assumir que ela já aconteceu no mesmo tick da descrição.
    await waitFor(() => expect(disbursementSelect).toHaveValue('acc-2'));
    await waitFor(() => expect(repaymentSelect).toHaveValue('acc-2'));
  });
});
