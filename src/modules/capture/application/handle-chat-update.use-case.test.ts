import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '@/core/contracts/chat-channel';
import { Account } from '@/core/entities/account';
import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import { ChatLink } from '@/core/entities/chat-link';
import { WalletCard } from '@/core/entities/wallet-card';
import { FakeChatChannel } from '@/tests/fakes/fake-chat-channel';
import { fakeChatDependencies } from '@/tests/fakes/fake-chat-dependencies';

import {
  type ChatAction,
  decodeChatAction,
  encodeChatAction,
} from '../domain/chat-action';
import { AnnounceCapturesUseCase } from './announce-captures.use-case';
import { CaptureWalletPaymentUseCase } from './capture-wallet-payment.use-case';
import { CreateChatLinkCodeUseCase } from './chat-links.use-case';
import { HandleChatUpdateUseCase } from './handle-chat-update.use-case';

const USER_ID = 'user-1';
const CHAT_ID = '5551234';
const NOW = new Date(2026, 9, 19, 12, 42);
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CREDITO = id(1);
const CONTA = id(2);
const RESTAURANTES = id(10);
const MERCADO = id(11);

const decodeCaptureId = (message: ChatMessage) => {
  const action = decodeChatAction(message.buttons![0][0].data);
  return action!.captureId;
};
const plain = (text: string | undefined) => text?.replace(/ /g, ' ');
const labels = (message: ChatMessage | undefined) =>
  message?.buttons?.flat().map((button) => button.text);

