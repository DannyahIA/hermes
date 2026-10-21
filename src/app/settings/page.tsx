import { AppShell } from '@/components/layout/app-shell';
import { env, getTelegramBot } from '@/config/env';
import type { CaptureEvent } from '@/core/entities/capture-event';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleApiTokenRepository } from '@/infra/repositories/drizzle-api-token.repository';
import { DrizzleCaptureEventRepository } from '@/infra/repositories/drizzle-capture-event.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleChatLinkRepository } from '@/infra/repositories/drizzle-chat-link.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { DrizzleWalletCardRepository } from '@/infra/repositories/drizzle-wallet-card.repository';
import { GetChatPrivacyUseCase } from '@/modules/capture/application/chat-privacy.use-case';
import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';
import { parseAmount } from '@/modules/capture/domain/parse-amount';
import { formatCurrency } from '@/shared/lib/format-currency';
import {
  formatDate,
  formatDayLabel,
  formatSince,
  formatTimeOfDay,
} from '@/shared/lib/format-date';

import { CaptureTokens, type TokenView } from './capture-tokens';
import { MerchantRules, type MerchantRuleView } from './merchant-rules';
import { PendingCaptures, type PendingCaptureView } from './pending-captures';
import { ShortcutRecipe } from './shortcut-recipe';
import { TelegramConnection } from './telegram-connection';
import { WalletCards, type WalletCardView } from './wallet-cards';

const KIND_ORDER = { credit: 0, checking: 1, savings: 2 } as const;

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

function describeCapture(event: CaptureEvent, cardName: string): string {
  const { displayName } = normalizeMerchant(event.payload.merchant ?? '');
  return displayName || `Compra no ${cardName}`;
}

function when(date: Date, now: Date): string {
  const time = formatTimeOfDay(date);
  return `${formatDayLabel(date, now)}${time ? ` às ${time}` : ''}`;
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="sheet-surface">
      <header className="border-border border-b px-4 py-3 sm:px-6">
        <h2 id={id} className="font-display text-base font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </section>
  );
}

/**
 * Configurações › Integrações (spec 2026-10-17-telegram-apple-pay-design.md
 * §6): the iPhone shortcut that reports Apple Pay payments, the Telegram
 * chat that tells about them, the Wallet's cards, the merchants it
 * remembers and the payments still waiting for something.
 */
