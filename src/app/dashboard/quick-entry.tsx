'use client';

import { ChevronDown, CircleAlert, Info } from 'lucide-react';
import { startTransition, useId, useState, useTransition } from 'react';

import { deleteTransactionAction } from '@/app/transactions/actions';
import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';
import type { TransactionDraft } from '@/app/transactions/transaction-form';
import { Button } from '@/components/ui/button';
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import type { MerchantMemoryEntry } from '@/modules/capture/domain/merchant-memory';
import {
  parseQuickEntry,
  type QuickEntry as Entry,
  type QuickEntryAccount,
} from '@/modules/capture/domain/parse-quick-entry';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDayLabel, formatTimeOfDay } from '@/shared/lib/format-date';

import { recordQuickEntryAction } from './actions';
import type { CategoryOption } from './category-picker';

interface QuickEntryProps {
  /** Accounts that can take an entry, with how much each is used. */
  accounts: QuickEntryAccount[];
  /** Categories that can take an entry, sorted by name. */
  categories: CategoryOption[];
  merchants: MerchantMemoryEntry[];
}

interface Overrides {
  type?: Entry['type'];
  accountId?: string;
  /** Null files it under no category on purpose. */
  categoryId?: string | null;
}

const EXAMPLE = 'almoço 32,50 crédito';
const BLOCKING: Array<Entry['issues'][number]['code']> = [
  'missing-amount',
  'missing-description',
  'no-account',
];

const plainNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

