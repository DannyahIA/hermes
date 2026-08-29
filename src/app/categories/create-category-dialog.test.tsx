import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateCategoryDialog } from '@/app/categories/create-category-dialog';

vi.mock('@/app/categories/actions', () => ({
  createCategoryAction: vi.fn(async () => ({ success: true })),
}));

describe('CreateCategoryDialog', () => {
  it('limpa todos os campos e mantém o foco pronto para a próxima categoria quando "criar mais" está marcado', async () => {
    render(<CreateCategoryDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma categoria' }),
    );

    const nameInput = screen.getByLabelText('Nome');
    fireEvent.change(nameInput, { target: { value: 'Mercado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

    await waitFor(() => expect(nameInput).toHaveValue(''));
    expect(nameInput).toHaveFocus();
    expect(
      screen.getByRole('heading', { name: 'Nova categoria' }),
    ).toBeInTheDocument();
  });
});
