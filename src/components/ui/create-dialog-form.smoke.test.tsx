import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function SmokeForm({ action }: { action: () => void }) {
  return (
    <form
      action={() => {
        action();
      }}
    >
      <button type="submit">Enviar</button>
    </form>
  );
}

describe('infraestrutura de teste de componente', () => {
  it('renderiza JSX e invoca uma form action do React 19 ao submeter', () => {
    const action = vi.fn();
    render(<SmokeForm action={action} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('o stub de <dialog> abre e fecha de forma determinística', () => {
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);

    dialog.showModal();
    expect(dialog.open).toBe(true);

    const onClose = vi.fn();
    dialog.addEventListener('close', onClose);
    dialog.close();

    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
