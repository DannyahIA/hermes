import type {
  ChatChannel,
  ChatMessage,
  ChatUpdate,
} from '@/core/contracts/chat-channel';
import { DomainError } from '@/core/errors/domain-error';

import { decodeChatAction } from '../domain/chat-action';
import { readChatCommand } from '../domain/chat-command';
import { parseAmount } from '../domain/parse-amount';
import { MAX_AMOUNT } from '../schemas/record-quick-entry.schema';
import { AnnounceBudgetAlertsUseCase } from './announce-budget-alerts.use-case';
import { AnnounceCapturesUseCase } from './announce-captures.use-case';
import { AnswerChatCommandUseCase } from './answer-chat-command.use-case';
import { ProvideCaptureAmountUseCase } from './capture-wallet-payment.use-case';
import type { ChatUnitOfWork } from './chat-dependencies';
import { LinkChatUseCase } from './chat-links.use-case';
import { type ButtonOutcome, pressChatButton } from './press-chat-button';
import { RecordChatEntryUseCase } from './record-chat-entry.use-case';

const NOT_LINKED =
  'Este bot é do Hermes. Para usar, conecte pelo app em Configurações › Integrações.';
const LINKED =
  'Pronto. Vou te avisar aqui a cada pagamento por aproximação no iPhone, e você pode registrar gastos mandando mensagem, como "almoço 32,50 crédito". Veja /ajuda.';
const ALREADY_LINKED =
  'Você já está conectado. Mande um gasto numa linha, como "almoço 32,50", ou veja /ajuda.';
const CODE_UNUSABLE =
  'Este link de conexão expirou ou já foi usado. Gere outro em Configurações › Integrações.';
const AMOUNT_UNCLEAR: ChatMessage = {
  text: 'Não entendi o valor. Responda só o número, por exemplo 23,90.',
  askForReply: true,
};
const EXPIRED = 'Esta mensagem expirou. Edite pelo app.';
const FAILED = 'Não deu para fazer isso. Edite pelo app.';

/** Buttons work for a week (spec §5.4); then the app is the way. */
const BUTTON_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** What a message from the chat comes to, once its work is kept. */
type TextOutcome =
  | { kind: 'reply'; message: ChatMessage }
  /** An amount question that wasn't answered with an amount. */
  | { kind: 'unclear'; captureId: string }
  /** A capture to tell about: a new entry, or a payment now complete. */
  | { kind: 'announce'; userId: string; captureId: string }
  /** The same message, delivered again. */
  | { kind: 'nothing' };

/**
 * Everything that arrives from a chat (spec 2026-10-17-telegram-apple-pay-
 * design.md §5): starting the bot from the app's link connects the chat; a
 * button under a message files, moves, splits, undoes, confirms or lets go
 * (`pressChatButton`); a reply to an amount question completes the
 * payment; a command is answered; any other line is an entry. Only a
 * connected chat is listened to, and only about its own user's captures.
 * Each change runs in one unit of work and the chat hears about it after
 * it is kept.
 */
export class HandleChatUpdateUseCase {
  private readonly announcer: AnnounceCapturesUseCase;
  private readonly budgetAlerts: AnnounceBudgetAlertsUseCase;

  constructor(
    private readonly channel: ChatChannel,
    private readonly run: ChatUnitOfWork,
  ) {
    this.announcer = new AnnounceCapturesUseCase(channel, run);
    this.budgetAlerts = new AnnounceBudgetAlertsUseCase(channel, run);
  }

  async execute(update: ChatUpdate, now = new Date()): Promise<void> {
    switch (update.kind) {
      case 'start':
        return this.start(update, now);
      case 'button':
        return this.button(update, now);
      case 'text':
        return this.text(update, now);
    }
  }

  private async start(
    update: Extract<ChatUpdate, { kind: 'start' }>,
    now: Date,
  ): Promise<void> {
    let reply: string;
    if (update.code) {
      const code = update.code;
      const link = await this.run((deps) =>
        new LinkChatUseCase(deps.chatLinks).execute({
          code,
          channel: this.channel.kind,
          externalChatId: update.chatId,
          username: update.username,
          now,
        }),
      );
      reply = link ? LINKED : CODE_UNUSABLE;
    } else {
      const link = await this.run((deps) =>
        deps.chatLinks.findActiveByChat(this.channel.kind, update.chatId),
      );
      reply = link ? ALREADY_LINKED : NOT_LINKED;
    }
    await this.channel.send(update.chatId, { text: reply });
  }

