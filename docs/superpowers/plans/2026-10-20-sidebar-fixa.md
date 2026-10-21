# Sidebar fixa, conteúdo rolando — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A moldura do app passa a ter a altura da janela: a sidebar fica parada e só a área de conteúdo rola.

**Architecture:** `AppShellChrome` troca `min-h-screen` por uma moldura de `100dvh`; o cabeçalho fica fixo e um contêiner marcado `data-scroll-root` (conteúdo + rodapé) vira o único a rolar. A rolagem infinita da lista de transações passa a observar esse contêiner.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-contas-planejamento-categorias-design.md` §4

## Global Constraints

- Funciona no computador e no celular (Safari, iPhone), nos temas claro e escuro.
- No celular, onde a sidebar já é uma gaveta, também só o conteúdo rola (escolha do design, §4).
- Nenhuma dependência nova.

## Review Focus

- Página curta (Configurações vazia): o rodapé fica no fim do conteúdo, sem espaço sobrando estranho nem barra de rolagem à toa.
- Lista de transações longa: a rolagem infinita continua carregando antes de chegar ao fim (a margem de 600 px vale dentro do contêiner).
- Celular: a barra `sticky` da lista de transações gruda logo abaixo do cabeçalho enquanto o conteúdo rola.
- Diálogos (`<dialog>`) e a gaveta do celular continuam cobrindo a tela inteira, por cima da moldura.
- Trocar de página pela sidebar abre a nova página no topo, não na posição de rolagem da anterior.

---

### Task 1: Moldura da altura da tela, com um só contêiner rolando

**Files:**

- Modify: `src/components/layout/app-shell-chrome.tsx:84-191`
- Test: `src/components/layout/app-shell-chrome.test.tsx` (novo)

**Interfaces:**

- Produces: o atributo `data-scroll-root` no elemento que rola (envolve `<main>` e o rodapé). A Task 2 depende desse nome.

- [ ] **Step 1: Write the failing test**

Renderize `AppShellChrome` com `vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))`, `vi.mock('@/app/(auth)/actions', () => ({ signOutAction: vi.fn() }))` e `vi.mock('@/app/transactions/create-transaction-dialog', () => ({ CreateTransactionDialog: () => null }))`.

```tsx
it('rolls only the content, never the sidebar or the header', () => {
  render(
    <AppShellChrome userLabel="Dan" accounts={[]} categories={[]}>
      <p>conteúdo</p>
    </AppShellChrome>,
  );

  const scroller = screen.getByRole('main').closest('[data-scroll-root]');
  expect(scroller).not.toBeNull();
  expect(scroller).toHaveClass('overflow-y-auto');
  expect(scroller?.contains(screen.getByRole('banner'))).toBe(false);
  expect(scroller?.contains(screen.getByRole('navigation'))).toBe(false);
  expect(scroller?.contains(screen.getByRole('contentinfo'))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/layout/app-shell-chrome.test.tsx`
Expected: FAIL (`scroller` é `null`).

- [ ] **Step 3: Change the layout in `app-shell-chrome.tsx`**

- Externo: `h-dvh overflow-hidden` no lugar de `min-h-screen`; o contêiner `max-w-7xl` vira `h-full` em vez de `min-h-screen`.
- Moldura (`rounded-[1.25rem]`): `min-h-0 flex-1`, mantendo `overflow-clip`; reescreva o comentário: o contêiner que rola agora é o `data-scroll-root`, e o `sticky` da lista gruda nele.
- `<aside>` do computador: `overflow-y-auto` (uma sidebar mais alta que a tela rola sozinha).
- Coluna da direita: `min-h-0 min-w-0 flex-1 flex-col`; o `<header>` fica fora do contêiner que rola.
- Envolva `<main>` e `<footer>` num `<div data-scroll-root className="min-h-0 flex-1 overflow-y-auto overscroll-contain">`, com `<main>` ainda `flex-1` dentro de uma coluna flex de altura mínima total, para o rodapé ficar no fim em páginas curtas.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/layout/app-shell-chrome.test.tsx`
Expected: PASS.

- [ ] **Step 5: Check it in the running app**

Com `pnpm dev`, abra `/transactions` e `/settings` no computador e numa janela de 390 px: a sidebar (ou o cabeçalho, no celular) fica parada e só o conteúdo rola; numa página curta o rodapé fica no fim; trocar de página pela sidebar abre a nova no topo. Se trocar de página mantiver a rolagem anterior, zere `scrollTop` do `data-scroll-root` num efeito que depende de `pathname`.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/app-shell-chrome.tsx src/components/layout/app-shell-chrome.test.tsx
git commit -m "feat(layout): keep the sidebar in view and scroll only the content"
```

### Task 2: A rolagem infinita observa o contêiner que rola

**Files:**

- Create: `src/shared/lib/scroll-root.ts`
- Modify: `src/app/transactions/use-transaction-pages.ts:156-168`
- Test: `src/shared/lib/scroll-root.test.ts`

**Interfaces:**

- Consumes: `data-scroll-root` (Task 1).
- Produces: `scrollRootOf(node: Element): Element | null`.

- [ ] **Step 1: Write the failing test**

```ts
it('finds the element the page scrolls in, or none outside the app frame', () => {
  document.body.innerHTML =
    '<div data-scroll-root><ul><li id="sentinel"></li></ul></div><p id="loose"></p>';
  expect(scrollRootOf(document.getElementById('sentinel')!)).toBe(
    document.querySelector('[data-scroll-root]'),
  );
  expect(scrollRootOf(document.getElementById('loose')!)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/lib/scroll-root.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `scrollRootOf` and use it in the observer**

`scrollRootOf` devolve `node.closest('[data-scroll-root]')`. Em `use-transaction-pages.ts`, as opções do `IntersectionObserver` passam a ser `{ root: scrollRootOf(node), rootMargin: '600px' }` (sem `root`, a margem vale para a janela, e o contêiner corta o sentinela antes).

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/shared/lib/scroll-root.test.ts && pnpm test`
Expected: PASS em tudo.

- [ ] **Step 5: Check it in the running app**

Em `/transactions` com mais de 50 transações, role devagar: a próxima página começa a carregar antes de o fim aparecer.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/scroll-root.ts src/shared/lib/scroll-root.test.ts src/app/transactions/use-transaction-pages.ts
git commit -m "fix(transactions): load the next page before the end inside the scrolling content"
```
