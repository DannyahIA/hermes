'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';

import { ROUTES } from '@/config/routes';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';

import { assignWalletCardAction } from './actions';

export interface WalletCardView {
  id: string;
  walletName: string;
  accountId: string | null;
  alternateAccountId: string | null;
  /** Payments waiting for this card to get an account. */
  waiting: number;
}

interface WalletCardsProps {
  cards: WalletCardView[];
  /** Accounts that can take payments, cards first. */
  accounts: Array<{ id: string; name: string }>;
}

/**
 * Each card the Wallet reported, and where its payments go. A card shows
 * up here by itself after its first payment; picking its account records
 * the payments that were waiting for it.
 */
export function WalletCards({ cards, accounts }: WalletCardsProps) {
  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        <Link href={ROUTES.accounts} className="text-foreground underline">
          Crie uma conta
        </Link>{' '}
        para receber as compras: cada cartão da Wallet vai para uma delas.
      </p>
    );
  }
  if (cards.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Os cartões aparecem aqui depois da primeira compra que o atalho mandar.
        Você escolhe para qual conta vai cada um, uma vez só.
      </p>
    );
  }

  return (
    <ul>
      {cards.map((card) => (
        <WalletCardRow key={card.id} card={card} accounts={accounts} />
      ))}
    </ul>
  );
}

function WalletCardRow({
  card,
  accounts,
}: {
  card: WalletCardView;
  accounts: WalletCardsProps['accounts'];
}) {
  const [shown, show] = useOptimistic(card);
  const [isPending, startTransition] = useTransition();

  function save(accountId: string, alternateAccountId: string | null) {
    if (!accountId) return;
    startTransition(async () => {
      show({ ...card, accountId, alternateAccountId, waiting: 0 });
      const result = await assignWalletCardAction({
        walletCardId: card.id,
        accountId,
        alternateAccountId,
      });
      if (!result.success) {
        toast({ title: result.error, variant: 'error' });
        return;
      }
      const account = accounts.find((option) => option.id === accountId);
      toast({
        title: `${card.walletName} vai para ${account?.name ?? 'a conta escolhida'}.`,
        description:
          result.recorded > 0
            ? `${result.recorded} ${result.recorded === 1 ? 'compra que esperava foi registrada' : 'compras que esperavam foram registradas'}.`
            : undefined,
        variant: 'success',
      });
    });
  }

  const nameId = `card-${card.id}`;

  return (
    <li
      className={cn(
        'dimension-row flex-wrap gap-x-4 gap-y-2 py-3',
        isPending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 basis-40">
        <p id={nameId} className="truncate font-medium">
          {card.walletName}
        </p>
        <p className="text-muted-foreground text-xs">
          {!shown.accountId
            ? card.waiting > 0
              ? `Novo. ${card.waiting} ${card.waiting === 1 ? 'compra espera' : 'compras esperam'} a conta.`
              : 'Novo. Escolha a conta.'
            : 'Nome como aparece na Wallet.'}
        </p>
      </div>
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="text-muted-foreground text-xs">Vai para</span>
        <select
          aria-describedby={nameId}
          value={shown.accountId ?? ''}
          disabled={isPending}
          onChange={(event) =>
            save(event.target.value, shown.alternateAccountId)
          }
          className={cn(
            FIELD_BASE_CLASSES,
            !shown.accountId && 'border-warning',
          )}
        >
          {!shown.accountId && (
            <option value="" disabled>
              Escolha a conta…
            </option>
          )}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="text-muted-foreground text-xs">
          Também paga como (opcional)
        </span>
        <select
          aria-describedby={nameId}
          value={shown.alternateAccountId ?? ''}
          disabled={isPending || !shown.accountId}
          onChange={(event) =>
            save(shown.accountId ?? '', event.target.value || null)
          }
          className={FIELD_BASE_CLASSES}
        >
          <option value="">Só essa conta</option>
          {accounts
            .filter((account) => account.id !== shown.accountId)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
      </label>
    </li>
  );
}
