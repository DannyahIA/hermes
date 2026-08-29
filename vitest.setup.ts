import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom não implementa a API imperativa de <dialog> (`showModal`/`close`) —
// o componente `Dialog` (src/components/ui/dialog.tsx) chama essas duas
// diretamente, então sem isso todo teste que abre um dialog quebra. O stub
// replica o essencial: `open` reflete a visibilidade, e `close()` dispara o
// mesmo evento `close` que um navegador real dispararia (é nele que `Dialog`
// escuta para sincronizar `onOpenChange`).
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
