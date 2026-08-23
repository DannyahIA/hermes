# Criação sob demanda + "Criar mais" — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os cards de criação sempre-visíveis (categorias, contas, orçamentos, empréstimos, transações, transferências) por dialogs sob demanda, e adicionar um toggle "Criar mais" (estilo Linear) que mantém o dialog aberto e preserva os campos de contexto entre envios.

**Architecture:** Um novo `CreateDialogForm` compõe o `DialogForm` já existente sem alterá-lo. Cada formulário de criação para de gerenciar seu próprio `useActionState` — passa a receber `state`/`formAction` de cima — e decide, campo a campo, o que sobrevive a um "criar mais" (campo controlado, não tocado no sucesso) e o que é limpo (campo não-controlado, resetado automaticamente pelo `<form>` do React 19, ou controlado e explicitamente zerado). O quick-add global de transação vive no `AppShellChrome`, alimentado por dados que `AppShell` busca via funções `cache()`-wrapped compartilhadas com `transactions/page.tsx`.

**Tech Stack:** Next.js 16 / React 19 (Server Components + form actions), Tailwind 4, Vitest. Este plano também introduz a primeira infraestrutura de teste de componente do repositório: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

**Spec:** `docs/superpowers/specs/2026-08-23-create-dialogs-and-create-more-design.md`

## Global Constraints

- Todo texto de UI em português, no mesmo tom já usado no app (ex.: "Criando…", "Salvando...").
- Ícones sempre de `lucide-react` (nunca misturar bibliotecas) — `docs/ui-ux.md`.
- Nenhuma cor/espaçamento hardcoded fora dos tokens/classes já usados no arquivo sendo editado.
- Nenhum dialog de edição (`AccountEditDialog`, `TransactionEditDialog`, `RecurringTransactionFormDialog` antes desta mudança, `ImportDialog`) muda de comportamento além do explicitamente descrito nas tarefas abaixo.
- Todo `<form action={formAction}>` deve continuar podendo ser submetido sem JavaScript rodando a lógica de negócio no servidor (a validação com Zod já feita pelas actions não muda nesta rodada).

---

## Task 1: Infraestrutura de teste de componente

**Files:**

- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/components/ui/create-dialog-form.smoke.test.tsx` (apagado ao final da Task 2, que o substitui por um teste real — ele só existe para provar que a infra funciona antes de construir em cima dela)

**Interfaces:**

- Produces: `environment: 'jsdom'` + `setupFiles` no vitest, `<dialog>` com `showModal()`/`close()` funcionando de forma determinística em teste, matchers do `jest-dom` disponíveis globalmente.

- [ ] **Step 1: Adicionar as dependências de teste**

```bash
pnpm add -D @testing-library/react@^16.3.0 @testing-library/jest-dom@^6.6.3 jsdom@^25.0.1
```

- [ ] **Step 2: Atualizar `vitest.config.ts`**

```ts
import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Criar `vitest.setup.ts`**

```ts
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
```

- [ ] **Step 4: Escrever o smoke test**

Este teste prova as duas coisas mais arriscadas da infra nova antes de qualquer outra tarefa depender delas: que `.tsx` com JSX compila no ambiente do Vitest, e que um `<form action={fn}>` (form action do React 19) realmente invoca a função quando submetido em jsdom.

```tsx
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
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm test`
Expected: PASS — incluindo os dois novos casos acima. Se o primeiro caso falhar, o problema é o transform de JSX do Vitest (ver nota abaixo); se o segundo falhar, o stub do Step 3 não foi carregado (confirme `setupFiles` no config).

> Nota para quem executar esta tarefa: o Vite/Vitest usa esbuild por padrão, que já entende `.tsx` sem plugin adicional na maioria dos casos. Se o Step 5 falhar especificamente por erro de parse de JSX, adicione `@vitejs/plugin-react` como dependência e `plugins: [react()]` ao `vitest.config.ts` — isso não estava prescrito aqui porque não deveria ser necessário, mas é a causa mais provável caso aconteça.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts src/components/ui/create-dialog-form.smoke.test.tsx
git commit -m "test: add component testing infra (jsdom + testing-library)"
```

---

## Task 2: `CreateDialogForm` — o componente compartilhado

**Files:**

- Create: `src/components/ui/create-dialog-form.tsx`
- Create: `src/components/ui/create-dialog-form.test.tsx`
- Delete: `src/components/ui/create-dialog-form.smoke.test.tsx` (seu propósito acaba aqui)

**Interfaces:**

- Consumes: `DialogForm` (`src/components/ui/dialog-form.tsx`) — já existe, não é modificado. `DialogHeader`/`DialogTitle`/`DialogDescription` (`src/components/ui/dialog.tsx`).
- Produces:
  - `CreateDialogForm<State extends { success: boolean }>` — props `trigger: (open: () => void) => React.ReactNode`, `title: string`, `description?: string`, `action: (state: State, formData: FormData) => Promise<State>`, `initialState: State`, `children: (args: { state: State; formAction: (formData: FormData) => void; repeating: boolean; onRepeatingChange: (repeating: boolean) => void; close: () => void }) => React.ReactNode`.
  - `RepeatToggle` — props `checked: boolean`, `onChange: (checked: boolean) => void`, `label: string`. Toda tarefa seguinte importa os dois deste arquivo.

- [ ] **Step 1: Escrever os testes**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm test -- create-dialog-form`
Expected: FAIL com "Cannot find module '@/components/ui/create-dialog-form'".

- [ ] **Step 3: Implementar `CreateDialogForm`**

```tsx
'use client';

import * as React from 'react';

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';

export interface CreateDialogFormRenderArgs<State> {
  state: State;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  close: () => void;
}

export interface CreateDialogFormProps<State extends { success: boolean }> {
  /** Render-prop: recebe `open` para o chamador conectar ao próprio botão
   * (o botão pode viver em lugares diferentes — cabeçalho de página, estado
   * vazio, header global — sem duplicar o estado do dialog). */
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  children: (args: CreateDialogFormRenderArgs<State>) => React.ReactNode;
}

/**
 * A base de todo fluxo de "criar X": um gatilho que abre um `Dialog` sob
 * demanda (em vez de o formulário ocupar espaço fixo na página), mais um
 * toggle opcional "Criar mais" que, quando marcado, mantém o dialog aberto
 * após um envio bem-sucedido em vez de fechá-lo, para lançar vários
 * registros em sequência sem reabrir o dialog toda vez.
 *
 * Compõe `DialogForm` em vez de alterá-lo — dialogs de edição, que nunca
 * precisam de "criar mais", continuam exatamente como estavam. Decidir
 * quais campos sobrevivem a um "criar mais" e quais são limpos é
 * responsabilidade de cada formulário-filho (ver `TransactionForm`); este
 * componente só decide se o *dialog* continua aberto, reaproveitando o
 * `closeOnSuccess` que `DialogForm` já expõe.
 */
export function CreateDialogForm<State extends { success: boolean }>({
  trigger,
  title,
  description,
  action,
  initialState,
  children,
}: CreateDialogFormProps<State>) {
  const [open, setOpen] = React.useState(false);
  const [repeating, setRepeating] = React.useState(false);

  function openDialog() {
    // "Criar mais" nunca começa marcado — decisão explícita do usuário
    // (sem persistência entre aberturas).
    setRepeating(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      {trigger(openDialog)}
      <DialogForm
        open={open}
        onOpenChange={setOpen}
        action={action}
        initialState={initialState}
        closeOnSuccess={!repeating}
      >
        {({ state, formAction }) => (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? (
                <DialogDescription>{description}</DialogDescription>
              ) : null}
            </DialogHeader>
            {children({
              state,
              formAction,
              repeating,
              onRepeatingChange: setRepeating,
              close,
            })}
          </>
        )}
      </DialogForm>
    </>
  );
}

export interface RepeatToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** O checkbox "Criar mais" que todo formulário de criação renderiza dentro
 * do seu próprio `DialogFooter` — compartilhado para que tenha a mesma
 * aparência e comportamento em todo lugar (ui-ux.md: "elementos iguais
 * devem sempre possuir o mesmo comportamento"). */
export function RepeatToggle({ checked, onChange, label }: RepeatToggleProps) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="border-input h-4 w-4 rounded"
      />
      {label}
    </label>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm test -- create-dialog-form`
