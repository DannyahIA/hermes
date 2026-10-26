import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/shared/hooks/use-toast';

describe('Toaster', () => {
  it('announces a success politely and an error assertively', () => {
    render(<Toaster />);

    act(() => {
      toast({ title: 'Conta arquivada.', variant: 'success' });
      toast({ title: 'Não foi possível excluir.', variant: 'error' });
    });

    expect(screen.getByRole('status')).toHaveTextContent('Conta arquivada.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível excluir.',
    );

    for (const button of screen.getAllByRole('button', {
      name: 'Fechar notificação',
    })) {
      fireEvent.click(button);
    }
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('runs its action once and goes away', () => {
    const undo = vi.fn();
    render(<Toaster />);

    act(() => {
      toast({
        title: 'Transação excluída.',
        variant: 'default',
        action: { label: 'Desfazer', onClick: undo },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Transação excluída.')).toBeNull();
  });
});
