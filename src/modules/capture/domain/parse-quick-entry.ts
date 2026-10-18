import type { AccountKind } from '@/core/entities/account';

import { type MerchantMemoryEntry, recallMerchant } from './merchant-memory';
import { normalizeMerchant } from './normalize-merchant';
import { parseAmount } from './parse-amount';

export interface QuickEntryAccount {
  id: string;
  name: string;
  type: AccountKind;
  /** Entries recorded in it lately — the most used is the default. */
  uses: { expense: number; income: number };
}

export interface QuickEntryContext {
  now: Date;
  /** Accounts that can take a new entry. */
  accounts: QuickEntryAccount[];
  /** Categories that can take a new entry. */
  categories: Array<{ id: string; name: string }>;
  /** What was done before at each merchant (`buildMerchantMemory`). */
  merchants: MerchantMemoryEntry[];
}

export type QuickEntryIssue =
  | { code: 'missing-amount' }
  | { code: 'missing-description' }
  /** More than one number could be the amount; `ignored` are the others. */
  | { code: 'several-amounts'; ignored: number[] }
  | { code: 'no-account' };

export interface QuickEntry {
  description: string;
  amount: number | null;
  type: 'income' | 'expense';
  accountId: string | null;
  categoryId: string | null;
  /** Now, or the start of the day named in the text. */
  occurredAt: Date;
  issues: QuickEntryIssue[];
}

interface Token {
  /** As typed, minus trailing punctuation. */
  text: string;
  /** Accent- and case-free, for matching words. */
  word: string;
  used: boolean;
}

/** Little words that tie an account or a date to the sentence: "no crédito", "de ontem". */
const CONNECTORS = new Set([
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'com',
  'pelo',
  'pela',
  'via',
  'de',
  'do',
  'da',
]);
const EDGE_WORDS = new Set([...CONNECTORS, 'e', 'dos', 'das']);
const INCOME_WORDS = new Set(['recebi', 'recebido', 'recebida', 'ganhei']);
const ACCOUNT_KINDS: Record<string, AccountKind> = {
  credito: 'credit',
  cartao: 'credit',
  debito: 'checking',
  pix: 'checking',
  dinheiro: 'checking',
  poupanca: 'savings',
};
/** Account-name words too common to name one account by themselves. */
const GENERIC_ACCOUNT_WORDS = new Set([
  'conta',
  'corrente',
  'cartao',
  'credito',
  'debito',
  'banco',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
]);
const RELATIVE_DAYS: Record<string, number> = {
  hoje: 0,
  ontem: -1,
  anteontem: -2,
  amanha: 1,
};
const NUMBER = /^[+-]?(?:r\$)?\d[\d.,]*$/i;
const DAY_MONTH = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .map((raw) => raw.replace(/[.,;:!?]+$/, ''))
    .filter(Boolean)
    .map((clean) => ({ text: clean, word: fold(clean), used: false }));
}

/** Marks a token used, with the connector right before it ("no" in "no crédito"). */
function consume(tokens: Token[], index: number) {
  tokens[index].used = true;
  const before = tokens[index - 1];
  if (before && !before.used && CONNECTORS.has(before.word)) before.used = true;
}

function startOfDay(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function isRealDate(date: Date, year: number, month: number, day: number) {
  return (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  );
}

/** "12/10" without a year is the 12/10 nearest to today. */
function dayMonth(match: RegExpExecArray, now: Date): Date | null {
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (match[3]) {
    const year =
      match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = new Date(year, month, day);
    return isRealDate(date, year, month, day) ? date : null;
  }

  const today = startOfDay(now).getTime();
  let nearest: Date | null = null;
  for (const offset of [-1, 0, 1]) {
    const year = now.getFullYear() + offset;
    const date = new Date(year, month, day);
    if (!isRealDate(date, year, month, day)) continue;
    if (
      !nearest ||
      Math.abs(date.getTime() - today) < Math.abs(nearest.getTime() - today)
    ) {
      nearest = date;
    }
  }
  return nearest;
}

/** "dia 12": the latest 12th that has already come, today included. */
function lastDayNumbered(day: number, now: Date): Date | null {
  if (day < 1 || day > 31) return null;
  for (let back = 0; back < 12; back += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, day);
    if (date.getDate() === day && date <= now) return date;
  }
  return null;
}

/** The day the text names, if any; a date that is today means now. */
function readDate(tokens: Token[], now: Date): Date {
  let found: Date | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.used) continue;
    const next = tokens[index + 1];
    const dayMonthMatch = DAY_MONTH.exec(token.word);
    let date: Date | null = null;

    if (token.word in RELATIVE_DAYS) {
      date = startOfDay(now, RELATIVE_DAYS[token.word]);
    } else if (dayMonthMatch) {
      date = dayMonth(dayMonthMatch, now);
    } else if (token.word === 'dia' && next && /^\d{1,2}$/.test(next.word)) {
      date = lastDayNumbered(Number(next.word), now);
      if (date) next.used = true;
    }

    if (!date) continue;
    consume(tokens, index);
    found = date;
  }

  if (!found) return now;
  return startOfDay(now).getTime() === found.getTime() ? now : found;
}

