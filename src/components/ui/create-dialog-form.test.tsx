import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateDialogForm } from '@/components/ui/create-dialog-form';

interface FakeState {
  success: boolean;
}

function renderFixture(
  action: (state: FakeState, formData: FormData) => Promise<FakeState>,
) {
  return render(
    <CreateDialogForm
      trigger={(open) => <button onClick={open}>Nova categoria</button>}
      title="Nova categoria"
      action={action}
      initialState={{ success: false }}
    >
      {({ formAction, repeating, onRepeatingChange, close }) => (
        <form action={formAction}>
          <input name="name" defaultValue="Alimentação" />
          <label>
            Criar mais
            <input
              type="checkbox"
              checked={repeating}
              onChange={(event) => onRepeatingChange(event.target.checked)}
            />
          </label>
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button type="submit">Criar</button>
        </form>
      )}
    </CreateDialogForm>,
  );
}

describe('CreateDialogForm', () => {
  it('fecha o dialog após um envio bem-sucedido quando "criar mais" está desmarcado', async () => {
    const action = vi.fn(async () => ({ success: true }));
    renderFixture(action);

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    expect(
      screen.getByRole('heading', { name: 'Nova categoria' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nova categoria' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('mantém o dialog aberto após um envio bem-sucedido quando "criar mais" está marcado', async () => {
    const action = vi.fn(async () => ({ success: true }));
    renderFixture(action);

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Criar mais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // `state.success` becoming `true` and the resulting close-on-success
    // effect both land via microtasks queued off the action's promise.
    // Waiting only for `action` to have been called (as above) lets this
    // assertion run *before* those microtasks flush, so it would pass even
    // if the dialog were about to close — i.e. even with `closeOnSuccess`
    // hardcoded to `true`, ignoring `repeating` entirely. Flushing a real
    // macrotask (a `setTimeout`) inside `act` guarantees every microtask
    // queued so far — including a would-be close — has already run before
    // we assert the dialog is still open.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      screen.getByRole('heading', { name: 'Nova categoria' }),
    ).toBeInTheDocument();
  });

  it('reseta "criar mais" para desmarcado toda vez que o dialog é reaberto', () => {
    const action = vi.fn(async () => ({ success: false }));
    renderFixture(action);

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Criar mais' }));
    expect(screen.getByRole('checkbox', { name: 'Criar mais' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));

    expect(
      screen.getByRole('checkbox', { name: 'Criar mais' }),
    ).not.toBeChecked();
  });
});
