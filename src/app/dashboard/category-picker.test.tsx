import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryPicker } from './category-picker';

const essenciais = {
  id: '0f8c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
  name: 'Essenciais',
};
const onPick = vi.fn();
const onCreate = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

describe('CategoryPicker', () => {
  it('offers the missing category first, and creates it with one tap', () => {
    render(
      <CategoryPicker
        subject="Drogasil"
        suggestions={[essenciais]}
        categories={[essenciais]}
        newCategory={{ key: 'saude', name: 'Saúde', color: '#ef4444' }}
        onPick={onPick}
        onCreate={onCreate}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Saúde');
    expect(buttons[0]).toHaveTextContent('nova');
    fireEvent.click(buttons[0]);
    expect(onCreate).toHaveBeenCalledWith('Saúde', '#ef4444');
  });

  it('creates a category typed under "Outra…"', () => {
    render(
      <CategoryPicker
        subject="Petz"
        suggestions={[]}
        categories={[essenciais]}
        onPick={onPick}
        onCreate={onCreate}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '__new__' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Nome da categoria' }),
      { target: { value: 'Pets' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(onCreate).toHaveBeenCalledWith('Pets', undefined);
  });

  it('lets a user with no categories create one right there', () => {
    render(
      <CategoryPicker
        subject="Petz"
        suggestions={[]}
        categories={[]}
        onPick={onPick}
        onCreate={onCreate}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'Nome da categoria' }),
    ).toBeInTheDocument();
  });

  it('goes back to the select when Esc is pressed in the new category field', () => {
    render(
      <CategoryPicker
        subject="Petz"
        suggestions={[]}
        categories={[essenciais]}
        onPick={onPick}
        onCreate={onCreate}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '__new__' },
    });
    fireEvent.keyDown(
      screen.getByRole('textbox', { name: 'Nome da categoria' }),
      { key: 'Escape' },
    );
    expect(
      screen.queryByRole('textbox', { name: 'Nome da categoria' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
