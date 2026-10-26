import type { ChatButton, ChatMessage } from '@/core/contracts/chat-channel';
import { formatCurrency } from '@/shared/lib/format-currency';

import { encodeChatAction, INSTALLMENT_CHOICES } from './chat-action';

export interface Named {
  id: string;
  name: string;
}

/** A recorded payment, as its message shows it. */
export interface RecordedView {
  kind: 'recorded';
  captureId: string;
  /** "hoje 12:41" */
  when: string;
  description: string;
  amount: number;
  accountName: string;
  category?: Named;
  /** The merchant has just been taught this category. */
  learned?: boolean;
  /** When it became an installment plan. */
  installments?: { count: number; each: number; first: string };
  /** Paid on a credit card, so it can be split into installments. */
  installable: boolean;
  /** "Foi no débito": for a Wallet card that pays both ways. */
  switchLabel?: string;
  suggestions: Named[];
  /** A common category the merchant is missing: offered first, made on tap. */
  newCategory?: { key: string; name: string };
  /** "Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)" */
  free?: string;
}

/** A payment from a card that has no account yet. */
export interface NeedsAccountView {
  kind: 'needs_account';
  captureId: string;
  when: string;
  description: string;
  amount: number | null;
  cardName: string;
  accounts: Named[];
  /** There are more accounts than the buttons show. */
  moreAccounts?: boolean;
}

/** An entry written in the chat, held until the person says it is right. */
export interface NeedsConfirmView {
  kind: 'needs_confirm';
  captureId: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  accountName: string;
  /** "hoje", "ontem", "em 17/10". */
  day: string;
}

export type CaptureView =
  | RecordedView
  | NeedsAccountView
  | NeedsConfirmView
  | { kind: 'undone'; description: string; amount: number; plan: boolean }
  | { kind: 'discarded'; description: string }
  /** Recorded, then deleted in the app. */
  | { kind: 'gone'; description: string }
  /** An entry from the chat the person said was wrong. */
  | { kind: 'not-saved'; description: string };

const PAGE_SIZE = 8;

function rows(buttons: ChatButton[], size: number): ChatButton[][] {
  const result: ChatButton[][] = [];
  for (let index = 0; index < buttons.length; index += size) {
    result.push(buttons.slice(index, index + size));
  }
  return result;
}

function heading(view: RecordedView): string[] {
  const value = view.installments
    ? `${view.installments.count}× de ${formatCurrency(view.installments.each)}`
    : formatCurrency(view.amount);
  return [
    [view.accountName, value, view.category?.name].filter(Boolean).join(' · '),
    `${view.description} · ${view.when}`,
  ];
}

function recordedMessage(view: RecordedView): ChatMessage {
  const lines = heading(view);
  if (view.installments) {
    lines.push(
      `Parcelado: ${formatCurrency(view.amount)} em ${view.installments.count} vezes, a primeira ${view.installments.first}.`,
    );
  } else if (!view.category) {
    lines.push('Categoria?');
  }
  if (view.free) lines.push(view.free);
  if (view.learned && view.category) {
    lines.push(
      `Da próxima vez, ${view.description} já entra em ${view.category.name}.`,
    );
  }

  const { captureId } = view;
  const buttons: ChatButton[][] = [];
  if (!view.category && !view.installments) {
    const choices: ChatButton[] = [];
    if (view.newCategory) {
      choices.push({
        text: `＋ ${view.newCategory.name}`,
        data: encodeChatAction({
          kind: 'new-category',
          captureId,
          key: view.newCategory.key,
        }),
      });
    }
    choices.push(
      ...view.suggestions.map((category) => ({
        text: category.name,
        data: encodeChatAction({
          kind: 'category',
          captureId,
          categoryId: category.id,
        }),
      })),
      {
        text: 'Outra…',
        data: encodeChatAction({
          kind: 'pick-category',
          captureId,
          page: 0,
        }),
      },
    );
    buttons.push(...rows(choices, 2));
  }
  const actions: ChatButton[] = [];
  if (!view.installments) {
    if (view.category) {
      actions.push({
        text: 'Trocar categoria',
        data: encodeChatAction({ kind: 'pick-category', captureId, page: 0 }),
      });
    }
    if (view.switchLabel) {
      actions.push({
        text: view.switchLabel,
        data: encodeChatAction({ kind: 'switch-account', captureId }),
      });
    }
    if (view.installable) {
      actions.push({
        text: 'Parcelar',
        data: encodeChatAction({ kind: 'ask-installments', captureId }),
      });
    }
  }
  actions.push({
    text: 'Desfazer',
    data: encodeChatAction({ kind: 'undo', captureId }),
  });
  buttons.push(...rows(actions, 3));

  return { text: lines.join('\n'), buttons };
}

