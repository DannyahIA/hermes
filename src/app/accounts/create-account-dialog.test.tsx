import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateAccountDialog } from '@/app/accounts/create-account-dialog';

vi.mock('@/app/accounts/actions', () => ({
  createAccountAction: vi.fn(async () => ({ success: true })),
}));

describe('CreateAccountDialog', () => {
  it('mantém o tipo selecionado mas limpa o nome quando "criar mais" está marcado', async () => {
    render(<CreateAccountDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma conta' }),
    );

    const typeSelect = screen.getByLabelText('Tipo');
    fireEvent.change(typeSelect, { target: { value: 'credit' } });
    const nameInput = screen.getByLabelText('Nome da conta');
    fireEvent.change(nameInput, { target: { value: 'Nubank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(nameInput).toHaveValue(''));
    // O resync do select retido acontece em um efeito separado, disparado
    // depois do reset nativo do formulário — esperar a mutação real do DOM
    // em vez de assumir que ela já aconteceu no mesmo tick do nome.
    await waitFor(() => expect(typeSelect).toHaveValue('credit'));
  });
});
