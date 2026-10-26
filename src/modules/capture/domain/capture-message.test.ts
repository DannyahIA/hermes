import { describe, expect, it } from 'vitest';

import {
  amountQuestion,
  captureMessage,
  categoryPickerMessage,
  installmentsPickerMessage,
  type RecordedView,
} from './capture-message';
import { decodeChatAction } from './chat-action';

const CAPTURE = '9295c43b-103b-447c-8e8b-ba077b4111d7';
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const recorded: RecordedView = {
  kind: 'recorded',
  captureId: CAPTURE,
  when: 'hoje 12:41',
  description: 'Padaria Real',
  amount: 23.9,
  accountName: 'Nubank Crédito',
  suggestions: [
    { id: id(1), name: 'Restaurantes' },
    { id: id(2), name: 'Mercado' },
    { id: id(3), name: 'Lazer' },
  ],
  free: 'Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)',
  installable: true,
};

/** `Intl` keeps "R$" and the value together with a no-break space. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

const labels = (message: ReturnType<typeof captureMessage>) =>
  message.buttons?.map((row) => row.map((button) => button.text));

describe('the message about a payment', () => {
  it('asks for the category of a merchant it does not know', () => {
    const message = captureMessage(recorded);

    expect(plain(message.text)).toBe(
      [
        'Nubank Crédito · R$ 23,90',
        'Padaria Real · hoje 12:41',
        'Categoria?',
        'Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)',
      ].join('\n'),
    );
    expect(labels(message)).toEqual([
      ['Restaurantes', 'Mercado'],
      ['Lazer', 'Outra…'],
      ['Parcelar', 'Desfazer'],
    ]);
    expect(decodeChatAction(message.buttons![0][0].data)).toEqual({
      kind: 'category',
      captureId: CAPTURE,
      categoryId: id(1),
    });
  });

  it('offers the missing category before the suggestions', () => {
    const message = captureMessage({
      ...recorded,
      newCategory: { key: 'saude', name: 'Saúde' },
    });

    expect(labels(message)).toEqual([
      ['＋ Saúde', 'Restaurantes'],
      ['Mercado', 'Lazer'],
      ['Outra…'],
      ['Parcelar', 'Desfazer'],
    ]);
    expect(decodeChatAction(message.buttons![0][0].data)).toEqual({
      kind: 'new-category',
      captureId: CAPTURE,
      key: 'saude',
    });
  });

  it('offers no installments for a purchase paid from a checking account', () => {
    const message = captureMessage({
      ...recorded,
      accountName: 'Nubank Conta',
      installable: false,
    });

    expect(labels(message)?.at(-1)).toEqual(['Desfazer']);
  });

  it('says what it learned once filed, and offers to switch to debit', () => {
    const message = captureMessage({
      ...recorded,
      category: { id: id(1), name: 'Restaurantes' },
      learned: true,
      switchLabel: 'Foi no débito',
    });

    expect(plain(message.text)).toBe(
      [
        'Nubank Crédito · R$ 23,90 · Restaurantes',
        'Padaria Real · hoje 12:41',
        'Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)',
        'Da próxima vez, Padaria Real já entra em Restaurantes.',
      ].join('\n'),
    );
    expect(labels(message)).toEqual([
      ['Trocar categoria', 'Foi no débito', 'Parcelar'],
      ['Desfazer'],
    ]);
  });

  it('shows an installment plan with only the way back', () => {
    const message = captureMessage({
      ...recorded,
      amount: 299.4,
      category: { id: id(4), name: 'Eletrônicos' },
      installments: { count: 6, each: 49.9, first: 'hoje' },
    });

    expect(plain(message.text).split('\n').slice(0, 3)).toEqual([
      'Nubank Crédito · 6× de R$ 49,90 · Eletrônicos',
      'Padaria Real · hoje 12:41',
      'Parcelado: R$ 299,40 em 6 vezes, a primeira hoje.',
    ]);
    expect(labels(message)).toEqual([['Desfazer']]);
  });

  it('asks which account a new card goes to', () => {
    const message = captureMessage({
      kind: 'needs_account',
      captureId: CAPTURE,
      when: 'hoje 13:24',
      description: 'Mercado Condor',
      amount: 48.8,
      cardName: 'Itaú Visa Platinum',
      accounts: [
        { id: id(5), name: 'Itaú Crédito' },
        { id: id(6), name: 'Itaú Conta' },
      ],
    });

    expect(plain(message.text)).toBe(
      [
        'Primeira compra que vejo com "Itaú Visa Platinum":',
        'Mercado Condor · R$ 48,80 · hoje 13:24',
        'Ela vai para qual conta?',
      ].join('\n'),
    );
    expect(labels(message)).toEqual([
      ['Itaú Crédito', 'Itaú Conta'],
      ['Descartar'],
    ]);
  });

  it('says plainly when it was undone or let go', () => {
    expect(
      plain(
        captureMessage({
          kind: 'undone',
          description: 'Padaria Real',
          amount: 23.9,
          plan: false,
        }).text,
      ),
    ).toBe('Desfeito. R$ 23,90 em Padaria Real não foi registrado.');
    expect(
      captureMessage({ kind: 'discarded', description: 'Uber' }).text,
    ).toBe('Descartada. A compra em Uber não foi registrada.');
  });

  it('asks before saving a large entry from the chat', () => {
    const message = captureMessage({
      kind: 'needs_confirm',
      captureId: CAPTURE,
      description: 'Mercado',
      amount: 870,
      type: 'expense',
      accountName: 'Nubank Crédito',
      day: 'hoje',
    });

    expect(plain(message.text)).toBe(
      'Entendi R$ 870,00 em Mercado (Nubank Crédito). Salvo?',
    );
    expect(labels(message)).toEqual([['Salvar', 'Corrigir']]);
    expect(
      message.buttons![0].map((button) => decodeChatAction(button.data)),
    ).toEqual([
      { kind: 'confirm', captureId: CAPTURE },
      { kind: 'discard', captureId: CAPTURE },
    ]);
  });

  it('says which day and that it is money in, when so', () => {
    expect(
      plain(
        captureMessage({
          kind: 'needs_confirm',
          captureId: CAPTURE,
          description: 'Salário',
          amount: 3000,
          type: 'income',
          accountName: 'Nubank Conta',
          day: 'ontem',
        }).text,
      ),
    ).toBe(
      'Entendi uma entrada de R$ 3.000,00 em Salário, ontem (Nubank Conta). Salvo?',
    );
  });

  it('asks to send an entry again after "Corrigir"', () => {
    expect(
      captureMessage({ kind: 'not-saved', description: 'Mercado' }),
    ).toEqual({
      text: 'Não salvei Mercado. Mande de novo do jeito certo, como "mercado 870 crédito".',
    });
  });

  it('says so when the purchase was deleted in the app', () => {
    expect(captureMessage({ kind: 'gone', description: 'Uber' })).toEqual({
      text: 'A compra em Uber não está mais no Hermes.',
    });
  });

  it('pages through every category', () => {
    const categories = Array.from({ length: 10 }, (_, n) => ({
      id: id(n + 10),
      name: `Categoria ${n + 1}`,
    }));

    const first = categoryPickerMessage(recorded, categories, 0);
    expect(first.text.split('\n').at(-1)).toBe('Escolha a categoria:');
    expect(labels(first)?.at(-1)).toEqual(['Mais ›', 'Voltar']);
    expect(first.buttons!.slice(0, -1).flat()).toHaveLength(8);

    const second = categoryPickerMessage(recorded, categories, 1);
    expect(labels(second)).toEqual([
      ['Categoria 9', 'Categoria 10'],
      ['‹ Anteriores', 'Voltar'],
    ]);
  });

  it('offers the usual installment counts', () => {
    expect(labels(installmentsPickerMessage(recorded))).toEqual([
      ['2×', '3×', '4×', '5×'],
      ['6×', '8×', '10×', '12×'],
      ['Voltar'],
    ]);
  });

  it('asks for a missing amount as a reply', () => {
    expect(amountQuestion('Uber', 'Nubank')).toEqual({
      text: 'Compra em Uber (Nubank) chegou sem valor. Quanto foi? Responda só o número, por exemplo 23,90.',
      askForReply: true,
    });
  });
});