interface AmountRead {
  amount: number | null;
  sign: '+' | '-' | null;
  ignored: number[];
}

function readAmount(tokens: Token[]): AmountRead {
  const candidates: Array<{
    index: number;
    value: number;
    sign: '+' | '-' | null;
    /** Written as money: with cents, "R$" or a sign. */
    explicit: boolean;
    /** Tokens that go with it: "R$", a sign apart, "reais". */
    marks: number[];
  }> = [];

  tokens.forEach((token, index) => {
    if (token.used || !NUMBER.test(token.text)) return;
    const value = parseAmount(token.text);
    if (value === null || value === 0) return;

    const marks: number[] = [];
    let sign: '+' | '-' | null = /^[+-]/.test(token.text)
      ? (token.text[0] as '+' | '-')
      : null;
    let explicit = sign !== null || /[.,]|r\$/i.test(token.text);
    // "R$ 32,50", "+ 3000" and "- R$ 20" arrive as separate tokens.
    let before = index - 1;
    if (tokens[before]?.word === 'r$' && !tokens[before].used) {
      marks.push(before);
      explicit = true;
      before -= 1;
    }
    const signToken = tokens[before];
    if (
      !sign &&
      signToken &&
      !signToken.used &&
      /^[+-]$/.test(signToken.text)
    ) {
      sign = signToken.text as '+' | '-';
      marks.push(before);
      explicit = true;
    }
    if (tokens[index + 1]?.word === 'reais') marks.push(index + 1);

    candidates.push({ index, value: Math.abs(value), sign, explicit, marks });
  });

  const written = candidates.filter((candidate) => candidate.explicit);
  const pool = written.length > 0 ? written : candidates;
  const chosen = pool.at(-1);
  if (!chosen) return { amount: null, sign: null, ignored: [] };

  tokens[chosen.index].used = true;
  for (const mark of chosen.marks) tokens[mark].used = true;
  return {
    amount: chosen.value,
    sign: chosen.sign,
    ignored: pool.slice(0, -1).map((candidate) => candidate.value),
  };
}

function readIncomeWord(tokens: Token[]): boolean {
  let found = false;
  for (const token of tokens) {
    if (!token.used && INCOME_WORDS.has(token.word)) {
      token.used = true;
      found = true;
    }
  }
  return found;
}

interface AccountHint {
  /** Accounts the text names; several when a bank name fits more than one. */
  named: string[];
  kind: AccountKind | null;
}

/** Where the phrase starts among the unused tokens, or -1. */
function findPhrase(tokens: Token[], phrase: string[]): number {
  for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
    const matches = phrase.every((word, offset) => {
      const token = tokens[start + offset];
      return !token.used && token.word === word;
    });
    if (matches) return start;
  }
  return -1;
}

function readAccount(
  tokens: Token[],
  accounts: QuickEntryAccount[],
): AccountHint {
  // The longest run of words from an account's name wins: "nubank
  // crédito" over "nubank".
  let best = { length: 0, start: -1, named: [] as string[] };
  for (const account of accounts) {
    const words = fold(account.name).split(/\s+/).filter(Boolean);
    for (let from = 0; from < words.length; from += 1) {
      for (let to = from + 1; to <= words.length; to += 1) {
        const phrase = words.slice(from, to);
        const wholeName = from === 0 && to === words.length;
        const generic = phrase.every((word) => GENERIC_ACCOUNT_WORDS.has(word));
        if (generic && !wholeName) continue;

        const start = findPhrase(tokens, phrase);
        if (start < 0) continue;
        if (phrase.length > best.length) {
          best = { length: phrase.length, start, named: [account.id] };
        } else if (
          phrase.length === best.length &&
          start === best.start &&
          !best.named.includes(account.id)
        ) {
          best.named.push(account.id);
        }
      }
    }
  }
  for (let offset = 0; offset < best.length; offset += 1) {
    consume(tokens, best.start + offset);
  }

  let kind: AccountKind | null = null;
  tokens.forEach((token, index) => {
    if (token.used || !(token.word in ACCOUNT_KINDS)) return;
    kind = ACCOUNT_KINDS[token.word];
    consume(tokens, index);
  });

  return { named: best.named, kind };
}

const KIND_ORDER: Record<'income' | 'expense', AccountKind[]> = {
  income: ['checking', 'savings', 'credit'],
  expense: ['credit', 'checking', 'savings'],
};