Expected: PASS (3 testes).

- [ ] **Step 5: Apagar o smoke test da Task 1 e commitar**

```bash
git rm src/components/ui/create-dialog-form.smoke.test.tsx
git add src/components/ui/create-dialog-form.tsx src/components/ui/create-dialog-form.test.tsx
git commit -m "feat(ui): add CreateDialogForm and RepeatToggle"
```

---

## Task 3: Categoria

**Files:**

- Modify: `src/app/categories/category-form.tsx` (deixa de gerenciar seu próprio `useActionState`; passa a receber `state`/`formAction`/`repeating` como props)
- Create: `src/app/categories/create-category-dialog.tsx`
- Create: `src/app/categories/create-category-dialog.test.tsx`
- Delete: `src/app/categories/create-category-card.tsx`
- Modify: `src/app/categories/page.tsx`

**Interfaces:**

- Consumes: `CreateDialogForm`, `RepeatToggle` (Task 2).
- Produces: `CreateCategoryDialog` — sem props, renderizável em qualquer lugar (usado duas vezes em `page.tsx`: cabeçalho e estado vazio).

- [ ] **Step 1: Reescrever `category-form.tsx` para receber estado como props**

```tsx
'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';

import type { ActionResult } from '@/app/categories/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CategoryFormProps {
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

/**
 * Nenhum campo de categoria sobrevive a um "criar mais" — cada categoria é
 * conceitualmente única (ver a tabela de retenção no spec), então o único
 * trabalho extra aqui além de renderizar os campos é resetar o formulário e
 * devolver o foco ao nome, para digitação rápida em sequência.
 */
export function CategoryForm({
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: CategoryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-muted-foreground text-sm">
          Nome
        </label>
        <Input
          id="name"
          name="name"
          ref={nameRef}
          placeholder="Alimentação"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-muted-foreground text-sm">
          Descrição
        </label>
        <Textarea id="description" name="description" placeholder="Opcional" />
      </div>

      <div className="space-y-2">
        <label htmlFor="color" className="text-muted-foreground text-sm">
          Cor
        </label>
        <Input
          id="color"
          name="color"
          type="color"
          className="h-11 w-20 cursor-pointer p-1"
          defaultValue="#64748b"
        />
      </div>

      {state.error ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma categoria"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? 'Salvando...' : 'Criar categoria'}
    </Button>
  );
}
```

- [ ] **Step 2: Criar `create-category-dialog.tsx`**

```tsx
'use client';

import { createCategoryAction } from '@/app/categories/actions';
import { CategoryForm } from '@/app/categories/category-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

export function CreateCategoryDialog() {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Nova categoria</Button>}
      title="Nova categoria"
      description="Defina nome, descrição e cor."
      action={createCategoryAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <CategoryForm
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
```

- [ ] **Step 3: Escrever o teste de `CreateCategoryDialog`**

```tsx
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
```

- [ ] **Step 4: Rodar o teste, ver falhar, então rodar de novo até passar**

Run: `pnpm test -- create-category-dialog`
Expected: primeiro FAIL (arquivo não existe até o Step 2 ser salvo — se os steps já foram aplicados em ordem, deve passar direto); depois PASS.

- [ ] **Step 5: Apagar `create-category-card.tsx` e atualizar `page.tsx`**

```tsx
import { CategoryCard } from '@/app/categories/category-card';
import { CreateCategoryDialog } from '@/app/categories/create-category-dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { GetCategoriesUseCase } from '@/modules/categories/application/get-categories.use-case';

export default async function CategoriesPage() {
  const userId = await requireCurrentUserId();
  const useCase = new GetCategoriesUseCase(new DrizzleCategoryRepository());
  const categories = await useCase.execute(userId);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Categorias
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Organize suas transações em categorias personalizadas.
            </p>
          </div>
          <CreateCategoryDialog />
        </section>

        <Card className="border-border/70 bg-card/80 p-6">
          <CardHeader className="p-0">
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Visão geral das suas categorias.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 flex flex-wrap gap-8 p-0">
            <div>
              <p className="text-muted-foreground text-sm">
                Total de categorias
              </p>
              <p className="dimension-figure mt-2 text-3xl font-semibold">
                {categories.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Arquivadas</p>
              <p className="dimension-figure mt-2 text-3xl font-semibold">
                {categories.filter((category) => category.archived).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4">
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada."
              description="Crie sua primeira categoria para começar a organizar suas transações."
              action={<CreateCategoryDialog />}
            />
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                name={category.name}
                description={category.description}
                color={category.color}
                archived={category.archived}
              />
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Verificar tipos, lint e build**

Run: `pnpm typecheck && pnpm lint && pnpm test -- categories`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git rm src/app/categories/create-category-card.tsx
git add src/app/categories/category-form.tsx src/app/categories/create-category-dialog.tsx src/app/categories/create-category-dialog.test.tsx src/app/categories/page.tsx
git commit -m "feat(categories): move category creation into an on-demand dialog with create-more"
```

---

## Task 4: Conta

Mesmo formato da Task 3. Campo retido: `tipo`. Campos limpos: nome, saldo inicial, dia de fechamento/vencimento.

**Files:**

- Modify: `src/app/accounts/account-form.tsx`
- Create: `src/app/accounts/create-account-dialog.tsx`
- Create: `src/app/accounts/create-account-dialog.test.tsx`
- Modify: `src/app/accounts/page.tsx`

- [ ] **Step 1: Reescrever `account-form.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/accounts/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type AccountType,
  DEFAULT_CURRENCY,
} from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface AccountFormProps {
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function AccountForm({
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: AccountFormProps) {
  const [type, setType] = useState<AccountType>('checking');
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      // `type` é controlado de propósito — o reset abaixo não o afeta, ele
      // sobrevive ao "criar mais" (ver tabela de retenção no spec).
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="name">
          Nome da conta
        </label>
        <Input
          id="name"
          name="name"
          ref={nameRef}
          required
          placeholder="Conta corrente"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            required
            className={FIELD_BASE_CLASSES}
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((accountType) => (
              <option key={accountType} value={accountType}>
                {ACCOUNT_TYPE_LABELS[accountType]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="balance">
            Saldo inicial
          </label>
          <Input
            id="balance"
            name="balance"
            type="number"
            step="0.01"
            defaultValue={0}
          />
        </div>
      </div>

      {type === 'credit' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="closingDay">
              Dia de fechamento
            </label>
            <Input
              id="closingDay"
              name="closingDay"
              type="number"
              min="1"
              max="28"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dueDay">
              Dia de vencimento
            </label>
            <Input id="dueDay" name="dueDay" type="number" min="1" max="28" />
          </div>
        </div>
      )}

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma conta"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Criando…' : 'Criar conta'}
    </Button>
  );
}
```