  private async text(
    update: Extract<ChatUpdate, { kind: 'text' }>,
    now: Date,
  ): Promise<void> {
    const outcome = await this.run(async (deps): Promise<TextOutcome> => {
      const link = await deps.chatLinks.findActiveByChat(
        this.channel.kind,
        update.chatId,
      );
      if (!link) return { kind: 'reply', message: { text: NOT_LINKED } };
      const { userId } = link;

      const asked = update.replyToMessageId
        ? await deps.captureEvents.findByChatPrompt(
            userId,
            update.replyToMessageId,
          )
        : null;
      if (asked?.status === 'needs_amount') {
        const amount = parseAmount(update.text);
        if (amount === null || amount <= 0 || amount > MAX_AMOUNT) {
          return { kind: 'unclear', captureId: asked.id };
        }
        await new ProvideCaptureAmountUseCase(deps).execute({
          userId,
          captureId: asked.id,
          amount,
          now,
        });
        return { kind: 'announce', userId, captureId: asked.id };
      }

      const command = readChatCommand(update.text);
      if (command) {
        return {
          kind: 'reply',
          message: await new AnswerChatCommandUseCase(deps).execute({
            userId,
            command,
            now,
          }),
        };
      }

      const entry = await new RecordChatEntryUseCase(deps).execute({
        userId,
        key: `${this.channel.kind}:${update.chatId}:${update.messageId}`,
        text: update.text,
        now,
      });
      if (entry.kind === 'unreadable') {
        return { kind: 'reply', message: { text: entry.reply } };
      }
      if (entry.repeated) return { kind: 'nothing' };
      return { kind: 'announce', userId, captureId: entry.captureId };
    });

    switch (outcome.kind) {
      case 'reply':
        await this.channel.send(update.chatId, outcome.message);
        return;
      case 'unclear': {
        const { messageId } = await this.channel.send(
          update.chatId,
          AMOUNT_UNCLEAR,
        );
        await this.run(async (deps) => {
          const event = await deps.captureEvents.findById(outcome.captureId);
          if (event) {
            await deps.captureEvents.save(
              event.with({ chatPromptId: messageId }, now),
            );
          }
        });
        return;
      }
      case 'announce':
        await this.announcer.execute({
          userId: outcome.userId,
          captureIds: [outcome.captureId],
          now,
        });
        return;
      case 'nothing':
        return;
    }
  }

  private async button(
    update: Extract<ChatUpdate, { kind: 'button' }>,
    now: Date,
  ): Promise<void> {
    let outcome: ButtonOutcome & { captureMessageId?: string; userId?: string };
    try {
      outcome = await this.run(async (deps) => {
        const link = await deps.chatLinks.findActiveByChat(
          this.channel.kind,
          update.chatId,
        );
        const action = decodeChatAction(update.data);
        const event =
          link && action
            ? await deps.captureEvents.findById(action.captureId)
            : null;
        if (
          !link ||
          !action ||
          !event ||
          event.userId !== link.userId ||
          now.getTime() - event.createdAt.getTime() > BUTTON_LIFETIME_MS
        ) {
          return { notice: EXPIRED };
        }
        return {
          ...(await pressChatButton(deps, action, event, now)),
          captureMessageId: event.chatMessageId,
          userId: link.userId,
        };
      });
    } catch (error) {
      // A business rule said no (an archived category or account, a
      // purchase already gone): the work was rolled back.
      if (!(error instanceof DomainError)) throw error;
      outcome = { notice: FAILED };
    }

    if (outcome.message) {
      await this.channel.edit(update.chatId, update.messageId, outcome.message);
      if (
        outcome.mirror &&
        outcome.captureMessageId &&
        outcome.captureMessageId !== update.messageId
      ) {
        await this.channel.edit(
          update.chatId,
          outcome.captureMessageId,
          outcome.message,
        );
      }
    }
    if (outcome.announce) {
      await this.announcer.execute({ ...outcome.announce, now });
    }
    if (outcome.touched && outcome.userId) {
      await this.budgetAlerts.execute({
        userId: outcome.userId,
        transactionIds: outcome.touched,
        now,
      });
    }
    await this.channel.answerButton(update.buttonQueryId, outcome.notice);
  }
}