/** The account used most for this kind of entry. */
function preferred(
  accounts: QuickEntryAccount[],
  type: 'income' | 'expense',
): QuickEntryAccount | undefined {
  return [...accounts].sort(
    (a, b) =>
      b.uses[type] - a.uses[type] ||
      KIND_ORDER[type].indexOf(a.type) - KIND_ORDER[type].indexOf(b.type) ||
      a.name.localeCompare(b.name, 'pt-BR'),
  )[0];
}

function pickAccount(
  hint: AccountHint,
  accounts: QuickEntryAccount[],
  type: 'income' | 'expense',
  usual: string | undefined,
): string | null {
  let pool = accounts;
  if (hint.named.length > 0) {
    pool = accounts.filter((account) => hint.named.includes(account.id));
  }
  if (hint.kind) {
    const ofKind = pool.filter((account) => account.type === hint.kind);
    if (ofKind.length > 0) pool = ofKind;
  }
  const choice =
    pool.find((account) => account.id === usual) ?? preferred(pool, type);
  return choice?.id ?? null;
}

function readDescription(tokens: Token[]): string {
  const words = tokens.filter((token) => !token.used);
  while (words.length > 0 && EDGE_WORDS.has(words[0].word)) words.shift();
  while (words.length > 0 && EDGE_WORDS.has(words[words.length - 1].word)) {
    words.pop();
  }
  const text = words.map((token) => token.text).join(' ');
  // Capitals someone typed stay ("iFood"); all lowercase gets one.
  if (text !== text.toLocaleLowerCase('pt-BR')) return text;
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

/** "Restaurante" for "Restaurantes": a plural is not a different thing. */
function singular(key: string): string {
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

function categoryNamed(
  description: string,
  categories: QuickEntryContext['categories'],
): string | null {
  const { key } = normalizeMerchant(description);
  if (!key) return null;
  const match = categories.find((category) => {
    const name = normalizeMerchant(category.name).key;
    return name === key || singular(name) === singular(key);
  });
  return match?.id ?? null;
}

/**
 * Reads a one-line entry the way someone types it in a message —
 * "almoço 32,50 crédito", "uber 18 débito", "+3000 salário", "mercado
 * 250,40 ontem" (spec 2026-10-17-inicio-hub-design.md §4.8 and the
 * Telegram spec §5.5). Shared by the Início's quick entry and the
 * Telegram bot.
 *
 * - **Amount:** the number written as money ("32,50", "R$ 32", "+3000");
 *   if none is, the last number. The others stay in the description, and
 *   `several-amounts` says a choice was made.
 * - **Kind:** money in with "+" or "recebi", money out with "-"; otherwise
 *   what the merchant usually is, or an expense.
 * - **Account:** its name or part of it ("itaú"), and/or a kind —
 *   "crédito", "cartão", "débito", "pix", "dinheiro", "poupança".
 *   Otherwise the account the merchant usually goes to, or the one used
 *   most.
 * - **Date:** "hoje", "ontem", "anteontem", "amanhã", "12/10", "12/10/25",
 *   "dia 12". Today, or no date, is now; another day is its start.
 * - **Category:** the merchant's, from memory, or a category the
 *   description names. Nothing is guessed for a merchant never seen.
 * - **Description:** whatever is left.
 */
export function parseQuickEntry(
  text: string,
  context: QuickEntryContext,
): QuickEntry {
  const tokens = tokenize(text);
  const occurredAt = readDate(tokens, context.now);
  const { amount, sign, ignored } = readAmount(tokens);
  const saysIncome = readIncomeWord(tokens);
  const hint = readAccount(tokens, context.accounts);
  const typed = readDescription(tokens);

  const merchant = recallMerchant(context.merchants, typed);
  const type =
    sign === '+' || saysIncome
      ? 'income'
      : sign === '-'
        ? 'expense'
        : (merchant?.type ?? 'expense');
  const accountId = pickAccount(
    hint,
    context.accounts,
    type,
    merchant?.accountId,
  );
  const selectable = new Set(context.categories.map(({ id }) => id));
  const remembered =
    merchant?.categoryId && selectable.has(merchant.categoryId)
      ? merchant.categoryId
      : null;
  // A merchant met before is written as it was then ("padaria real" →
  // "Padaria Real"); only an exact match carries a name.
  const description = merchant?.displayName ?? typed;

  const issues: QuickEntryIssue[] = [];
  if (amount === null) issues.push({ code: 'missing-amount' });
  if (!description) issues.push({ code: 'missing-description' });
  if (ignored.length > 0) issues.push({ code: 'several-amounts', ignored });
  if (!accountId) issues.push({ code: 'no-account' });

  return {
    description,
    amount,
    type,
    accountId,
    categoryId: remembered ?? categoryNamed(typed, context.categories),
    occurredAt,
    issues,
  };
}
