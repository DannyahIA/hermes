import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';

vi.mock('@/app/transactions/actions', () => ({
  createTransactionOrInstallmentAction: vi.fn(async () => ({ success: true })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const ACCOUNTS = [
  { id: 'acc-1', name: 'Conta corrente' },
  { id: 'acc-2', name: 'Poupança' },
];
const CATEGORIES = [{ id: 'cat-1', name: 'Alimentação' }];

describe('CreateTransactionDialog', () => {
  it('mantém tipo, conta, categoria e data mas limpa descrição, valor e parcelamento quando "criar mais" está marcado', async () => {
    render(
      <CreateTransactionDialog accounts={ACCOUNTS} categories={CATEGORIES} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma transação' }),
    );

    const typeSelect = screen.getByLabelText('Tipo');
    fireEvent.change(typeSelect, { target: { value: 'income' } });

    const accountSelect = screen.getByLabelText('Conta');
    fireEvent.change(accountSelect, { target: { value: 'acc-2' } });

    const categorySelect = screen.getByLabelText('Categoria');
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    const dateInput = screen.getByLabelText('Data');
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } });

    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByLabelText('Valor'), {
      target: { value: '50' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar transação' }),
    );

    await waitFor(() => expect(descriptionInput).toHaveValue(''));
    // O reset do valor é aplicado em um efeito separado, disparado depois do
    // reset nativo do formulário — esperar a mutação real do DOM em vez de
    // assumir que ela já aconteceu no mesmo tick da descrição.
    await waitFor(() =>
      expect(screen.getByLabelText('Valor')).toHaveValue(null),
    );

    // Campos retidos sobrevivem ao "criar mais".
    expect(typeSelect).toHaveValue('income');
    expect(accountSelect).toHaveValue('acc-2');
    expect(categorySelect).toHaveValue('cat-1');
    expect(dateInput).toHaveValue('2026-01-15');

    // Campos limpos: parcelamento.
    expect(
      screen.queryByRole('checkbox', { name: 'Parcelar' }),
    ).not.toBeInTheDocument();

    // Foco volta para o próximo campo a preencher (digitação rápida em
    // sequência).
    expect(descriptionInput).toHaveFocus();
  });

  it('envia "installments=true" quando parcelamento está ativo', async () => {
    const { createTransactionOrInstallmentAction } =
      await import('@/app/transactions/actions');
    render(
      <CreateTransactionDialog accounts={ACCOUNTS} categories={CATEGORIES} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Notebook' },
    });
    fireEvent.change(screen.getByLabelText('Valor'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByLabelText('Parcelar'));
    fireEvent.change(screen.getByLabelText('Número de parcelas'), {
      target: { value: '10' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar parcelamento' }),
    );

    await waitFor(() =>
      expect(createTransactionOrInstallmentAction).toHaveBeenCalled(),
    );
    const formData = vi.mocked(createTransactionOrInstallmentAction).mock
      .calls[0][1] as FormData;
    expect(formData.get('installments')).toBe('true');
  });

  it('desmarca "Parcelar" e some com o número de parcelas depois de "criar mais"', async () => {
    render(
      <CreateTransactionDialog accounts={ACCOUNTS} categories={CATEGORIES} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma transação' }),
    );

    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Notebook' },
    });
    fireEvent.change(screen.getByLabelText('Valor'), {
      target: { value: '3000' },
    });
    const installmentsCheckbox = screen.getByLabelText('Parcelar');
    fireEvent.click(installmentsCheckbox);
    fireEvent.change(screen.getByLabelText('Número de parcelas'), {
      target: { value: '10' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar parcelamento' }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Descrição')).toHaveValue(''),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Parcelar')).not.toBeChecked(),
    );
    // "Tipo" permanece "Despesa" (retido), então a seção de parcelamento
    // continua visível — mas desmarcada e sem o campo de número de parcelas.
    expect(
      screen.queryByLabelText('Número de parcelas'),
    ).not.toBeInTheDocument();
  });
});
