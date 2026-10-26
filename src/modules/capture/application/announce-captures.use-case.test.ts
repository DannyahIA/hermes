import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Account } from '@/core/entities/account';
import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import { ChatLink } from '@/core/entities/chat-link';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { WalletCard } from '@/core/entities/wallet-card';
import { FakeChatChannel } from '@/tests/fakes/fake-chat-channel';
import { fakeChatDependencies } from '@/tests/fakes/fake-chat-dependencies';

import { decodeChatAction } from '../domain/chat-action';
import { AnnounceCapturesUseCase } from './announce-captures.use-case';
import { CaptureWalletPaymentUseCase } from './capture-wallet-payment.use-case';
import { SetChatPrivacyUseCase } from './chat-privacy.use-case';

const USER_ID = 'user-1';
const CHAT_ID = '5551234';
const NOW = new Date(2026, 9, 19, 12, 42);
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CREDITO = id(1);
const CONTA = id(2);
const RESTAURANTES = id(10);
const MERCADO = id(11);

/** `Intl` keeps "R$" and the value together with a no-break space. */
const plain = (text: string | undefined) => text?.replace(/ /g, ' ');

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

describe('announcing captured payments in the chat', () => {
  let world: ReturnType<typeof fakeChatDependencies>;
  let channel: FakeChatChannel;
  let announce: AnnounceCapturesUseCase;

  async function capture(overrides: Record<string, unknown> = {}) {
    const result = await new CaptureWalletPaymentUseCase(world.deps).execute({
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
    return result.captureId;
  }

  beforeEach(async () => {
    world = fakeChatDependencies();
    channel = new FakeChatChannel();
    announce = new AnnounceCapturesUseCase(channel, world.run);
    const { deps } = world;
    await deps.accounts.save(account(CREDITO, 'Nubank Crédito', 'credit', 0));
    await deps.accounts.save(account(CONTA, 'Nubank Conta', 'checking', 4000));
    await deps.categories.save(
      new Category({
        id: RESTAURANTES,
        userId: USER_ID,
        name: 'Restaurantes',
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    await deps.walletCards.save(
      new WalletCard({
        id: id(20),
        userId: USER_ID,
        walletName: 'Nubank',
        nameKey: 'nubank',
        accountId: CREDITO,
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

  it('tells about a recorded payment, with what is still free, and keeps the message', async () => {
    const captureId = await capture();

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent).toHaveLength(1);
    const [message] = channel.sent;
    expect(message.chatId).toBe(CHAT_ID);
    expect(plain(message.text)?.split('\n')).toEqual([
      'Nubank Crédito · R$ 23,90',
      'Padaria Real · hoje 12:41',
      'Categoria?',
      'Livre até o fim do mês: R$ 3.976,10 (R$ 306 por dia)',
    ]);
    expect(message.buttons?.flat().map((button) => button.text)).toContain(
      'Outra…',
    );
    expect(
      (await world.deps.captureEvents.findById(captureId))?.chatMessageId,
    ).toBe(message.messageId);
  });

  it('keeps what is free out of the chat when the user asked so', async () => {
    await new SetChatPrivacyUseCase(world.deps.viewPreferences).execute({
      userId: USER_ID,
      showFree: false,
    });
    const captureId = await capture();

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent[0].text).not.toContain('Livre');
  });

  it('says nothing when no chat is connected', async () => {
    const captureId = await capture();
    const link = await world.deps.chatLinks.findActiveByUserId(USER_ID);
    await world.deps.chatLinks.save(link!.revoke(NOW));

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent).toHaveLength(0);
  });

  it('asks for a missing amount as a reply, and remembers the question', async () => {
    const captureId = await capture({ amount: null });

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]).toMatchObject({ askForReply: true });
    expect(channel.sent[0].text).toContain('Compra em Padaria Real (Nubank)');
    const event = await world.deps.captureEvents.findById(captureId);
    expect(event?.chatPromptId).toBe(channel.sent[0].messageId);
    expect(event?.chatMessageId).toBeUndefined();
  });

  it('asks which account a new card goes to, credit cards first', async () => {
    const captureId = await capture({ card: 'Itaú Visa' });

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    const [message] = channel.sent;
    expect(message.text.split('\n')[0]).toBe(
      'Primeira compra que vejo com "Itaú Visa":',
    );
    expect(message.buttons?.[0].map((button) => button.text)).toEqual([
      'Nubank Crédito',
      'Nubank Conta',
    ]);
    expect(decodeChatAction(message.buttons![0][0].data)).toEqual({
      kind: 'card-account',
      captureId,
      accountId: CREDITO,
    });
  });

  it('does not start a conversation about a payment let go in the app', async () => {
    const captureId = await capture({ amount: null });
    const event = await world.deps.captureEvents.findById(captureId);
    await world.deps.captureEvents.save(
      event!.with({ status: 'discarded' }, NOW),
    );

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent).toHaveLength(0);
  });

  it('offers only the accounts a card pays from, a few at most', async () => {
    const { deps } = world;
    await deps.accounts.save(
      account(id(3), 'Reserva', 'checking', 0).update({ type: 'savings' }),
    );
    for (let n = 0; n < 12; n += 1) {
      await deps.accounts.save(
        account(
          id(40 + n),
          `Conta ${String(n).padStart(2, '0')}`,
          'checking',
          0,
        ),
      );
    }
    const captureId = await capture({ card: 'Itaú Visa' });

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    const [message] = channel.sent;
    const names = message.buttons!.flat().map((button) => button.text);
    expect(names).not.toContain('Reserva');
    expect(names).toHaveLength(11);
    expect(names.slice(0, 2)).toEqual(['Nubank Crédito', 'Conta 00']);
    expect(names.at(-1)).toBe('Descartar');
    expect(message.text).toContain('As outras estão em Configurações');
  });

  it('updates the message it already sent instead of sending another', async () => {
    const captureId = await capture();
    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    await announce.execute({
      userId: USER_ID,
      captureIds: [captureId],
      now: NOW,
    });

    expect(channel.sent).toHaveLength(1);
    expect(channel.edited).toHaveLength(1);
    expect(channel.edited[0].messageId).toBe(channel.sent[0].messageId);
  });

  describe('budget alerts', () => {
    /** A R$ 30 Mercado budget, and a merchant that is always filed there. */
    async function mercadoAt30() {
      const { deps } = world;
      await deps.categories.save(
        new Category({
          id: MERCADO,
          userId: USER_ID,
          name: 'Mercado',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );
      await deps.budgets.save(
        new Budget({
          id: id(40),
          userId: USER_ID,
          categoryId: MERCADO,
          amount: 30,
          currency: 'BRL',
          kind: 'monthly',
          limits: [],
          periodStart: new Date(2026, 9, 1),
          periodEnd: null,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );
      await deps.merchantRules.save(
        new MerchantRule({
          id: id(41),
          userId: USER_ID,
          merchantKey: 'padaria real',
          displayName: 'Padaria Real',
          categoryId: MERCADO,
          hits: 3,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );
    }

    it('sends the stage as a second message after the purchase that reached it', async () => {
      await mercadoAt30();
      const captureId = await capture();

      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      expect(channel.sent).toHaveLength(2);
      expect(channel.sent[0].text).not.toContain('orçamento');
      expect(channel.sent[1]).toEqual({
        chatId: CHAT_ID,
        messageId: expect.any(String),
        text: expect.stringMatching(/^Mercado: 75% do orçamento/),
      });
      expect(channel.sent[1].buttons).toBeUndefined();
    });

    it('does not repeat the stage when the purchase message is brought up to date', async () => {
      await mercadoAt30();
      const captureId = await capture();
      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      expect(channel.edited).toHaveLength(1);
      expect(channel.sent).toHaveLength(2);
    });

    it('says nothing about a purchase that reaches no stage', async () => {
      const captureId = await capture();

      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      expect(channel.sent).toHaveLength(1);
    });

    it('does not fail the announcement when the alert cannot be sent', async () => {
      await mercadoAt30();
      const captureId = await capture();
      const send = channel.send.bind(channel);
      let calls = 0;
      channel.send = async (chatId, message) => {
        if (++calls === 2) throw new Error('chat unreachable');
        return send(chatId, message);
      };
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      expect(log).toHaveBeenCalledOnce();
      expect(String(log.mock.calls[0])).not.toMatch(/23[,.]9/);
      log.mockRestore();
    });

    it('does not fail the announcement when the alert check fails', async () => {
      await mercadoAt30();
      const captureId = await capture();
      world.deps.budgetAlerts.warned = async () => {
        throw new Error('database down');
      };
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      await announce.execute({
        userId: USER_ID,
        captureIds: [captureId],
        now: NOW,
      });

      expect(channel.sent).toHaveLength(1);
      expect(
        (await world.deps.captureEvents.findById(captureId))?.chatMessageId,
      ).toBe(channel.sent[0].messageId);
      expect(log).toHaveBeenCalledOnce();
      log.mockRestore();
    });
  });
});