/** The message about a payment, as it stands now. */
export function captureMessage(view: CaptureView): ChatMessage {
  switch (view.kind) {
    case 'recorded':
      return recordedMessage(view);
    case 'needs_account': {
      const value = view.amount === null ? null : formatCurrency(view.amount);
      return {
        text: [
          `Primeira compra que vejo com "${view.cardName}":`,
          [view.description, value, view.when].filter(Boolean).join(' · '),
          view.accounts.length > 0
            ? 'Ela vai para qual conta?'
            : 'Crie uma conta no Hermes para receber as compras deste cartão.',
          view.moreAccounts
            ? 'As outras estão em Configurações › Cartões da Wallet.'
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        buttons: [
          ...rows(
            view.accounts.map((account) => ({
              text: account.name,
              data: encodeChatAction({
                kind: 'card-account',
                captureId: view.captureId,
                accountId: account.id,
              }),
            })),
            2,
          ),
          [
            {
              text: 'Descartar',
              data: encodeChatAction({
                kind: 'discard',
                captureId: view.captureId,
              }),
            },
          ],
        ],
      };
    }
    case 'undone':
      return {
        text: view.plan
          ? `Desfeito. O parcelamento de ${formatCurrency(view.amount)} em ${view.description} não foi registrado.`
          : `Desfeito. ${formatCurrency(view.amount)} em ${view.description} não foi registrado.`,
      };
    case 'discarded':
      return {
        text: `Descartada. A compra em ${view.description} não foi registrada.`,
      };
    case 'gone':
      return {
        text: `A compra em ${view.description} não está mais no Hermes.`,
      };
    case 'needs_confirm': {
      const what =
        view.type === 'income'
          ? `uma entrada de ${formatCurrency(view.amount)}`
          : formatCurrency(view.amount);
      const day = view.day === 'hoje' ? '' : `, ${view.day}`;
      return {
        text: `Entendi ${what} em ${view.description}${day} (${view.accountName}). Salvo?`,
        buttons: [
          [
            {
              text: 'Salvar',
              data: encodeChatAction({
                kind: 'confirm',
                captureId: view.captureId,
              }),
            },
            {
              text: 'Corrigir',
              data: encodeChatAction({
                kind: 'discard',
                captureId: view.captureId,
              }),
            },
          ],
        ],
      };
    }
    case 'not-saved':
      return {
        text: `Não salvei ${view.description}. Mande de novo do jeito certo, como "mercado 870 crédito".`,
      };
  }
}

/** Every category, a page at a time, under the payment's heading. */
export function categoryPickerMessage(
  view: RecordedView,
  categories: Named[],
  page: number,
): ChatMessage {
  const pages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const { captureId } = view;
  const navigation: ChatButton[] = [];
  if (current > 0) {
    navigation.push({
      text: '‹ Anteriores',
      data: encodeChatAction({
        kind: 'pick-category',
        captureId,
        page: current - 1,
      }),
    });
  }
  if (current < pages - 1) {
    navigation.push({
      text: 'Mais ›',
      data: encodeChatAction({
        kind: 'pick-category',
        captureId,
        page: current + 1,
      }),
    });
  }
  navigation.push({
    text: 'Voltar',
    data: encodeChatAction({ kind: 'show', captureId }),
  });

  return {
    text: [...heading(view), 'Escolha a categoria:'].join('\n'),
    buttons: [
      ...rows(
        categories
          .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
          .map((category) => ({
            text: category.name,
            data: encodeChatAction({
              kind: 'category',
              captureId,
              categoryId: category.id,
            }),
          })),
        2,
      ),
      navigation,
    ],
  };
}

export function installmentsPickerMessage(view: RecordedView): ChatMessage {
  return {
    text: [...heading(view), 'Parcelar em quantas vezes?'].join('\n'),
    buttons: [
      ...rows(
        INSTALLMENT_CHOICES.map((count) => ({
          text: `${count}×`,
          data: encodeChatAction({
            kind: 'installments',
            captureId: view.captureId,
            count,
          }),
        })),
        4,
      ),
      [
        {
          text: 'Voltar',
          data: encodeChatAction({ kind: 'show', captureId: view.captureId }),
        },
      ],
    ],
  };
}

/** Asked as a reply, so the answer can be told apart from a new message. */
export function amountQuestion(
  description: string,
  cardName: string,
): ChatMessage {
  return {
    text: `Compra em ${description} (${cardName}) chegou sem valor. Quanto foi? Responda só o número, por exemplo 23,90.`,
    askForReply: true,
  };
}
