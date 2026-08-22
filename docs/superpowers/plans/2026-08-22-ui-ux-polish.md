# UI/UX Polish Round 4 — Button Functionality, Standardization, Dark Theme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix concrete UI/UX defects found during audit: a permanently-disabled header button, an always-visible nav item pointing at an unbuilt page, three different (undocumented) destructive-confirmation UX patterns coexisting side by side, a loan card that always renders its full amortization table, and two real dark-theme contrast bugs where text becomes nearly unreadable.

**Architecture:** No schema or backend changes. All three tasks are client-component and design-token edits inside the existing Next.js App Router structure. Task 1 adds real interactivity (desktop sidebar collapse, a loan-schedule disclosure) and removes a dead nav entry. Task 2 migrates two outlier delete buttons onto the app's own documented `ConfirmDialog` pattern and standardizes toast feedback. Task 3 is a small token-correctness fix in `alert.tsx` and `button.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind v4 (CSS custom properties, `@theme inline`), TypeScript, lucide-react icons.

**Spec:** None — this plan was authored directly from a live audit of the running app (grep + manual file reads), per an explicit user request to find and fix real defects. Treat this plan's own text as the binding requirements; there is no separate spec document.

## Global Constraints

- Never use a raw hex/rgb color or a raw Tailwind palette class (`bg-white`, `text-gray-500`, etc.) in a component — always reference the semantic tokens already defined in `src/app/globals.css` (`bg-primary`, `text-muted-foreground`, `text-destructive`, ...), so both the light and dark themes stay correct automatically. This is the existing project convention (see the comment block at the top of `src/app/globals.css`) and the exact convention Task 3 exists to restore.
- Destructive actions (delete) must always go through the app's `ConfirmDialog` component (`src/components/ui/confirm-dialog.tsx`) — its own doc comment already states this is "the single confirmation pattern for destructive actions across the app." Do not invent a new one-off confirm flow.
- Every action that can fail (delete, archive, toggle) must report the result to the user via the shared toast system (`src/shared/hooks/use-toast.ts`'s `toast()` function) — both success and failure — matching the existing pattern in `src/app/accounts/account-card.tsx`.
- All Portuguese user-facing copy must stay in Portuguese, matching the existing tone (plain, direct, no technical jargon) already used throughout the app.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` (or the project's equivalent scripts — check `package.json` if unsure of exact names) after every task, and fix any failures before committing.

---

### Task 1: Fix dead buttons and reduce always-visible clutter

**Files:**

- Modify: `src/components/layout/app-shell-chrome.tsx`
- Modify: `src/config/navigation.ts`
- Modify: `src/app/loans/loan-card.tsx`

**Interfaces:**

- Consumes: `Button` (`src/components/ui/button.tsx`), `cn` (`src/shared/lib/cn.ts`), `PRIMARY_NAVIGATION` (`src/config/navigation.ts`).
- Produces: nothing new is consumed by later tasks — this task is self-contained.

#### Part A — Desktop sidebar collapse (currently a permanently-disabled dead button)

`src/components/layout/app-shell-chrome.tsx` currently renders a `PanelLeftClose` icon button in the header with a hardcoded `disabled` prop and no `onClick` — it has never done anything and never can, as written. Replace it with a real collapse/expand toggle for the desktop sidebar, persisted across visits the same way `src/shared/components/theme-toggle.tsx` persists the theme (a `localStorage` key read in a `useEffect` after mount, to avoid a hydration mismatch).

- [ ] **Step 1: Add collapse state and the `SidebarBrand` `hideText` prop**

In `src/components/layout/app-shell-chrome.tsx`, change the imports at the top:

```tsx
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react';
```

Add a storage key constant right after the existing `isActiveRoute` function:

```tsx
const SIDEBAR_COLLAPSED_KEY = 'hermes-sidebar-collapsed';
```

Inside `AppShellChrome`, alongside the existing `mobileOpen` state, add:

```tsx
const [collapsed, setCollapsed] = useState(false);

useEffect(() => {
  // Same rationale as ThemeToggle: syncing from localStorage (a system
  // outside React) is what effects are for — reading it during render
  // would risk a server/client hydration mismatch, since the server has
  // no localStorage to check against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
}, []);

function toggleCollapsed() {
  const next = !collapsed;
  setCollapsed(next);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
}
```

Add `useEffect` to the existing `useState` import from `react`:

```tsx
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: Make `navLinks` support an icon-only mode**

Replace the existing `navLinks` function with:

```tsx
const navLinks = (onNavigate?: () => void, iconOnly = false) =>
  PRIMARY_NAVIGATION.map((item) => {
    const Icon = item.icon;
    const active = isActiveRoute(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={iconOnly ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors',
          iconOnly && 'justify-center px-0',
          active
            ? 'border-ring bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-transparent',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!iconOnly && item.label}
      </Link>
    );
  });
```

- [ ] **Step 3: Give `SidebarBrand` a `hideText` prop**

Replace the `SidebarBrand` function at the bottom of the file with:

```tsx
function SidebarBrand({
  compact = false,
  hideText = false,
}: {
  compact?: boolean;
  hideText?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', compact ? '' : 'mb-8')}>
      <div className="bg-primary text-primary-foreground font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-semibold">
        H
      </div>
      {!hideText && (
        <div>
          <p className="font-display text-sm font-semibold">{APP_NAME}</p>
          <p className="text-muted-foreground text-xs">
            Sua prancheta financeira
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the collapsed state into the desktop `<aside>`**

Replace this block:

```tsx
<aside className="border-border/70 bg-sidebar hidden w-72 shrink-0 flex-col border-r py-6 lg:flex">
  <div className="px-5">
    <SidebarBrand />
  </div>
  <nav className="space-y-0.5 px-2">{navLinks()}</nav>
  <div className="mt-auto px-5">
    <Card className="registration-frame bg-card/70 p-4">
      <p className="text-sm font-semibold">{userLabel}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Sua central de comando financeira.
      </p>
    </Card>
  </div>
</aside>
```

with:

```tsx
<aside
  className={cn(
    'border-border/70 bg-sidebar hidden shrink-0 flex-col border-r py-6 transition-[width] duration-200 lg:flex',
    collapsed ? 'w-[4.5rem]' : 'w-72',
  )}
>
  <div className={cn('px-5', collapsed && 'px-3')}>
    <SidebarBrand hideText={collapsed} />
  </div>
  <nav className="space-y-0.5 px-2">{navLinks(undefined, collapsed)}</nav>
  {!collapsed && (
    <div className="mt-auto px-5">
      <Card className="registration-frame bg-card/70 p-4">
        <p className="text-sm font-semibold">{userLabel}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Sua central de comando financeira.
        </p>
      </Card>
    </div>
  )}
</aside>
```

(The mobile drawer's own `<SidebarBrand compact />` and `{navLinks(() => setMobileOpen(false))}` calls are untouched — the drawer never collapses.)

- [ ] **Step 5: Wire the header button to actually toggle**

Replace this block:

```tsx
<Button
  variant="outline"
  size="icon"
  className="hidden lg:inline-flex"
  disabled
>
  <PanelLeftClose className="h-4 w-4" />
</Button>
```

with:

```tsx
<Button
  variant="outline"
  size="icon"
  className="hidden lg:inline-flex"
  onClick={toggleCollapsed}
  aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
>
  {collapsed ? (
    <PanelLeftOpen className="h-4 w-4" />
  ) : (
    <PanelLeftClose className="h-4 w-4" />
  )}
</Button>
```

- [ ] **Step 6: Verify manually**

Run: `pnpm dev` (if not already running), open `/dashboard` at a desktop viewport width, click the new toggle button in the header. Confirm: the sidebar shrinks to an icon-only rail, the button's icon flips to `PanelLeftOpen`, hovering a nav icon shows its label as a native tooltip (the `title` attribute), and reloading the page keeps the collapsed state (via `localStorage`). Click again to expand and confirm it returns to normal.

#### Part B — Remove the "Configurações" nav item (permanently visible, points at an unbuilt page)

`src/app/settings/page.tsx` is an explicit "em construção" stub with no real functionality, yet `src/config/navigation.ts` lists it in `PRIMARY_NAVIGATION`, so every user sees a permanently-visible sidebar/mobile-drawer entry that leads nowhere useful on every single page of the app. Remove it from the primary navigation until a real settings page exists — don't advertise a destination with nothing behind it.

- [ ] **Step 1: Remove the nav entry**

In `src/config/navigation.ts`, remove the `Settings` icon from the `lucide-react` import list and remove this line from `PRIMARY_NAVIGATION`:

```ts
  { href: ROUTES.settings, label: 'Configurações', icon: Settings },
```

Leave `ROUTES.settings` in `src/config/routes.ts` and `src/app/settings/page.tsx` itself untouched — the route still exists and still works if visited directly, it's just no longer advertised as a permanent, always-visible nav destination with nothing behind it.

- [ ] **Step 2: Verify**

Run `pnpm typecheck` — `src/config/navigation.ts` must still compile with no unused-import lint error. Visually confirm `/dashboard` no longer shows a "Configurações" entry in the desktop sidebar or the mobile drawer.

#### Part C — Collapse the loan card's amortization table behind a disclosure

`src/app/loans/loan-card.tsx` always renders its full installment-by-installment amortization table (which can be dozens of rows for a long loan) on every card, on every visit to `/loans` — making a list of two or three loans an unscannable wall of tables. Hide it behind a "Ver parcelas detalhadas" toggle, closed by default.

- [ ] **Step 1: Add the disclosure state and toggle**

In `src/app/loans/loan-card.tsx`, add to the imports:

```tsx
import { ChevronDown } from 'lucide-react';
```

```tsx
import { cn } from '@/shared/lib/cn';
```

Inside the component, alongside the existing `useTransition` line, add:

```tsx
const [showSchedule, setShowSchedule] = useState(false);
```

Add `useState` to the existing `react` import (it currently only imports `useTransition`):

```tsx
import { useState, useTransition } from 'react';
```

- [ ] **Step 2: Gate the table behind the toggle**

Replace this block:

```tsx
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
```

with:

```tsx
      <button
        type="button"
        onClick={() => setShowSchedule((v) => !v)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors"
        aria-expanded={showSchedule}
      >
        {showSchedule ? 'Ocultar parcelas' : 'Ver parcelas detalhadas'}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            showSchedule && 'rotate-180',
          )}
        />
      </button>

      {showSchedule && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
```

And close the new wrapping `<div>` right after the existing `</table>` closing tag — i.e. change:

```tsx
        </table>
      </div>
    </Card>
  );
}
```

to:

```tsx
          </table>
        </div>
      )}
    </Card>
  );
}
```

(Re-indent the table's existing `<thead>`/`<tbody>` content one level deeper since it now sits inside two wrapping elements instead of one — indentation only, no logic change.)

- [ ] **Step 3: Verify manually**

Run `pnpm dev`, open `/loans` (create a loan first if none exist — the form is on the same page). Confirm the schedule table is hidden by default, the "Ver parcelas detalhadas" toggle reveals it with the chevron rotating, and clicking again hides it.

- [ ] **Step 4: Run checks and commit**

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. Fix any failures. Then:

```bash
git add src/components/layout/app-shell-chrome.tsx src/config/navigation.ts src/app/loans/loan-card.tsx
git commit -m "fix: implement sidebar collapse, drop unbuilt settings nav entry, collapse loan schedule table"
```

---

### Task 2: Standardize destructive-action and archive-action UX

**Files:**

- Modify: `src/app/budgets/delete-budget-button.tsx`
- Modify: `src/app/categories/delete-category-button.tsx`
- Modify: `src/app/categories/archive-category-button.tsx`
- Modify: `src/app/loans/loan-card.tsx`

**Interfaces:**

- Consumes: `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`, props: `trigger: React.ReactNode`, `title: string`, `description: string`, `confirmLabel?: string`, `onConfirm: () => Promise<void> | void`), `toast` (`src/shared/hooks/use-toast.ts`, call shape: `toast({ title: string, variant: 'success' | 'error' })`), `deleteBudgetAction(id: string): Promise<ActionResult>` (`src/app/budgets/actions.ts`), `deleteCategoryAction(id: string): Promise<ActionResult>` and `archiveCategoryAction(id: string, archived: boolean): Promise<ActionResult>` (`src/app/categories/actions.ts`), `deleteLoanAction(id: string): Promise<ActionResult>` (`src/app/loans/actions.ts`), where `ActionResult = { success: boolean; error?: string }`.
- Produces: nothing later tasks depend on.

`src/components/ui/confirm-dialog.tsx`'s own doc comment already states it is "the single confirmation pattern for destructive actions across the app." `src/app/accounts/account-card.tsx` and `src/app/loans/loan-card.tsx` already use it. But `DeleteBudgetButton` and `DeleteCategoryButton` predate it — their own code comments literally say "no modal system exists yet, a Dialog component is landing in a parallel workstream" — and were never migrated once `ConfirmDialog` shipped. They currently use two different inline two-step "click again to confirm" patterns instead. Separately, `ArchiveCategoryButton` and `loan-card.tsx`'s delete handler never call `toast()` on success or failure, unlike every other action in the app (see `src/app/accounts/account-card.tsx`'s `handleArchiveToggle`/`handleDelete` for the reference pattern). This task migrates both outliers onto `ConfirmDialog` and adds the missing toast feedback everywhere it's missing.

- [ ] **Step 1: Rewrite `DeleteBudgetButton` to use `ConfirmDialog` and toast**

Replace the entire contents of `src/app/budgets/delete-budget-button.tsx` with:

```tsx
'use client';