- [ ] **Step 2: Criar `create-account-dialog.tsx`**

```tsx
'use client';

import { createAccountAction } from '@/app/accounts/actions';
import { AccountForm } from '@/app/accounts/account-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

export function CreateAccountDialog() {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Nova conta</Button>}
      title="Nova conta"
      description="Adicione uma conta financeira."
      action={createAccountAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <AccountForm
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
```

- [ ] **Step 3: Escrever e rodar o teste (mesmo padrão da Task 3, adaptado)**

```tsx
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
    expect(typeSelect).toHaveValue('credit');
  });
});
```

Run: `pnpm test -- create-account-dialog`
Expected: PASS.

- [ ] **Step 4: Atualizar `accounts/page.tsx`** (remove a coluna `lg:grid-cols-[1fr_360px]`, que só existia para o formulário; adiciona um cabeçalho de seção que a página não tinha)

```tsx
import { AccountCard } from '@/app/accounts/account-card';
import { CreateAccountDialog } from '@/app/accounts/create-account-dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

export default async function AccountsPage() {
  const userId = await requireCurrentUserId();
  const accountsWithBalances = await new GetAccountsUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
  ).execute(userId);
  const accounts = accountsWithBalances.map(({ account }) => account);

  const total = accountsWithBalances
    .filter(({ account }) => !account.hidden && !account.archived)
    .reduce((sum, { currentBalance }) => sum + currentBalance, 0);

  const now = new Date();
  const payingAccounts = accounts
    .filter((account) => account.type !== 'credit' && !account.archived)
    .map((account) => ({ id: account.id, name: account.name }));

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Contas
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Suas contas financeiras e seus saldos.
            </p>
          </div>
          <CreateAccountDialog />
        </section>

        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Patrimônio total</CardTitle>
            <CardDescription>Soma das contas ativas.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            <p className="dimension-figure text-3xl font-semibold">
              {formatCurrency(total)}
            </p>
          </CardContent>
        </Card>

        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Crie sua primeira conta para começar a acompanhar suas finanças."
            action={<CreateAccountDialog />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accountsWithBalances.map(
              ({ account, currentBalance, projectedBalance }) => {
                const nextDue = account.nextDueDate(now);
                return (
                  <AccountCard
                    key={account.id}
                    id={account.id}
                    name={account.name}
                    type={account.type}
                    balance={currentBalance}
                    projectedBalance={
                      projectedBalance !== currentBalance
                        ? projectedBalance
                        : undefined
                    }
                    currency={account.currency}
                    archived={account.archived}
                    closingDay={account.closingDay}
                    dueDay={account.dueDay}
                    nextDueLabel={nextDue ? formatDate(nextDue) : undefined}
                    payingAccounts={payingAccounts}
                  />
                );
              },
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm test -- accounts`

```bash
git add src/app/accounts/account-form.tsx src/app/accounts/create-account-dialog.tsx src/app/accounts/create-account-dialog.test.tsx src/app/accounts/page.tsx
git commit -m "feat(accounts): move account creation into an on-demand dialog with create-more"
```

---

## Task 5: Orçamento

Campo retido: período (início/fim). Campos limpos: categoria, valor.

**Files:**

- Modify: `src/app/budgets/budget-form.tsx`
- Create: `src/app/budgets/create-budget-dialog.tsx`
- Create: `src/app/budgets/create-budget-dialog.test.tsx`
- Modify: `src/app/budgets/page.tsx`

- [ ] **Step 1: Reescrever `budget-form.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/budgets/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_CURRENCY } from '@/config/constants';
import { ROUTES } from '@/config/routes';

interface BudgetFormProps {
  categories: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function BudgetForm({
  categories,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: BudgetFormProps) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      // periodStart/periodEnd são controlados de propósito — o reset abaixo
      // não os afeta, sobrevivem ao "criar mais".
      formRef.current?.reset();
      amountRef.current?.focus();
    }
  }

  if (categories.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Crie uma categoria antes de criar um orçamento.{' '}
          <Link
            href={ROUTES.categories}
            className="text-primary font-medium underline"
          >
            Ir para categorias
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="categoryId" className="text-muted-foreground text-sm">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categories[0]?.id}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 flex h-11 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-all duration-200 outline-none focus-visible:ring-2"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="amount" className="text-muted-foreground text-sm">
            Valor do orçamento
          </label>
          <Input
            id="amount"
            name="amount"
            ref={amountRef}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="periodStart"
            className="text-muted-foreground text-sm"
          >
            Início do período
          </label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="periodEnd" className="text-muted-foreground text-sm">
            Fim do período
          </label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            required
          />
        </div>
      </div>

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      {state.error ? (
        <Alert className="border-destructive/40">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais um orçamento"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Criar orçamento'}
    </Button>
  );
}
```

- [ ] **Step 2: Criar `create-budget-dialog.tsx`**

```tsx
'use client';

import { createBudgetAction } from '@/app/budgets/actions';
import { BudgetForm } from '@/app/budgets/budget-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateBudgetDialogProps {
  categories: Array<{ id: string; name: string }>;
}

export function CreateBudgetDialog({ categories }: CreateBudgetDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Novo orçamento</Button>}
      title="Novo orçamento"
      description="Escolha a categoria, o valor limite e o período."
      action={createBudgetAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <BudgetForm
          categories={categories}
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
```

- [ ] **Step 3: Escrever e rodar o teste**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';