function account(
  accountId: string,
  name: string,
  type: 'checking' | 'credit',
  balance: number,
) {
  return new Account({
    id: accountId,
    userId: USER_ID,
    name,
    type,
    balance,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function category(categoryId: string, name: string) {
  return new Category({
    id: categoryId,
    userId: USER_ID,
    name,
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('talking with Hermes in the chat', () => {
  let world: ReturnType<typeof fakeChatDependencies>;
  let channel: FakeChatChannel;
  let handle: HandleChatUpdateUseCase;

  /** A payment captured and announced; its message is the last one sent. */
  async function announced(overrides: Record<string, unknown> = {}) {
    const { captureId } = await new CaptureWalletPaymentUseCase(
      world.deps,
    ).execute({
      userId: USER_ID,
      payload: {
        amount: 'R$ 23,90',
        merchant: 'PADARIA REAL LTDA *123',
        card: 'Nubank',
        occurredAt: new Date(2026, 9, 19, 12, 41).toISOString(),
        ...overrides,
      },
      now: NOW,
    });
    await new AnnounceCapturesUseCase(channel, world.run).execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });
    return { captureId, messageId: channel.sent.at(-1)!.messageId };
  }

  function tap(
    action: ChatAction,
    messageId: string,
    options: { chatId?: string; now?: Date } = {},
  ) {
    return handle.execute(
      {
        kind: 'button',
        chatId: options.chatId ?? CHAT_ID,
        messageId,
        buttonQueryId: `query-${channel.answered.length}`,
        data: encodeChatAction(action),
      },
      options.now ?? NOW,
    );
  }

  const transactionOf = async (captureId: string) => {
    const event = await world.deps.captureEvents.findById(captureId);
    return event?.transactionId
      ? world.deps.transactions.findById(event.transactionId)
      : null;
  };
  const balanceOf = async (accountId: string) =>
    (await world.deps.accounts.findById(accountId))?.balance;

  beforeEach(async () => {
    world = fakeChatDependencies();
    channel = new FakeChatChannel();
    handle = new HandleChatUpdateUseCase(channel, world.run);
    const { deps } = world;
    await deps.accounts.save(account(CREDITO, 'Nubank Crédito', 'credit', 0));
    await deps.accounts.save(account(CONTA, 'Nubank Conta', 'checking', 4000));
    await deps.categories.save(category(RESTAURANTES, 'Restaurantes'));
    await deps.categories.save(category(MERCADO, 'Mercado'));
    await deps.walletCards.save(
      new WalletCard({
        id: id(20),
        userId: USER_ID,
        walletName: 'Nubank',
        nameKey: 'nubank',
        accountId: CREDITO,
        alternateAccountId: CONTA,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    await deps.chatLinks.save(
      new ChatLink({
        id: id(30),
        userId: USER_ID,
        channel: 'telegram',
        externalChatId: CHAT_ID,
        linkedAt: NOW,
      }),
    );
  });

  describe('connecting', () => {
    it('links the chat that starts the bot from the app’s link', async () => {
      const { code } = await new CreateChatLinkCodeUseCase(
        world.deps.chatLinks,
      ).execute({ userId: 'user-2', now: NOW });

      await handle.execute(
        { kind: 'start', chatId: '777', username: 'ana', code },
        NOW,
      );

      expect(
        (await world.deps.chatLinks.findActiveByChat('telegram', '777'))
          ?.userId,
      ).toBe('user-2');
      expect(channel.sent.at(-1)?.text).toMatch(/^Pronto\./);
    });

    it('says the link is no good when its code is not', async () => {
      await handle.execute(
        { kind: 'start', chatId: '777', code: 'velho' },
        NOW,
      );

      expect(
        await world.deps.chatLinks.findActiveByChat('telegram', '777'),
      ).toBeNull();
      expect(channel.sent.at(-1)?.text).toContain('expirou');
    });

    it('answers a chat that is not connected only with how to connect', async () => {
      await handle.execute({ kind: 'start', chatId: '777' }, NOW);
      await handle.execute(
        { kind: 'text', chatId: '777', messageId: '1', text: 'oi' },
        NOW,
      );

      expect(channel.sent.map((message) => message.text)).toEqual([
        'Este bot é do Hermes. Para usar, conecte pelo app em Configurações › Integrações.',
        'Este bot é do Hermes. Para usar, conecte pelo app em Configurações › Integrações.',
      ]);
    });
  });

  describe('buttons under a payment', () => {
    it('files it under the category tapped and remembers the merchant', async () => {
      const { captureId, messageId } = await announced();

      await tap(
        { kind: 'category', captureId, categoryId: RESTAURANTES },
        messageId,
      );

      expect((await transactionOf(captureId))?.categoryId).toBe(RESTAURANTES);
      expect(
        await world.deps.merchantRules.findByKey(USER_ID, 'padaria real'),
      ).not.toBeNull();
      const message = channel.latest(messageId);
      expect(plain(message?.text)?.split('\n')[0]).toBe(
        'Nubank Crédito · R$ 23,90 · Restaurantes',
      );
      expect(message?.text).toContain(
        'Da próxima vez, Padaria Real já entra em Restaurantes.',
      );
      expect(channel.answered).toEqual([
        { buttonQueryId: 'query-0', notice: undefined },
      ]);
    });

    it('creates the missing category from the chat and files the purchase', async () => {
      const { captureId, messageId } = await announced({
        merchant: 'DROGASIL 24H',
      });
      expect(labels(channel.latest(messageId))?.[0]).toBe('＋ Saúde');

      await tap({ kind: 'new-category', captureId, key: 'saude' }, messageId);

      const saude = (await world.deps.categories.findByUserId(USER_ID)).find(
        (c) => c.name === 'Saúde',
      );
      expect((await transactionOf(captureId))?.categoryId).toBe(saude?.id);
      expect(channel.latest(messageId)?.text).toContain(
        'Da próxima vez, Drogasil 24h já entra em Saúde.',
      );
    });

    it('files nothing under a key the catalog does not have', async () => {
      const { captureId, messageId } = await announced({
        merchant: 'DROGASIL 24H',
      });

      await tap({ kind: 'new-category', captureId, key: 'nada' }, messageId);

      expect(await world.deps.categories.findByUserId(USER_ID)).toHaveLength(2);
      expect((await transactionOf(captureId))?.categoryId).toBeUndefined();
      expect(labels(channel.latest(messageId))?.[0]).toBe('＋ Saúde');
      expect(channel.answered.at(-1)?.notice).toBe(
        'Esta compra mudou. Veja como ela está agora.',
      );
    });

    it('pages through every category on "Outra…"', async () => {
      const { captureId, messageId } = await announced();

      await tap({ kind: 'pick-category', captureId, page: 0 }, messageId);

      expect(labels(channel.latest(messageId))).toEqual([
        'Mercado',
        'Restaurantes',
        'Voltar',
      ]);
    });

    it('moves it to the debit account on "Foi no débito"', async () => {
      const { captureId, messageId } = await announced();
      expect(labels(channel.latest(messageId))).toContain('Foi no débito');

      await tap({ kind: 'switch-account', captureId }, messageId);

      expect((await transactionOf(captureId))?.accountId).toBe(CONTA);
      expect(await balanceOf(CREDITO)).toBe(0);
      expect(await balanceOf(CONTA)).toBe(3976.1);
      const message = channel.latest(messageId);
      expect(plain(message?.text)?.split('\n')[0]).toBe(
        'Nubank Conta · R$ 23,90',
      );
      expect(labels(message)).toContain('Foi no crédito');
    });

    it('splits it into installments with the same total', async () => {
      const { captureId, messageId } = await announced({ amount: '299,40' });

      await tap({ kind: 'installments', captureId, count: 6 }, messageId);

      const plans = await world.deps.installmentPlans.findByUserId(USER_ID);
      expect(plans).toHaveLength(1);
      expect(plans[0].totalAmount).toBe(299.4);
      expect(plans[0].installmentCount).toBe(6);
      expect(await balanceOf(CREDITO)).toBeCloseTo(299.4);
      expect(plain(channel.latest(messageId)?.text)?.split('\n')[0]).toBe(
        'Nubank Crédito · 6× de R$ 49,90',
      );
      expect(labels(channel.latest(messageId))).toEqual(['Desfazer']);
    });

    it('does not split a purchase paid from a checking account', async () => {
      const { captureId, messageId } = await announced();
      await tap({ kind: 'switch-account', captureId }, messageId);
      expect(labels(channel.latest(messageId))).not.toContain('Parcelar');

      await tap({ kind: 'installments', captureId, count: 3 }, messageId);

      expect(await world.deps.installmentPlans.findByUserId(USER_ID)).toEqual(
        [],
      );
      expect((await transactionOf(captureId))?.amount).toBe(23.9);
    });

    it('undoes it, giving the amount back', async () => {
      const { captureId, messageId } = await announced();
      const transactionId = (await transactionOf(captureId))!.id;

      await tap({ kind: 'undo', captureId }, messageId);

      expect(await world.deps.transactions.findById(transactionId)).toBeNull();
      expect(await balanceOf(CREDITO)).toBe(0);
      expect(plain(channel.latest(messageId)?.text)).toBe(
        'Desfeito. R$ 23,90 em Padaria Real não foi registrado.',
      );
    });

    it('undoes an installment plan whole', async () => {
      const { captureId, messageId } = await announced({ amount: '299,40' });
      await tap({ kind: 'installments', captureId, count: 6 }, messageId);

      await tap({ kind: 'undo', captureId }, messageId);

      expect(await world.deps.installmentPlans.findByUserId(USER_ID)).toEqual(
        [],
      );
      expect(await balanceOf(CREDITO)).toBeCloseTo(0);
      expect(plain(channel.latest(messageId)?.text)).toBe(
        'Desfeito. O parcelamento de R$ 299,40 em Padaria Real não foi registrado.',
      );
    });

    it('gives a new card its account, recording what was waiting for it', async () => {
      const first = await announced({ card: 'Itaú Visa' });
      const second = await announced({
        card: 'Itaú Visa',
        merchant: 'MERCADO CONDOR',
        amount: '48,80',
      });

      await tap(
        { kind: 'card-account', captureId: first.captureId, accountId: CONTA },
        first.messageId,
      );

      expect((await transactionOf(first.captureId))?.accountId).toBe(CONTA);
      expect((await transactionOf(second.captureId))?.accountId).toBe(CONTA);
      expect(plain(channel.latest(first.messageId)?.text)?.split('\n')[0]).toBe(
        'Nubank Conta · R$ 23,90',
      );
      expect(
        plain(channel.latest(second.messageId)?.text)?.split('\n')[0],
      ).toBe('Nubank Conta · R$ 48,80');
    });

    it('lets go of a payment from a new card', async () => {
      const { captureId, messageId } = await announced({ card: 'Itaú Visa' });

      await tap({ kind: 'discard', captureId }, messageId);

      expect((await world.deps.captureEvents.findById(captureId))?.status).toBe(
        'discarded',
      );
      expect(channel.latest(messageId)?.text).toBe(
        'Descartada. A compra em Padaria Real não foi registrada.',
      );
    });

    it('ignores a tap from a chat that is not the payment owner’s', async () => {
      const { captureId, messageId } = await announced();
      await world.deps.chatLinks.save(
        new ChatLink({
          id: id(31),
          userId: 'user-2',
          channel: 'telegram',
          externalChatId: '777',
          linkedAt: NOW,
        }),
      );

      await tap({ kind: 'undo', captureId }, messageId, { chatId: '777' });

      expect(await transactionOf(captureId)).not.toBeNull();
      expect(channel.answered.at(-1)?.notice).toBe(
        'Esta mensagem expirou. Edite pelo app.',
      );
    });

    it('lets the buttons expire after seven days', async () => {
      const { captureId, messageId } = await announced();
      const eightDaysLater = new Date(2026, 9, 27, 12, 42);

      await tap({ kind: 'undo', captureId }, messageId, {
        now: eightDaysLater,
      });

      expect(await transactionOf(captureId)).not.toBeNull();
      expect(channel.answered.at(-1)?.notice).toBe(
        'Esta mensagem expirou. Edite pelo app.',
      );
    });

    it('says when it could not do it, changing nothing', async () => {
      const { captureId, messageId } = await announced();
      const archived = await world.deps.categories.findById(MERCADO);
      await world.deps.categories.save(archived!.archive());

      await tap(
        { kind: 'category', captureId, categoryId: MERCADO },
        messageId,
      );

      expect((await transactionOf(captureId))?.categoryId).toBeUndefined();
      expect(channel.answered.at(-1)?.notice).toBe(
        'Não deu para fazer isso. Edite pelo app.',
      );
    });
  });

  describe('a payment without an amount', () => {
    it('is recorded with the amount given in reply', async () => {
      const { captureId, messageId: questionId } = await announced({
        amount: null,
      });

      await handle.execute(
        {
          kind: 'text',
          chatId: CHAT_ID,
          messageId: '901',
          text: '23,90',
          replyToMessageId: questionId,
        },
        NOW,
      );

      expect((await transactionOf(captureId))?.amount).toBe(23.9);
      const message = channel.sent.at(-1);
      expect(plain(message?.text)?.split('\n')[0]).toBe(
        'Nubank Crédito · R$ 23,90',
      );
      const event = await world.deps.captureEvents.findById(captureId);
      expect(event?.chatMessageId).toBe(message?.messageId);
      expect(event?.chatPromptId).toBeUndefined();
    });

    it.each(['não lembro', '0', '99999999999,00'])(
      'asks again when the reply is not an amount it can keep (%s)',
      async (reply) => {
        const { captureId, messageId: questionId } = await announced({
          amount: null,
        });

        await handle.execute(
          {
            kind: 'text',
            chatId: CHAT_ID,
            messageId: '902',
            text: reply,
            replyToMessageId: questionId,
          },
          NOW,
        );

        const question = channel.sent.at(-1);
        expect(question).toMatchObject({ askForReply: true });
        expect(question?.text).toContain('Não entendi o valor');
        expect(
          (await world.deps.captureEvents.findById(captureId))?.chatPromptId,
        ).toBe(question?.messageId);
        expect(await transactionOf(captureId)).toBeNull();
      },
    );
  });

  describe('writing in the chat', () => {
    let next = 1000;
    const say = (text: string, messageId = String((next += 1))) =>
      handle.execute({ kind: 'text', chatId: CHAT_ID, messageId, text }, NOW);
    const spending = () =>
      world.deps.transactions.findByUserId(USER_ID, { pageSize: 100 });

    it('records a line and answers with its message', async () => {
      await say('almoço 32,50');

      const [transaction] = await spending();
      expect(transaction).toMatchObject({
        description: 'Almoço',
        amount: 32.5,
      });
      const message = channel.sent.at(-1);
      expect(plain(message?.text)?.split('\n').slice(0, 2)).toEqual([
        'Nubank Crédito · R$ 32,50',
        'Almoço · hoje 12:42',
      ]);
      expect(labels(message)).toContain('Desfazer');
    });

    it('answers a message delivered twice only once', async () => {
      await say('almoço 32,50', '777');
      await say('almoço 32,50', '777');

      expect(await spending()).toHaveLength(1);
      expect(channel.sent).toHaveLength(1);
    });

    it('asks before saving a large line, and saves it on "Salvar"', async () => {
      await say('mercado 870');
      const question = channel.sent.at(-1)!;
      expect(plain(question.text)).toBe(
        'Entendi R$ 870,00 em Mercado (Nubank Crédito). Salvo?',
      );
      expect(await spending()).toHaveLength(0);

      await handle.execute(
        {
          kind: 'button',
          chatId: CHAT_ID,
          messageId: question.messageId,
          buttonQueryId: 'q-confirm',
          data: question.buttons![0][0].data,
        },
        NOW,
      );

      expect(await spending()).toHaveLength(1);
      expect(
        plain(channel.latest(question.messageId)?.text)?.split('\n')[0],
      ).toBe('Nubank Crédito · R$ 870,00 · Mercado');
    });

    it('lets go of a large line on "Corrigir"', async () => {
      await say('mercado 870');
      const question = channel.sent.at(-1)!;

      await handle.execute(
        {
          kind: 'button',
          chatId: CHAT_ID,
          messageId: question.messageId,
          buttonQueryId: 'q-fix',
          data: question.buttons![0][1].data,
        },
        NOW,
      );

      expect(await spending()).toHaveLength(0);
      expect(channel.latest(question.messageId)?.text).toBe(
        'Não salvei Mercado. Mande de novo do jeito certo, como "mercado 870 crédito".',
      );
    });

    it('says what was missing from a line it could not read', async () => {
      await say('oi');

      expect(channel.sent.at(-1)?.text).toBe(
        'Não achei o valor. Mande numa linha, como "almoço 32,50", ou veja /ajuda.',
      );
    });

    it('answers commands', async () => {
      await say('almoço 32,50');
      await say('/hoje');

      expect(plain(channel.sent.at(-1)?.text)).toBe(
        ['Hoje:', '12:42 Almoço · R$ 32,50', 'Total: R$ 32,50'].join('\n'),
      );
    });

    it('undoes the last entry after asking, updating its message too', async () => {
      await say('almoço 32,50');
      const entryMessage = channel.sent.at(-1)!;
      await say('/desfazer');
      const question = channel.sent.at(-1)!;

      await handle.execute(
        {
          kind: 'button',
          chatId: CHAT_ID,
          messageId: question.messageId,
          buttonQueryId: 'q-undo',
          data: question.buttons![0][0].data,
        },
        NOW,
      );

      expect(await spending()).toHaveLength(0);
      const undone = 'Desfeito. R$ 32,50 em Almoço não foi registrado.';
      expect(plain(channel.latest(question.messageId)?.text)).toBe(undone);
      expect(plain(channel.latest(entryMessage.messageId)?.text)).toBe(undone);
    });

    it('leaves the last entry alone on "Manter"', async () => {
      await say('almoço 32,50');
      await say('/desfazer');
      const question = channel.sent.at(-1)!;

      await handle.execute(
        {
          kind: 'button',
          chatId: CHAT_ID,
          messageId: question.messageId,
          buttonQueryId: 'q-keep',
          data: question.buttons![0][1].data,
        },
        NOW,
      );

      expect(await spending()).toHaveLength(1);
      expect(channel.latest(question.messageId)?.text).toBe(
        'Ok, ficou como estava.',
      );
    });
  });

  describe('budget alerts', () => {
    const SEVENTY_FIVE = /^Mercado: 75% do orçamento/;

    async function mercadoBudget(amount: number) {
      await world.deps.budgets.save(
        new Budget({
          id: id(40),
          userId: USER_ID,
          categoryId: MERCADO,
          amount,
          currency: 'BRL',
          kind: 'monthly',
          limits: [],
          periodStart: new Date(2026, 9, 1),
          periodEnd: null,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );
    }

    it('alerts when a category button files a purchase that crosses a stage', async () => {
      await mercadoBudget(30);
      const { captureId, messageId } = await announced();
      expect(channel.sent).toHaveLength(1);

      await tap(
        { kind: 'category', captureId, categoryId: MERCADO },
        messageId,
      );

      expect(channel.sent).toHaveLength(2);
      expect(channel.sent[1].text).toMatch(SEVENTY_FIVE);
      expect(channel.sent[1].buttons).toBeUndefined();
      expect(channel.answered).toHaveLength(1);
    });

    it('does not repeat the alert when a button re-renders the purchase message', async () => {
      await mercadoBudget(30);
      const { captureId, messageId } = await announced();
      await tap(
        { kind: 'category', captureId, categoryId: MERCADO },
        messageId,
      );

      await tap({ kind: 'pick-category', captureId, page: 0 }, messageId);
      await tap({ kind: 'show', captureId }, messageId);
      await tap({ kind: 'switch-account', captureId }, messageId);

      expect(channel.sent).toHaveLength(2);
      expect(plain(channel.latest(messageId)?.text)).not.toContain('75%');
    });

    it('stays quiet when a button files a purchase that reaches no stage', async () => {
      await mercadoBudget(1000);
      const { captureId, messageId } = await announced();

      await tap(
        { kind: 'category', captureId, categoryId: MERCADO },
        messageId,
      );

      expect(channel.sent).toHaveLength(1);
    });

    it('does not fail the tap when the alert cannot be sent', async () => {
      await mercadoBudget(30);
      const { captureId, messageId } = await announced();
      channel.send = async () => {
        throw new Error('chat unreachable');
      };
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      await tap(
        { kind: 'category', captureId, categoryId: MERCADO },
        messageId,
      );

      expect((await transactionOf(captureId))?.categoryId).toBe(MERCADO);
      expect(channel.answered).toHaveLength(1);
      log.mockRestore();
    });

    it('alerts after a line written in the chat is recorded', async () => {
      await mercadoBudget(30);

      await handle.execute(
        {
          kind: 'text',
          chatId: CHAT_ID,
          messageId: '2001',
          text: 'mercado 25',
        },
        NOW,
      );

      expect(channel.sent).toHaveLength(2);
      expect(channel.sent[0].buttons).toBeDefined();
      expect(channel.sent[1].text).toMatch(SEVENTY_FIVE);
    });

    it('alerts when "Salvar" records a large line', async () => {
      await mercadoBudget(1000);
      await handle.execute(
        {
          kind: 'text',
          chatId: CHAT_ID,
          messageId: '2002',
          text: 'mercado 870',
        },
        NOW,
      );
      const question = channel.sent.at(-1)!;
      expect(channel.sent).toHaveLength(1);

      await tap(
        { kind: 'confirm', captureId: decodeCaptureId(question) },
        question.messageId,
      );

      expect(channel.sent).toHaveLength(2);
      expect(channel.sent[1].text).toMatch(/^Mercado: 75% do orçamento/);
    });

    it('does not alert a repeated message', async () => {
      await mercadoBudget(30);
      const update = {
        kind: 'text',
        chatId: CHAT_ID,
        messageId: '2003',
        text: 'mercado 25',
      } as const;
      await handle.execute(update, NOW);

      await handle.execute(update, NOW);

      expect(channel.sent).toHaveLength(2);
    });
  });
});