import { useTransition } from 'react';

import { deleteBudgetAction } from '@/app/budgets/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';

interface DeleteBudgetButtonProps {
  id: string;
}

export function DeleteBudgetButton({ id }: DeleteBudgetButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBudgetAction(id);
      toast(
        result.success
          ? { title: 'Orçamento excluído.', variant: 'success' }
          : {
              title: result.error ?? 'Não foi possível excluir.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
      }
      title="Excluir orçamento"
      description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
      onConfirm={handleDelete}
    />
  );
}
```

- [ ] **Step 2: Rewrite `DeleteCategoryButton` to use `ConfirmDialog` and toast**

Replace the entire contents of `src/app/categories/delete-category-button.tsx` with:

```tsx
'use client';

import { useTransition } from 'react';

import { deleteCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';

interface DeleteCategoryButtonProps {
  categoryId: string;
}

export function DeleteCategoryButton({
  categoryId,
}: DeleteCategoryButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
      toast(
        result.success
          ? { title: 'Categoria excluída.', variant: 'success' }
          : {
              title: result.error ?? 'Não foi possível excluir esta categoria.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
        >
          {isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
      }
      title="Excluir categoria"
      description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
      onConfirm={handleDelete}
    />
  );
}
```

Note: the previous version blocked deletion client-side when the category has transactions (surfacing the server's rejection as inline text). The new version surfaces that exact same server-provided `result.error` message via the toast instead of inline text — no behavior is lost, only the presentation channel changes, matching how every other delete button in the app already reports failures.

- [ ] **Step 3: Add toast feedback to `ArchiveCategoryButton`**

Replace the entire contents of `src/app/categories/archive-category-button.tsx` with:

```tsx
'use client';

import { useTransition } from 'react';

import { archiveCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/shared/hooks/use-toast';

interface ArchiveCategoryButtonProps {
  categoryId: string;
  archived: boolean;
}

export function ArchiveCategoryButton({
  categoryId,
  archived,
}: ArchiveCategoryButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await archiveCategoryAction(categoryId, !archived);
      toast(
        result.success
          ? {
              title: archived ? 'Categoria reativada.' : 'Categoria arquivada.',
              variant: 'success',
            }
          : {
              title:
                result.error ?? 'Não foi possível atualizar esta categoria.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? 'Aguarde…' : archived ? 'Reativar' : 'Arquivar'}
    </Button>
  );
}
```

- [ ] **Step 4: Add toast feedback to `loan-card.tsx`'s delete handler**

In `src/app/loans/loan-card.tsx` (already modified by Task 1 for the schedule disclosure — make these additional, separate edits to the same file), add to the imports:

```tsx
import { toast } from '@/shared/hooks/use-toast';
```

Replace:

```tsx
          onConfirm={() =>
            startTransition(async () => {
              await deleteLoanAction(id);
            })
          }
```

with:

```tsx
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteLoanAction(id);
              toast(
                result.success
                  ? { title: 'Empréstimo excluído.', variant: 'success' }
                  : {
                      title: result.error ?? 'Não foi possível excluir.',
                      variant: 'error',
                    },
              );
            })
          }
```

- [ ] **Step 5: Verify manually**

Run `pnpm dev`. On `/budgets`, delete a budget and confirm a `ConfirmDialog` modal appears (not the old inline "Confirmar exclusão?" button morph) and a success toast fires. On `/categories`, delete a category and confirm the same modal pattern plus a toast; archive/reactivate a category and confirm a toast fires either way. On `/loans`, delete a loan and confirm a toast fires (the modal already existed here — only the toast is new).

- [ ] **Step 6: Run checks and commit**

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. Fix any failures. Then:

```bash
git add src/app/budgets/delete-budget-button.tsx src/app/categories/delete-category-button.tsx src/app/categories/archive-category-button.tsx src/app/loans/loan-card.tsx
git commit -m "fix: standardize destructive/archive actions on ConfirmDialog + toast feedback"
```

---

### Task 3: Fix dark-theme contrast bugs

**Files:**

- Modify: `src/components/ui/alert.tsx`
- Modify: `src/components/ui/button.tsx`

**Interfaces:**

- Consumes: existing CSS custom properties in `src/app/globals.css` (`--success`, `--warning`, `--destructive`, `--info`, `--destructive-foreground`), already mapped in `@theme inline` to `text-success`, `text-warning`, `text-destructive`, `text-info`, `text-destructive-foreground`.
- Produces: nothing later tasks depend on.

Two real dark-theme (and, for `alert.tsx`, light-theme too) contrast bugs, found by comparing against the app's own already-correct pattern in `src/components/ui/badge.tsx`.

**Bug 1 — `alert.tsx`:** the `success`/`warning`/`error`/`info` variants pair a barely-tinted background (`bg-success/10`, etc. — 10% opacity over the page background) with `text-{variant}-foreground`. Those `-foreground` tokens are designed for **solid, fully-opaque** backgrounds (e.g. white-ish text for a solid red destructive button) — used against a background that's still ~90% the page's own color, the text ends up nearly the same color as the background in both themes. `badge.tsx` solves the identical problem correctly one file over: it pairs a `/15`-opacity tint with the **base** color as text (`text-success`, `text-warning`, `text-destructive`), which stays legible against its own light tint in both themes. Apply the same fix to `alert.tsx`.

- [ ] **Step 1: Fix the alert variant text colors**

In `src/components/ui/alert.tsx`, replace:

```tsx
      success: 'border-success/30 bg-success/10 text-success-foreground',
      warning: 'border-warning/30 bg-warning/10 text-warning-foreground',
      error:
        'border-destructive/30 bg-destructive/10 text-destructive-foreground',
      info: 'border-info/30 bg-info/10 text-info-foreground',
```

with:

```tsx
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/10 text-warning',
      error: 'border-destructive/30 bg-destructive/10 text-destructive',
      info: 'border-info/30 bg-info/10 text-info',
```

**Bug 2 — `button.tsx`:** the `destructive` variant hardcodes `text-white` instead of using the `text-destructive-foreground` token every other variant in this same file correctly uses (see `default`'s `text-primary-foreground`, `secondary`'s `text-secondary-foreground`). In dark mode `--destructive` is a light coral (`#e0685a`) with `--destructive-foreground` deliberately set to a near-black (`#2a0e09`) for contrast against it — but the hardcoded white text ignores that pairing entirely, giving low-contrast white-on-light-coral text in dark mode instead of the intended dark-on-light-coral.

- [ ] **Step 2: Fix the destructive button text color**

In `src/components/ui/button.tsx`, replace:

```tsx
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
```

with:

```tsx
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
```

- [ ] **Step 3: Verify manually in both themes**

Run `pnpm dev`. Toggle to dark mode (the theme toggle in the header). Visit a page that renders an `Alert` (e.g. trigger the "Tentar novamente" error alert on `/transactions` by simulating a failed load, or check any existing error state) and confirm the text is now clearly legible against its tinted background, in both light and dark mode. Click any destructive button (e.g. a delete confirm) in both themes and confirm the label text is clearly legible against the red/coral background in both.

- [ ] **Step 4: Run checks and commit**

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. Fix any failures. Then:

```bash
git add src/components/ui/alert.tsx src/components/ui/button.tsx
git commit -m "fix: correct dark-theme text contrast in Alert and destructive Button"
```