function joinWithE(items: string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

/** What to tell the person about the line, if anything. */
function issueMessage(entry: Entry): string | null {
  const codes = entry.issues.map((issue) => issue.code);
  if (codes.includes('no-account')) return 'Cadastre uma conta para registrar.';
  if (
    codes.includes('missing-amount') &&
    codes.includes('missing-description')
  ) {
    return `Escreva o que foi e o valor, como em ${EXAMPLE}.`;
  }
  if (codes.includes('missing-amount')) {
    return `Falta o valor, como em ${EXAMPLE}.`;
  }
  if (codes.includes('missing-description')) {
    return `Falta dizer o que foi, como em ${EXAMPLE}.`;
  }
  const several = entry.issues.find(
    (issue) => issue.code === 'several-amounts',
  );
  if (several?.code === 'several-amounts' && entry.amount !== null) {
    const others = several.ignored.map(plainNumber);
    return `Usei ${formatCurrency(entry.amount)} como valor; ${joinWithE(others)} ${others.length > 1 ? 'ficaram' : 'ficou'} na descrição.`;
  }
  return null;
}

function when(date: Date, now: Date): string {
  const time = formatTimeOfDay(date);
  return `${formatDayLabel(date, now)}${time ? ` às ${time}` : ''}`;
}

/**
 * One line at the top of the Início that takes an entry the way it would
 * be typed in a message — "almoço 32,50 crédito" — and shows, as it is
 * typed, what was understood: a row of labelled cells, like a drawing's
 * title block being filled in (spec 2026-10-17-inicio-hub-design.md §4.8).
 * Type, account and category can be changed right there; "Mais opções"
 * opens the full form with everything filled in. Enter records, Esc
 * clears; the toast that confirms it can undo it.
 */
export function QuickEntry({
  accounts,
  categories,
  merchants,
}: QuickEntryProps) {
  const [text, setText] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [focused, setFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, startRecording] = useTransition();
  const id = useId();
  const messageId = `${id}-message`;

  const context = { accounts, categories, merchants };
  const read = (at: Date): Entry | null => {
    if (!text.trim()) return null;
    const parsed = parseQuickEntry(text, { ...context, now: at });
    return {
      ...parsed,
      type: overrides.type ?? parsed.type,
      accountId: overrides.accountId ?? parsed.accountId,
      categoryId:
        overrides.categoryId !== undefined
          ? overrides.categoryId
          : parsed.categoryId,
    };
  };
  const entry = now ? read(now) : null;
  const date = entry && now ? when(entry.occurredAt, now) : '';
  const message = entry ? issueMessage(entry) : null;
  const blocked =
    !entry || entry.issues.some((issue) => BLOCKING.includes(issue.code));

  const accountName = (accountId: string | null) =>
    accounts.find((account) => account.id === accountId)?.name ?? '';
  const categoryName = (categoryId: string | null) =>
    categories.find((category) => category.id === categoryId)?.name;

  function change(value: string) {
    setText(value);
    setNow(new Date());
    if (!value.trim()) setOverrides({});
  }

  function clear() {
    setText('');
    setOverrides({});
  }

  function record(event: React.FormEvent) {
    event.preventDefault();
    // Read again now, so "hoje" carries the moment of the Enter.
    const final = read(new Date());
    if (
      !final ||
      final.amount === null ||
      !final.accountId ||
      final.issues.some((issue) => BLOCKING.includes(issue.code))
    ) {
      return;
    }
    const { description, amount, type, accountId, categoryId, occurredAt } =
      final;
    const typed = text;
    clear();

    startRecording(async () => {
      const result = await recordQuickEntryAction({
        description,
        amount,
        type,
        accountId,
        categoryId,
        occurredAt: occurredAt.toISOString(),
      });
      const summary = `${description}, ${formatCurrency(amount)}`;
      if (!result.success) {
        // Give the line back, unless something new was typed meanwhile.
        setText((current) => current || typed);
        setNow(new Date());
        toast({ title: result.error, variant: 'error' });
        return;
      }
      toast({
        title: `Registrado: ${summary}`,
        description: `${accountName(accountId)}, ${categoryName(categoryId) ?? 'sem categoria'}`,
        variant: 'success',
        action: {
          label: 'Desfazer',
          onClick: () =>
            startTransition(async () => {
              const undone = await deleteTransactionAction(
                result.transactionId,
              );
              toast(
                undone.success
                  ? {
                      title: 'Registro desfeito',
                      description: summary,
                      variant: 'default',
                    }
                  : {
                      title: 'Não foi possível desfazer. Apague em Transações.',
                      variant: 'error',
                    },
              );
            }),
        },
      });
    });
  }

  const draft: TransactionDraft = entry
    ? {
        type: entry.type,
        amount: entry.amount ?? undefined,
        description: entry.description || undefined,
        accountId: entry.accountId ?? undefined,
        categoryId: entry.categoryId ?? undefined,
        occurredAt: entry.occurredAt,
      }
    : {};
  const accountOptions = [...accounts].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );

  return (
    <section
      aria-label="Registro rápido"
      className="bg-subtle border-border focus-within:bg-card focus-within:border-ring focus-within:ring-ring/20 overflow-hidden rounded-lg border transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] focus-within:ring-[3px]"
    >
      <form onSubmit={record} className="flex items-stretch">
        <label
          htmlFor={id}
          className="font-display border-border text-muted-foreground hidden shrink-0 items-center border-r px-4 text-sm font-medium sm:flex"
        >
          Registro rápido
        </label>
        <input
          id={id}
          value={text}
          onChange={(event) => change(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            if (text) {
              event.preventDefault();
              clear();
            } else {
              event.currentTarget.blur();
            }
          }}
          placeholder={EXAMPLE}
          aria-label="Registro rápido"
          aria-describedby={
            message || (focused && !text) ? messageId : undefined
          }
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-4 py-2.5 text-base outline-none sm:text-sm"
        />
        <div className="flex items-center py-2 pr-2">
          <Button type="submit" size="sm" disabled={blocked}>
            {pending ? 'Registrando…' : 'Registrar'}
          </Button>
        </div>
      </form>

      {entry ? (
        <>
          <dl className="bg-border border-border grid grid-cols-2 gap-px border-t sm:grid-cols-3 xl:flex">
            <Cell label="Descrição" className="xl:min-w-36 xl:flex-[1_1_0%]">
              {entry.description ? (
                <span className="truncate" title={entry.description}>
                  {entry.description}
                </span>
              ) : (
                <Missing />
              )}
            </Cell>
            <Cell label="Valor">
              {entry.amount !== null ? (
                <span
                  className={cn(
                    'dimension-figure whitespace-nowrap',
                    entry.type === 'income'
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {entry.type === 'income' ? '+ ' : '− '}
                  {formatCurrency(entry.amount)}
                </span>
              ) : (
                <Missing />
              )}
            </Cell>
            <SelectCell
              label="Tipo"
              value={entry.type}
              shown={TRANSACTION_TYPE_LABELS[entry.type]}
              onChange={(value) =>
                setOverrides((current) => ({
                  ...current,
                  type: value as Entry['type'],
                }))
              }
              options={[
                { value: 'expense', label: TRANSACTION_TYPE_LABELS.expense },
                { value: 'income', label: TRANSACTION_TYPE_LABELS.income },
              ]}
            />
            <SelectCell
              label="Conta"
              className={SHRINKS}
              value={entry.accountId ?? ''}
              shown={accountName(entry.accountId)}
              onChange={(value) =>
                setOverrides((current) => ({ ...current, accountId: value }))
              }
              options={accountOptions.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
            />
            <SelectCell
              label="Categoria"
              className={SHRINKS}
              value={entry.categoryId ?? ''}
              shown={categoryName(entry.categoryId) ?? 'Sem categoria'}
              muted={!entry.categoryId}
              onChange={(value) =>
                setOverrides((current) => ({
                  ...current,
                  categoryId: value || null,
                }))
              }
              options={[
                { value: '', label: 'Sem categoria' },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
            <Cell label="Data">
              <span className="truncate">{date}</span>
            </Cell>
          </dl>
          <div className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2">
            <p
              id={messageId}
              className="flex min-w-0 items-start gap-2 py-1 text-sm"
            >
              {message && (
                <>
                  {blocked ? (
                    <CircleAlert
                      aria-hidden
                      className="text-warning mt-0.5 size-4 shrink-0"
                    />
                  ) : (
                    <Info
                      aria-hidden
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    />
                  )}
                  {message}
                </>
              )}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-muted-foreground hidden text-xs lg:inline">
                Enter registra, Esc limpa
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMoreOpen(true)}
              >
                Mais opções
              </Button>
            </div>
          </div>
        </>
      ) : (
        focused && (
          <p
            id={messageId}
            className="border-border text-muted-foreground border-t px-4 py-2.5 text-sm"
          >
            Escreva como numa mensagem: uber 18 débito, +3000 salário, mercado
            250,40 ontem.
          </p>
        )
      )}

      {/* Always present: a live region announces changes, not its arrival. */}
      <p className="sr-only" aria-live="polite">
        {entry &&
          (entry.amount !== null && entry.description
            ? `${TRANSACTION_TYPE_LABELS[entry.type]} de ${formatCurrency(entry.amount)}, ${entry.description}, em ${accountName(entry.accountId)}, ${categoryName(entry.categoryId) ?? 'sem categoria'}, ${date.toLowerCase()}.`
            : message)}
      </p>

      {/* Outside the preview, so it stays open for "Criar mais" after the
          line it came from is cleared. */}
      <CreateTransactionDialog
        accounts={accountOptions}
        categories={categories}
        defaults={draft}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onSuccess={clear}
        trigger={() => null}
      />
    </section>
  );
}

/**
 * On a wide screen the cells sit in one row, each as wide as its value;
 * the description takes what's left, and when a row runs short only the
 * names (description, account, category) give way, never an amount, a
 * kind or a date.
 */
const CELL = 'bg-card min-w-0 px-4 py-2 xl:flex-none';
const SHRINKS = 'xl:flex-[0_1_auto]';

function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(CELL, className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-muted-foreground font-normal">—</span>;
}

/**
 * A cell that reads like the others, with a native select laid over it:
 * the phone's own picker, the keyboard's arrows, and no width taken from
 * the longest option.
 */
function SelectCell({
  label,
  value,
  shown,
  muted = false,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  shown: string;
  muted?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        CELL,
        'hover:bg-muted/40 focus-within:ring-ring relative focus-within:z-10 focus-within:ring-2 focus-within:ring-inset',
        className,
      )}
    >
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1 text-sm font-medium">
        <span
          className={cn(
            'truncate',
            muted && 'text-muted-foreground font-normal',
          )}
          title={shown}
        >
          {shown}
        </span>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-3.5 shrink-0"
        />
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </dd>
    </div>
  );
}