vi.mock('@/app/budgets/actions', () => ({
  createBudgetAction: vi.fn(async () => ({ success: true })),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Alimentação' },
  { id: 'cat-2', name: 'Transporte' },
];

describe('CreateBudgetDialog', () => {
  it('mantém o período mas limpa o valor quando "criar mais" está marcado', async () => {
    render(<CreateBudgetDialog categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole('button', { name: 'Novo orçamento' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais um orçamento' }),
    );

    const startInput = screen.getByLabelText('Início do período');
    const endInput = screen.getByLabelText('Fim do período');
    fireEvent.change(startInput, { target: { value: '2026-08-01' } });
    fireEvent.change(endInput, { target: { value: '2026-08-31' } });

    const amountInput = screen.getByLabelText('Valor do orçamento');
    fireEvent.change(amountInput, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(startInput).toHaveValue('2026-08-01');
    expect(endInput).toHaveValue('2026-08-31');
  });
});
```

Run: `pnpm test -- create-budget-dialog`
Expected: PASS.

- [ ] **Step 4: Atualizar `budgets/page.tsx`** (remove a seção `#novo-orcamento`; a lista sobe para logo abaixo do título)

```tsx
import { BudgetForm } from '@/app/budgets/budget-form';
```

Vira:

```tsx
import { BudgetProgressCard } from '@/app/budgets/budget-progress-card';
import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';

export default async function BudgetsPage() {
  const userId = await requireCurrentUserId();

  const categoryRepository = new DrizzleCategoryRepository();
  const categories = await categoryRepository.findByUserId(userId);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const getBudgetProgress = new GetBudgetProgressUseCase(
    new DrizzleBudgetRepository(),
    new DrizzleTransactionRepository(),
  );
  const progressList = await getBudgetProgress.execute(userId);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Orçamentos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Defina quanto pretende gastar em cada categoria e acompanhe seu
              progresso ao longo do mês.
            </p>
          </div>
          <CreateBudgetDialog categories={categoryOptions} />
        </section>

        <section className="grid gap-4">
          {progressList.length === 0 ? (
            <EmptyState
              title="Nenhum orçamento cadastrado."
              description="Crie seu primeiro orçamento para acompanhar seus limites de gastos."
              action={
                categories.length > 0 ? (
                  <CreateBudgetDialog categories={categoryOptions} />
                ) : undefined
              }
            />
          ) : (
            progressList.map((progress) => {
              const category = categoryById.get(progress.budget.categoryId);
              return (
                <BudgetProgressCard
                  key={progress.budget.id}
                  progress={progress}
                  categoryName={category?.name ?? 'Categoria removida'}
                  categoryColor={category?.color}
                />
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm test -- budgets`

```bash
git add src/app/budgets/budget-form.tsx src/app/budgets/create-budget-dialog.tsx src/app/budgets/create-budget-dialog.test.tsx src/app/budgets/page.tsx
git commit -m "feat(budgets): move budget creation into an on-demand dialog with create-more"
```

---

## Task 6: Empréstimo

Campo retido: contas de recebimento/pagamento. Campos limpos: descrição, valor, taxa, parcelas, data.

**Files:**

- Modify: `src/app/loans/loan-form.tsx`
- Create: `src/app/loans/create-loan-dialog.tsx`
- Create: `src/app/loans/create-loan-dialog.test.tsx`
- Modify: `src/app/loans/page.tsx`

- [ ] **Step 1: Reescrever `loan-form.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/loans/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface LoanFormProps {
  accounts: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function LoanForm({
  accounts,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: LoanFormProps) {
  const [disbursementAccountId, setDisbursementAccountId] = useState(
    accounts[0]?.id ?? '',
  );
  const [repaymentAccountId, setRepaymentAccountId] = useState(
    accounts[0]?.id ?? '',
  );
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      formRef.current?.reset();
      descriptionRef.current?.focus();
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Crie uma conta antes de criar um empréstimo.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="loanDescription">
          Descrição
        </label>
        <Input
          id="loanDescription"
          name="description"
          ref={descriptionRef}
          required
          placeholder="Empréstimo pessoal"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor="disbursementAccountId"
          >
            Conta de recebimento
          </label>
          <select
            id="disbursementAccountId"
            name="disbursementAccountId"
            required
            className={FIELD_BASE_CLASSES}
            value={disbursementAccountId}
            onChange={(event) => setDisbursementAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="repaymentAccountId">
            Conta de pagamento
          </label>
          <select
            id="repaymentAccountId"
            name="repaymentAccountId"
            required
            className={FIELD_BASE_CLASSES}
            value={repaymentAccountId}
            onChange={(event) => setRepaymentAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="principal">
            Valor do principal
          </label>
          <Input
            id="principal"
            name="principal"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="monthlyInterestRate">
            Taxa de juros mensal (%)
          </label>
          <Input
            id="monthlyInterestRate"
            name="monthlyInterestRate"
            type="number"
            step="0.01"
            min="0"
            placeholder="2"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="installmentCount">
            Número de parcelas
          </label>
          <Input
            id="installmentCount"
            name="installmentCount"
            type="number"
            step="1"
            min="2"
            max="60"
            placeholder="12"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="startDate">
          Data da primeira parcela
        </label>
        <Input id="startDate" name="startDate" type="date" />
      </div>

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais um empréstimo"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Criando…' : 'Criar empréstimo'}
    </Button>
  );
}
```

- [ ] **Step 2: Criar `create-loan-dialog.tsx`**

```tsx
'use client';

import { createLoanAction } from '@/app/loans/actions';
import { LoanForm } from '@/app/loans/loan-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateLoanDialogProps {
  accounts: Array<{ id: string; name: string }>;
}

export function CreateLoanDialog({ accounts }: CreateLoanDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Novo empréstimo</Button>}
      title="Novo empréstimo"
      description="Escolha as contas de recebimento e pagamento, o valor e a taxa de juros mensal."
      action={createLoanAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <LoanForm
          accounts={accounts}
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
```

- [ ] **Step 3: Escrever e rodar o teste**

```tsx
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

    const repaymentSelect = screen.getByLabelText('Conta de pagamento');
    fireEvent.change(repaymentSelect, { target: { value: 'acc-2' } });

    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, { target: { value: 'Carro' } });
    fireEvent.change(screen.getByLabelText('Valor do principal'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('Taxa de juros mensal (%)'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Número de parcelas'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar empréstimo' }));

    await waitFor(() => expect(descriptionInput).toHaveValue(''));
    expect(repaymentSelect).toHaveValue('acc-2');
  });
});
```

Run: `pnpm test -- create-loan-dialog`
Expected: PASS.

- [ ] **Step 4: Atualizar `loans/page.tsx`** (remove a seção `#novo-emprestimo`; `EmptyState` já existia, só troca o CTA)

```tsx
import Link from 'next/link';
```

Vira (sem `Link`, sem `Button` importados diretamente para essa página — `CreateLoanDialog` já traz o seu próprio botão):

```tsx
import { CreateLoanDialog } from '@/app/loans/create-loan-dialog';
import { LoanCard } from '@/app/loans/loan-card';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';

export default async function LoansPage() {
  const userId = await requireCurrentUserId();

  const accountRepository = new DrizzleAccountRepository();
  const transactionRepository = new DrizzleTransactionRepository();

  const [accounts, plans] = await Promise.all([
    accountRepository.findByUserId(userId),
    new GetInstallmentPlansUseCase(
      new DrizzleInstallmentPlanRepository(),
    ).execute(userId),
  ]);

  const loans = plans.filter((plan) => plan.kind === 'loan');
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const now = new Date();
  const loanCards = await Promise.all(
    loans.map(async (loan) => {
      const installments = await transactionRepository.findByInstallmentPlanId(
        loan.id,
      );
      const paidCount = installments.filter((i) => i.occurredAt <= now).length;
      const currency = accountById.get(loan.accountId)?.currency ?? 'BRL';

      return {
        id: loan.id,
        description: loan.description,
        principal: loan.totalAmount,
        monthlyInterestRate: loan.interestRate ?? 0,
        installmentCount: loan.installmentCount,
        paidCount,
        currency,
      };
    }),
  );

  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Empréstimos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registre um empréstimo recebido e acompanhe o cronograma de
              pagamento pelo sistema Price.
            </p>
          </div>
          {accountOptions.length > 0 ? (
            <CreateLoanDialog accounts={accountOptions} />
          ) : null}
        </section>

        <section className="grid gap-4">
          {loanCards.length === 0 ? (
            <EmptyState
              title="Nenhum empréstimo cadastrado."
              description="Crie seu primeiro empréstimo para acompanhar o cronograma de pagamento."
              action={
                accountOptions.length > 0 ? (
                  <CreateLoanDialog accounts={accountOptions} />
                ) : undefined
              }
            />
          ) : (
            loanCards.map((loan) => <LoanCard key={loan.id} {...loan} />)
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm test -- loans`

```bash
git add src/app/loans/loan-form.tsx src/app/loans/create-loan-dialog.tsx src/app/loans/create-loan-dialog.test.tsx src/app/loans/page.tsx
git commit -m "feat(loans): move loan creation into an on-demand dialog with create-more"
```

---

## Task 7: Transferência

Campo retido: contas (de/para). Campos limpos: valor, descrição.

**Files:**

- Modify: `src/app/transactions/transfer-form.tsx`
- Create: `src/app/transactions/create-transfer-dialog.tsx`
- Create: `src/app/transactions/create-transfer-dialog.test.tsx`

(A página `transactions/page.tsx` só é atualizada na Task 9, depois que a Task 8 também estiver pronta, para editar o arquivo uma única vez.)

- [ ] **Step 1: Reescrever `transfer-form.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface TransferFormProps {
  accounts: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function TransferForm({
  accounts,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? '',
  );
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      formRef.current?.reset();
      amountRef.current?.focus();
    }
  }

  if (accounts.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Você precisa de pelo menos duas contas para transferir dinheiro entre
        elas.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fromAccountId">
            De
          </label>
          <select
            id="fromAccountId"
            name="fromAccountId"
            required
            className={FIELD_BASE_CLASSES}
            value={fromAccountId}
            onChange={(event) => setFromAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="toAccountId">
            Para
          </label>
          <select
            id="toAccountId"
            name="toAccountId"
            required
            className={FIELD_BASE_CLASSES}
            value={toAccountId}
            onChange={(event) => setToAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="transferAmount">
          Valor
        </label>
        <Input
          id="transferAmount"
          name="amount"
          ref={amountRef}
          type="number"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="transferDescription">
          Descrição
        </label>
        <Input
          id="transferDescription"
          name="description"
          required
          placeholder="Transferência para poupança"
        />
      </div>

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma transferência"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Transferindo…' : 'Transferir'}
    </Button>
  );
}
```

- [ ] **Step 2: Criar `create-transfer-dialog.tsx`**

```tsx
'use client';

import { transferMoneyAction } from '@/app/transactions/actions';
import { TransferForm } from '@/app/transactions/transfer-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateTransferDialogProps {
  accounts: Array<{ id: string; name: string }>;
}

export function CreateTransferDialog({ accounts }: CreateTransferDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          Transferência
        </Button>
      )}
      title="Transferência"
      description="Mova dinheiro entre suas contas."
      action={transferMoneyAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <TransferForm
          accounts={accounts}
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
```

- [ ] **Step 3: Escrever e rodar o teste**

```tsx
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
  it('mantém as contas mas limpa o valor quando "criar mais" está marcado', async () => {
    render(<CreateTransferDialog accounts={ACCOUNTS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Transferência' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma transferência' }),
    );

    const toSelect = screen.getByLabelText('Para');
    fireEvent.change(toSelect, { target: { value: 'acc-2' } });
    const amountInput = screen.getByLabelText('Valor');
    fireEvent.change(amountInput, { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Reserva' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    await waitFor(() => expect(amountInput).toHaveValue(null));
    expect(toSelect).toHaveValue('acc-2');
  });
});
```

Run: `pnpm test -- create-transfer-dialog`
Expected: PASS.

- [ ] **Step 4: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint`

```bash
git add src/app/transactions/transfer-form.tsx src/app/transactions/create-transfer-dialog.tsx src/app/transactions/create-transfer-dialog.test.tsx
git commit -m "feat(transactions): move transfer creation into an on-demand dialog with create-more"
```

---

## Task 8: Transação (formulário + dialog global de quick-add)

Campos retidos: tipo, conta, categoria, data. Campos limpos: descrição, valor, parcelamento.

O `TransactionForm` original escolhia dinamicamente, no cliente, entre `createTransactionAction` e `createInstallmentAction` conforme o checkbox "Parcelar". Isso não é mais possível: `formAction` agora vem de cima (de um único `action` fixado quando o dialog é declarado), então essa decisão se move para dentro de uma nova action-dispatcher que lê um campo oculto do próprio `FormData`.

**Files:**

- Modify: `src/app/transactions/actions.ts` (adiciona `createTransactionOrInstallmentAction`)
- Modify: `src/app/transactions/transaction-form.tsx`
- Create: `src/app/transactions/create-transaction-dialog.tsx`
- Create: `src/app/transactions/create-transaction-dialog.test.tsx`

**Interfaces:**

- Produces: `createTransactionOrInstallmentAction(prev: ActionResult, formData: FormData): Promise<ActionResult>` em `transactions/actions.ts` — usado tanto pelo dialog da página quanto pelo quick-add global (Task 9).

- [ ] **Step 1: Adicionar o dispatcher em `transactions/actions.ts`**

Adicionar ao final do arquivo, depois de `createInstallmentAction` (a função já existe — não recriá-la, só adicionar a nova):

```ts
/**
 * `TransactionForm` decide, client-side, entre um lançamento simples e um
 * parcelado — mas agora só existe um `action` fixo por dialog (ver
 * `CreateDialogForm`), então essa escolha vira um campo oculto no próprio
 * FormData em vez de uma troca de função no cliente.
 */
export async function createTransactionOrInstallmentAction(
  prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (formData.get('installments') === 'true') {
    return createInstallmentAction(prev, formData);
  }
  return createTransactionAction(prev, formData);
}
```

- [ ] **Step 2: Reescrever `transaction-form.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { formatCurrency } from '@/shared/lib/format-currency';

interface TransactionFormProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  accounts,
  categories,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: TransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [occurredAt, setOccurredAt] = useState(today());
  const [installments, setInstallments] = useState(false);
  const [amountMode, setAmountMode] = useState<'total' | 'installment'>(
    'total',
  );
  const [amountValue, setAmountValue] = useState('');
  const [installmentCountValue, setInstallmentCountValue] = useState(2);
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef(state);

  if (state !== handledStateRef.current) {
    handledStateRef.current = state;
    if (state.success) {
      // type/accountId/categoryId/occurredAt são controlados de propósito —
      // o reset abaixo não os afeta, sobrevivem ao "criar mais". O resto
      // (descrição, valor, parcelamento) é sempre limpo.
      formRef.current?.reset();
      descriptionRef.current?.focus();
      setAmountValue('');
      setInstallments(false);
      setAmountMode('total');
      setInstallmentCountValue(2);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            required
            className={FIELD_BASE_CLASSES}
            value={type}
            onChange={(event) =>
              setType(event.target.value as 'expense' | 'income')
            }
          >
            <option value="expense">{TRANSACTION_TYPE_LABELS.expense}</option>
            <option value="income">{TRANSACTION_TYPE_LABELS.income}</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="amount">
              {installments && type === 'expense'
                ? amountMode === 'total'
                  ? 'Valor total'
                  : 'Valor da parcela'
                : 'Valor'}
            </label>
            {installments && type === 'expense' && (
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAmountMode('total')}
                  className={`rounded-full border px-2 py-0.5 ${amountMode === 'total' ? 'border-primary bg-primary/10' : 'border-input'}`}
                >
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => setAmountMode('installment')}
                  className={`rounded-full border px-2 py-0.5 ${amountMode === 'installment' ? 'border-primary bg-primary/10' : 'border-input'}`}
                >
                  Por parcela
                </button>
              </div>
            )}
          </div>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
          />
          {installments && type === 'expense' && amountValue && (
            <p className="text-muted-foreground text-xs">
              {amountMode === 'total'
                ? `≈ ${formatCurrency(Number(amountValue) / installmentCountValue)} por parcela`
                : `≈ ${formatCurrency(Number(amountValue) * installmentCountValue)} no total`}
            </p>
          )}
          {installments && type === 'expense' && (
            <input type="hidden" name="amountMode" value={amountMode} />
          )}
          <input
            type="hidden"
            name="installments"
            value={String(installments && type === 'expense')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Descrição
        </label>
        <Input
          id="description"
          name="description"
          ref={descriptionRef}
          required
          placeholder="Supermercado"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="accountId">
            Conta
          </label>
          <select
            id="accountId"
            name="accountId"
            required
            className={FIELD_BASE_CLASSES}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="categoryId">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            className={FIELD_BASE_CLASSES}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="occurredAt">
          Data
        </label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          required
        />
      </div>

      {type === 'expense' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={installments}
              onChange={(event) => setInstallments(event.target.checked)}
              className="border-input h-4 w-4 rounded"
            />
            Parcelar
          </label>
          {installments && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="installmentCount">
                Número de parcelas
              </label>
              <Input
                id="installmentCount"
                name="installmentCount"
                type="number"
                min="2"
                max="60"
                step="1"
                value={installmentCountValue}
                onChange={(event) =>
                  setInstallmentCountValue(Number(event.target.value) || 2)
                }
                required
              />
            </div>
          )}
        </div>
      )}

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma transação"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton installments={installments && type === 'expense'} />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton({ installments }: { installments: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? 'Salvando…'
        : installments
          ? 'Registrar parcelamento'
          : 'Registrar transação'}
    </Button>
  );
}
```

- [ ] **Step 3: Criar `create-transaction-dialog.tsx`**

Este componente é montado uma única vez, no `AppShellChrome` (Task 9) — é o quick-add global. Ele mesmo define seu gatilho (o mesmo botão "Nova transação" que já existe no header hoje, só trocando o `<Link>` por `onClick`).

```tsx
'use client';

import { Plus } from 'lucide-react';

import { createTransactionOrInstallmentAction } from '@/app/transactions/actions';
import { TransactionForm } from '@/app/transactions/transaction-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateTransactionDialogProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

export function CreateTransactionDialog({
  accounts,
  categories,
}: CreateTransactionDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button
          size="icon"
          className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3"
          onClick={open}
          aria-label="Nova transação"
        >
          <Plus className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Nova transação</span>
        </Button>
      )}
      title="Nova transação"
      description="Registre uma receita ou despesa."
      action={createTransactionOrInstallmentAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) =>
        accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Crie uma conta antes de registrar transações.
          </p>
        ) : (
          <TransactionForm
            accounts={accounts}
            categories={categories}
            state={state}
            formAction={formAction}
            repeating={repeating}
            onRepeatingChange={onRepeatingChange}
            onCancel={close}
          />
        )
      }
    </CreateDialogForm>
  );
}
```

- [ ] **Step 4: Escrever e rodar o teste**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';

vi.mock('@/app/transactions/actions', () => ({
  createTransactionOrInstallmentAction: vi.fn(async () => ({ success: true })),
}));

const ACCOUNTS = [{ id: 'acc-1', name: 'Conta corrente' }];
const CATEGORIES = [{ id: 'cat-1', name: 'Alimentação' }];

describe('CreateTransactionDialog', () => {
  it('mantém tipo, conta, categoria e data mas limpa descrição e valor quando "criar mais" está marcado', async () => {
    render(
      <CreateTransactionDialog accounts={ACCOUNTS} categories={CATEGORIES} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Criar mais uma transação' }),
    );

    const categorySelect = screen.getByLabelText('Categoria');
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByLabelText('Valor'), {
      target: { value: '50' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar transação' }),
    );

    await waitFor(() => expect(descriptionInput).toHaveValue(''));
    expect(categorySelect).toHaveValue('cat-1');
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
});
```