export default async function SettingsPage() {
  const userId = await requireCurrentUserId();
  const now = new Date();
  const events = new DrizzleCaptureEventRepository();

  const [
    tokens,
    cards,
    accounts,
    pending,
    [latest],
    chatLink,
    chatPrivacy,
    rules,
    categories,
  ] = await Promise.all([
    new DrizzleApiTokenRepository().findByUserId(userId),
    new DrizzleWalletCardRepository().findByUserId(userId),
    new DrizzleAccountRepository().findByUserId(userId),
    events.findByUserId(userId, {
      statuses: ['needs_account', 'needs_amount'],
    }),
    // The shortcut's last payment: lines written in the chat aren't it.
    events.findByUserId(userId, { sources: ['wallet'], limit: 1 }),
    new DrizzleChatLinkRepository().findActiveByUserId(userId),
    new GetChatPrivacyUseCase(new DrizzleViewPreferenceRepository()).execute(
      userId,
    ),
    new DrizzleMerchantRuleRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
  ]);
  const latestTransaction = latest?.transactionId
    ? await new DrizzleTransactionRepository().findById(latest.transactionId)
    : null;

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const cardNames = new Map(cards.map((card) => [card.id, card.walletName]));
  const cardOf = (event: CaptureEvent) =>
    (event.walletCardId && cardNames.get(event.walletCardId)) ||
    event.payload.card ||
    'cartão sem nome';

  const tokenViews: TokenView[] = tokens
    .filter((token) => !token.revoked)
    .map((token) => ({
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      created: `criado em ${formatDate(token.props.createdAt)}`,
      used: token.lastUsedAt
        ? `usado ${formatSince(token.lastUsedAt, now)}`
        : 'ainda não usado',
    }));

  const usable = accounts
    .filter((account) => !account.archived)
    .sort(
      (a, b) =>
        KIND_ORDER[a.type] - KIND_ORDER[b.type] ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
    .map((account) => ({ id: account.id, name: account.name }));

  const cardViews: WalletCardView[] = cards.map((card) => ({
    id: card.id,
    walletName: card.walletName,
    accountId: card.accountId ?? null,
    alternateAccountId: card.alternateAccountId ?? null,
    waiting: pending.filter(
      (event) =>
        event.walletCardId === card.id && event.status === 'needs_account',
    ).length,
  }));

  const pendingViews: PendingCaptureView[] = pending.map((event) => {
    const amount =
      event.payload.amount === null ? null : parseAmount(event.payload.amount);
    return {
      id: event.id,
      description: describeCapture(event, cardOf(event)),
      cardName: cardOf(event),
      when: when(new Date(event.payload.occurredAt), now),
      amount: amount && amount > 0 ? formatCurrency(amount) : null,
      status: event.status as PendingCaptureView['status'],
    };
  });

  let latestLine: string | null = null;
  if (latest) {
    const since = formatSince(latest.createdAt, now);
    latestLine = latestTransaction
      ? `Última compra recebida ${since}: ${latestTransaction.description}, ${formatCurrency(latestTransaction.amount)}, em ${accountNames.get(latestTransaction.accountId) ?? 'conta removida'}.`
      : latest.pending
        ? `Última compra recebida ${since}: ${describeCapture(latest, cardOf(latest))}, esperando você abaixo.`
        : `Última compra recebida ${since}: ${describeCapture(latest, cardOf(latest))}.`;
  }

  const categoryOptions = categories
    .filter((category) => !category.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((category) => ({ id: category.id, name: category.name }));
  const ruleViews: MerchantRuleView[] = rules
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
    .map((rule) => ({
      id: rule.id,
      name: rule.displayName,
      categoryId: rule.categoryId,
      usage:
        rule.hits === 1
          ? 'Escolhida uma vez'
          : `Escolhida ${rule.hits} vezes seguidas`,
    }));

  const telegramStatus = chatLink
    ? `Conectado${chatLink.username ? ` como @${chatLink.username}` : ''} desde ${dayMonth.format(chatLink.linkedAt)}.`
    : null;

  const captureUrl = `${(env.CAPTURE_BASE_URL ?? env.NEXT_PUBLIC_APP_URL).replace(/\/$/, '')}/api/capture/wallet`;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        {pendingViews.length > 0 && (
          <Section
            id="pending-heading"
            title="Esperando você"
            description="Compras que o atalho mandou e ainda não viraram transação."
          >
            <PendingCaptures captures={pendingViews} />
          </Section>
        )}

        <Section
          id="shortcut-heading"
          title="Atalho do iPhone"
          description="Cada pagamento por aproximação no iPhone vira uma despesa no Hermes, na conta do cartão usado, sem abrir o app."
        >
          <div className="space-y-5">
            <p
              className="border-border text-muted-foreground border-l-2 pl-3 text-sm"
              aria-live="polite"
            >
              {latestLine ??
                'Nenhuma compra recebida ainda. Depois de configurar o atalho, a primeira aparece aqui.'}
            </p>
            <CaptureTokens tokens={tokenViews} />
            <ShortcutRecipe captureUrl={captureUrl} />
          </div>
        </Section>

        <Section
          id="telegram-heading"
          title="Telegram"
          description="O Hermes avisa cada pagamento no Telegram, e você resolve ali mesmo."
        >
          <TelegramConnection
            botUsername={getTelegramBot()?.username ?? null}
            connected={telegramStatus}
            showFree={chatPrivacy.showFree}
          />
        </Section>

        <Section
          id="cards-heading"
          title="Cartões da Wallet"
          description="Para qual conta vai cada cartão. Débito vai para a conta corrente; crédito, para o cartão de crédito."
        >
          <WalletCards cards={cardViews} accounts={usable} />
        </Section>

        <Section
          id="merchants-heading"
          title="Estabelecimentos"
          description="A categoria que o Hermes lembra de cada lugar. A próxima compra lá já entra nela."
        >
          <MerchantRules rules={ruleViews} categories={categoryOptions} />
        </Section>
      </div>
    </AppShell>
  );
}