Run: `pnpm test -- create-transaction-dialog`
Expected: PASS.

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint`

```bash
git add src/app/transactions/actions.ts src/app/transactions/transaction-form.tsx src/app/transactions/create-transaction-dialog.tsx src/app/transactions/create-transaction-dialog.test.tsx
git commit -m "feat(transactions): move transaction creation into an on-demand dialog with create-more"
```

---

## Task 9: Recorrência (adapta o dialog já existente)

Campos retidos: conta, categoria, tipo, regra de repetição (+ dia do mês, quando aplicável), data de início. Campos limpos: descrição, valor.

**Files:**

- Modify: `src/app/transactions/recurring-transaction-form-dialog.tsx`

- [ ] **Step 1: Reescrever o arquivo inteiro, trocando `DialogForm` por `CreateDialogForm`**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { createRecurringTransactionAction } from '@/app/transactions/recurring-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  CreateDialogForm,
  RepeatToggle,
} from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface RecurringTransactionFormDialogProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurringTransactionFormDialog({
  accounts,
  categories,
}: RecurringTransactionFormDialogProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [dayRuleKind, setDayRuleKind] = useState<
    'fixed_day' | 'first_business_day' | 'last_business_day'
  >('fixed_day');
  const [dayRuleDay, setDayRuleDay] = useState('');
  const [startDate, setStartDate] = useState(today());
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const handledStateRef = useRef<ActionResult>(INITIAL_STATE);

  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={open}
        >
          Nova recorrência
        </Button>
      )}
      title="Nova transação recorrente"
      description="Ex: salário no primeiro dia útil, internet todo dia 8."
      action={createRecurringTransactionAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => {
        if (state !== handledStateRef.current) {
          handledStateRef.current = state;
          if (state.success) {
            // accountId/categoryId/type/dayRuleKind/dayRuleDay/startDate são
            // controlados de propósito — sobrevivem ao "criar mais".
            formRef.current?.reset();
            descriptionRef.current?.focus();
          }
        }

        return (
          <form ref={formRef} action={formAction} className="space-y-4">
            {state.error && (
              <Alert variant="error">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="recurring-description"
              >
                Descrição
              </label>
              <Input
                id="recurring-description"
                name="description"
                ref={descriptionRef}
                required
                placeholder="Salário"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="recurring-type">
                  Tipo
                </label>
                <select
                  id="recurring-type"
                  name="type"
                  required
                  className={FIELD_BASE_CLASSES}
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as 'expense' | 'income')
                  }
                >
                  <option value="expense">
                    {TRANSACTION_TYPE_LABELS.expense}
                  </option>
                  <option value="income">
                    {TRANSACTION_TYPE_LABELS.income}
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-amount"
                >
                  Valor
                </label>
                <Input
                  id="recurring-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-accountId"
                >
                  Conta
                </label>
                <select
                  id="recurring-accountId"
                  name="accountId"
                  required
                  className={FIELD_BASE_CLASSES}
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-categoryId"
                >
                  Categoria
                </label>
                <select
                  id="recurring-categoryId"
                  name="categoryId"
                  className={FIELD_BASE_CLASSES}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="recurring-dayRuleKind"
              >
                Repete
              </label>
              <select
                id="recurring-dayRuleKind"
                name="dayRuleKind"
                required
                className={FIELD_BASE_CLASSES}
                value={dayRuleKind}
                onChange={(event) =>
                  setDayRuleKind(
                    event.target.value as
                      'fixed_day' | 'first_business_day' | 'last_business_day',
                  )
                }
              >
                <option value="fixed_day">Todo dia fixo do mês</option>
                <option value="first_business_day">
                  Primeiro dia útil do mês
                </option>
                <option value="last_business_day">
                  Último dia útil do mês
                </option>
              </select>
            </div>

            {dayRuleKind === 'fixed_day' && (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-dayRuleDay"
                >
                  Dia do mês
                </label>
                <Input
                  id="recurring-dayRuleDay"
                  name="dayRuleDay"
                  type="number"
                  min="1"
                  max="31"
                  value={dayRuleDay}
                  onChange={(event) => setDayRuleDay(event.target.value)}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-startDate"
                >
                  Começa em
                </label>
                <Input
                  id="recurring-startDate"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-endDate"
                >
                  Termina em (opcional)
                </label>
                <Input id="recurring-endDate" name="endDate" type="date" />
              </div>
            </div>

            <DialogFooter className="items-center justify-between sm:justify-between">
              <RepeatToggle
                checked={repeating}
                onChange={onRepeatingChange}
                label="Criar mais uma recorrência"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <SubmitButton />
              </div>
            </DialogFooter>
          </form>
        );
      }}
    </CreateDialogForm>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Criar recorrência'}
    </Button>
  );
}
```

- [ ] **Step 2: Verificar tipos, lint e a suíte inteira**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sem erros — nenhum teste existente deveria ter sido afetado, já que este arquivo não tinha teste próprio antes.

- [ ] **Step 3: Commit**

```bash
git add src/app/transactions/recurring-transaction-form-dialog.tsx
git commit -m "feat(transactions): add create-more to the recurring transaction dialog"
```

---

## Task 10: Quick-add global + layout final de `/transactions`

**Files:**

- Create: `src/shared/server/reference-options.ts`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/app-shell-chrome.tsx`
- Modify: `src/app/transactions/page.tsx`

**Interfaces:**

- Produces: `getAccountOptions(userId: string): Promise<{id,name}[]>`, `getCategoryOptions(userId: string): Promise<{id,name}[]>` — ambas `cache()`-wrapped.
- Consumes: `CreateTransactionDialog` (Task 8), `CreateTransferDialog` (Task 7), `RecurringTransactionFormDialog` (Task 9, já era consumido antes).

- [ ] **Step 1: Criar `src/shared/server/reference-options.ts`**

```ts
import { cache } from 'react';

import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';

export interface ReferenceOption {
  id: string;
  name: string;
}

/**
 * Opções de conta/categoria para o quick-add de transação: precisam existir
 * tanto em `AppShell` (toda página autenticada, para o dialog do header)
 * quanto em `transactions/page.tsx` (para seus próprios filtros/formulários).
 * `cache()` — a mesma técnica que `infra/auth/session.ts` usa para a sessão —
 * faz os dois pontos de chamada, dentro de uma mesma request, compartilharem
 * uma única consulta em vez de duplicá-la.
 */
export const getAccountOptions = cache(
  async (userId: string): Promise<ReferenceOption[]> => {
    const accounts = await new DrizzleAccountRepository().findByUserId(userId);
    return accounts.map((account) => ({ id: account.id, name: account.name }));
  },
);

export const getCategoryOptions = cache(
  async (userId: string): Promise<ReferenceOption[]> => {
    const categories = await new DrizzleCategoryRepository().findByUserId(
      userId,
    );
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  },
);
```

- [ ] **Step 2: Atualizar `app-shell.tsx`** para buscar e repassar as opções

```tsx
import { AppShellChrome } from '@/components/layout/app-shell-chrome';
import { getCurrentSession } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GenerateDueOccurrencesUseCase } from '@/modules/recurring-transactions/application/generate-due-occurrences.use-case';
import {
  getAccountOptions,
  getCategoryOptions,
} from '@/shared/server/reference-options';

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const session = await getCurrentSession();
  const userLabel = session?.user.name ?? session?.user.email ?? 'Usuário';

  if (session?.user.id) {
    try {
      await withTransaction((tx) =>
        new GenerateDueOccurrencesUseCase(
          new DrizzleRecurringTransactionRepository(tx),
          new DrizzleTransactionRepository(tx),
          new DrizzleAccountRepository(tx),
        ).execute(session.user.id),
      );
    } catch (error) {
      console.error('Failed to generate due recurring transactions:', error);
    }
  }

  const [accounts, categories] = session?.user.id
    ? await Promise.all([
        getAccountOptions(session.user.id),
        getCategoryOptions(session.user.id),
      ])
    : [[], []];

  return (
    <AppShellChrome
      userLabel={userLabel}
      accounts={accounts}
      categories={categories}
    >
      {children}
    </AppShellChrome>
  );
}
```

- [ ] **Step 3: Atualizar `app-shell-chrome.tsx`**

Adicionar `accounts`/`categories` à interface de props e ao destructuring:

```tsx
interface AppShellChromeProps {
  userLabel: string;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}
```

```tsx
export function AppShellChrome({
  userLabel,
  accounts,
  categories,
  children,
}: AppShellChromeProps) {
```

Trocar o import de `Plus` (não é mais usado diretamente neste arquivo — passa a viver dentro de `CreateTransactionDialog`) e de `ROUTES` (só era usado no `href` que está sendo removido) por:

```tsx
import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';
```

Remover, da lista de imports de `lucide-react`, `Plus`; remover a linha `import { ROUTES } from '@/config/routes';`.

Substituir o botão "Nova transação" do header:

```tsx
<Button asChild size="icon" className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3">
  <Link href={ROUTES.transactions} aria-label="Nova transação">
    <Plus className="h-4 w-4 sm:hidden" />
    <span className="hidden sm:inline">Nova transação</span>
  </Link>
</Button>
```

por:

```tsx
<CreateTransactionDialog accounts={accounts} categories={categories} />
```

- [ ] **Step 4: Atualizar `transactions/page.tsx`** — remove os cards "Nova transação" e "Transferência" da coluna lateral (a criação de transação agora é o quick-add global; a transferência ganha um botão na barra de ações do topo), mantendo só "Recorrências" na coluna

```tsx
import Link from 'next/link';

import { CreateTransferDialog } from '@/app/transactions/create-transfer-dialog';
import { FilterChips } from '@/app/transactions/filter-chips';
import { ImportDialog } from '@/app/transactions/import-dialog';
import { RecurringTransactionFormDialog } from '@/app/transactions/recurring-transaction-form-dialog';
import { RecurringTransactionRow } from '@/app/transactions/recurring-transaction-row';
import { TransactionList } from '@/app/transactions/transaction-list';
import { TransactionsFilters } from '@/app/transactions/transactions-filters';
import { ViewModeSelector } from '@/app/transactions/view-mode-selector';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TRANSACTION_VIEW_MODES,
  type TransactionViewMode,
} from '@/config/constants';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';
import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { GetRecurringTransactionsUseCase } from '@/modules/recurring-transactions/application/get-recurring-transactions.use-case';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
import { encodeTransactionCursor } from '@/shared/lib/transaction-cursor';

function isTransactionViewMode(value: string): value is TransactionViewMode {
  return (TRANSACTION_VIEW_MODES as readonly string[]).includes(value);
}

interface TransactionsPageProps {
  searchParams: Promise<{
    accountId?: string;
    categoryId?: string;
    type?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const userId = await requireCurrentUserId();
  const filters = await searchParams;

  const [
    accounts,
    categories,
    installmentPlans,
    recurringTransactions,
    rawViewMode,
  ] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetInstallmentPlansUseCase(
      new DrizzleInstallmentPlanRepository(),
    ).execute(userId),
    new GetRecurringTransactionsUseCase(
      new DrizzleRecurringTransactionRepository(),
    ).execute(userId),
    new GetViewPreferenceUseCase(new DrizzleViewPreferenceRepository()).execute(
      userId,
      'transactions',
      'chronological',
    ),
  ]);
  const viewMode = isTransactionViewMode(rawViewMode)
    ? rawViewMode
    : 'chronological';

  const from = filters.from ? new Date(`${filters.from}T00:00:00`) : undefined;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined;

  const TRANSACTIONS_PAGE_SIZE = 50;
  const rawPage = await new GetTransactionsUseCase(
    new DrizzleTransactionRepository(),
  ).execute(userId, {
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type:
      (filters.type as 'income' | 'expense' | 'transfer' | undefined) ||
      undefined,
    from,
    to,
    pageSize: TRANSACTIONS_PAGE_SIZE + 1,
  });
  const hasMore = rawPage.length > TRANSACTIONS_PAGE_SIZE;
  const transactions = rawPage.slice(0, TRANSACTIONS_PAGE_SIZE);
  const lastTransaction = transactions.at(-1);
  const nextCursor =
    hasMore && lastTransaction
      ? encodeTransactionCursor({
          occurredAt: lastTransaction.occurredAt,
          id: lastTransaction.id,
        })
      : null;

  const filterParams = new URLSearchParams();
  if (filters.accountId) filterParams.set('accountId', filters.accountId);
  if (filters.categoryId) filterParams.set('categoryId', filters.categoryId);
  if (filters.type) filterParams.set('type', filters.type);
  if (filters.from) filterParams.set('from', filters.from);
  if (filters.to) filterParams.set('to', filters.to);

  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const installmentCountByPlanId: Record<string, number> = Object.fromEntries(
    installmentPlans.map((plan) => [plan.id, plan.installmentCount]),
  );

  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
  }));
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <TransactionsFilters
              accounts={accountOptions}
              categories={categoryOptions}
              defaultAccountId={filters.accountId}
              defaultCategoryId={filters.categoryId}
              defaultType={filters.type}
              defaultFrom={filters.from}
              defaultTo={filters.to}
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <ViewModeSelector value={viewMode} />
              {accountOptions.length >= 2 ? (
                <CreateTransferDialog accounts={accountOptions} />
              ) : null}
              <Button variant="outline" asChild>
                <Link
                  href={`/api/transactions/export?${filterParams.toString()}`}
                >
                  Exportar
                </Link>
              </Button>
              <ImportDialog />
            </div>
          </div>

          <FilterChips
            accounts={accountOptions}
            categories={categoryOptions}
            filters={{
              accountId: filters.accountId,
              categoryId: filters.categoryId,
              type: filters.type,
              from: filters.from,
              to: filters.to,
            }}
          />

          <Card className="overflow-hidden p-0">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <CardTitle>Nenhuma transação encontrada.</CardTitle>
                <CardDescription>
                  Registre sua primeira transação pelo botão "Nova transação" no
                  topo da página.
                </CardDescription>
              </div>
            ) : (
              <TransactionList
                initial={{
                  transactions: transactions.map((transaction) => ({
                    id: transaction.id,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    occurredAt: transaction.occurredAt.toISOString(),
                    accountId: transaction.accountId,
                    accountName:
                      accountsById.get(transaction.accountId)?.name ?? '—',
                    categoryId: transaction.categoryId ?? null,
                    categoryName: transaction.categoryId
                      ? (categoriesById.get(transaction.categoryId)?.name ??
                        null)
                      : null,
                    installmentPlanId: transaction.installmentPlanId ?? null,
                    installmentNumber: transaction.installmentNumber ?? null,
                    recurringRuleId: transaction.recurringRuleId ?? null,
                  })),
                  nextCursor,
                }}
                filters={{
                  accountId: filters.accountId,
                  categoryId: filters.categoryId,
                  type: filters.type,
                  from: filters.from,
                  to: filters.to,
                }}
                categories={categoryOptions}
                installmentCountByPlanId={installmentCountByPlanId}
                groupBy={viewMode}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Recorrências</CardTitle>
              <CardDescription>
                Receitas e despesas que se repetem todo mês.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-4 p-0">
              {accounts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Crie uma conta antes de configurar uma recorrência.
                </p>
              ) : (
                <>
                  {recurringTransactions.length > 0 && (
                    <div className="divide-border/70 -mx-1 divide-y">
                      {recurringTransactions.map((rule) => (
                        <div
                          key={rule.id}
                          className="px-1 py-2 first:pt-0 last:pb-0"
                        >
                          <RecurringTransactionRow
                            id={rule.id}
                            description={rule.description}
                            amount={rule.amount}
                            type={rule.type}
                            dayRuleKind={rule.dayRuleKind}
                            dayRuleDay={rule.dayRuleDay}
                            active={rule.active}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <RecurringTransactionFormDialog
                    accounts={accountOptions}
                    categories={categoryOptions}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verificar tipos, lint e a suíte inteira**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sem erros, todos os testes (novos e antigos) passando.

- [ ] **Step 6: Commit**

```bash
git add src/shared/server/reference-options.ts src/components/layout/app-shell.tsx src/components/layout/app-shell-chrome.tsx src/app/transactions/page.tsx
git commit -m "feat(transactions): global transaction quick-add in the header, final page layout"
```

---

## Task 11: Verificação final

**Files:** nenhum (só verificação).

- [ ] **Step 1: Rodar a suíte completa e o build de produção**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: tudo verde. `pnpm build` confirma que os Server/Client Component boundaries (ex.: `AppShell` async passando `accounts`/`categories` — arrays simples de `{id,name}` — para o `'use client'` `AppShellChrome`) serializam sem erro.

- [ ] **Step 2: Passada manual usando a skill `run`**

Usar a skill `run` para subir o app e conferir manualmente, em desktop e numa largura ~375px (mobile):

- Categorias, Contas, Orçamentos, Empréstimos: o botão de criar abre um dialog (nada mais fixo na página); o estado vazio também abre o dialog.
- Transações: o botão "Nova transação" no header abre o dialog de qualquer página (testar a partir do Dashboard, por exemplo); "Transferência" abre pelo botão da barra de ações; "Recorrências" continua na coluna lateral.
- Em cada um dos seis fluxos + recorrência: marcar "Criar mais", enviar, e confirmar visualmente que o dialog continua aberto com os campos da tabela de retenção do spec preenchidos e os demais em branco, e que o foco volta para o campo certo.
- Desmarcar "Criar mais" e confirmar que o dialog fecha normalmente após o envio, igual ao comportamento anterior.

Isso não vira um step de commit — é a confirmação final de que o app real se comporta como os testes de componente descrevem.

---

## Self-review

**Cobertura do spec:** as seis retenções da tabela do spec (Categoria, Conta, Orçamento, Empréstimo, Transação, Transferência) mais Recorrência estão cada uma numa task; `CreateDialogForm`/`RepeatToggle` (Task 2) cobrem a arquitetura compartilhada; quick-add global e layout final de `/transactions` estão na Task 10; o "sempre desmarcado ao reabrir" do spec está testado na Task 2, Step 1.

**Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem código completo, inclusive os componentes de apoio (`SubmitButton` de cada formulário).

**Consistência de tipos:** `ActionResult` (`{ success: boolean; error?: string }`, mais `message?: string` só em transações) é o único tipo de estado usado em toda `CreateDialogForm<State extends { success: boolean }>`; a assinatura do render-prop (`state`, `formAction`, `repeating`, `onRepeatingChange`, `close`) é idêntica em todas as oito tasks que a consomem.
