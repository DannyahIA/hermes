import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { auth } from '@/infra/auth/server';
import type { Executor } from '@/infra/database/client';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { CreateAccountUseCase } from '@/modules/accounts/application/create-account.use-case';
import { PayCreditCardBillUseCase } from '@/modules/accounts/application/pay-credit-card-bill.use-case';
import { CreateBudgetUseCase } from '@/modules/budgets/application/create-budget.use-case';
import { CreateCategoryUseCase } from '@/modules/categories/application/create-category.use-case';
import { CreateInstallmentPlanUseCase } from '@/modules/installments/application/create-installment-plan.use-case';
import { CreateRecurringTransactionUseCase } from '@/modules/recurring-transactions/application/create-recurring-transaction.use-case';
import { GenerateDueOccurrencesUseCase } from '@/modules/recurring-transactions/application/generate-due-occurrences.use-case';
import { CreateTransactionUseCase } from '@/modules/transactions/application/create-transaction.use-case';

import { db } from './client';
import {
  accounts,
  budgets,
  categories,
  installmentPlans,
  recurringTransactions,
  user,
  userViewPreferences,
} from './schema';

/**
 * Realistic users, one per situation the Início screen has to handle
 * (docs/superpowers/specs/2026-10-17-inicio-hub-design.md §8), for looking
 * at screens with data that isn't QA leftovers.
 *
 * Every run wipes each scenario user's financial data and rebuilds it
 * relative to today, so the screens always look current. Data goes through
 * the app's own use cases, so balances, installments, recurring
 * occurrences and bill payments follow the same rules as real use.
 *
 * Logins: demo-<scenario>@hermes.app / Demo12345
 */

const PASSWORD = 'Demo12345';
const HISTORY_DAYS = 120;

interface Merchant {
  name: string;
  category: string;
  min: number;
  max: number;
}

interface CardSpec {
  name: string;
  closingDay: number;
  dueDay: number;
}

interface Scenario {
  key: string;
  name: string;
  checking?: { name: string; opening: number };
  savings?: { name: string; opening: number };
  cards: CardSpec[];
  categories: string[];
  salary?: number;
  rent?: number;
  subscriptions: Array<{ name: string; amount: number; day: number }>;
  merchants: Merchant[];
  /** Chance of a purchase on any given day. */
  purchasesPerDay: number;
  /** Share of purchases paid by card rather than debit. */
  cardShare: number;
  spendScale: number;
  installment?: { description: string; amount: number; count: number };
  budgets: Array<{ category: string; amount: number }>;
  /** Pay the closed card statements from checking on their due dates. */
  paysBills: boolean;
  /** Purchases in the last days left without a category, for "Para revisar". */
  uncategorized: Array<{ name: string; amount: number; daysAgo: number }>;
}

const MERCHANTS: Merchant[] = [
  { name: 'Supermercado Condor', category: 'Mercado', min: 80, max: 320 },
  { name: 'Hortifruti', category: 'Mercado', min: 25, max: 70 },
  { name: 'Padaria Real', category: 'Restaurantes', min: 12, max: 35 },
  {
    name: 'Restaurante Madalosso',
    category: 'Restaurantes',
    min: 60,
    max: 160,
  },
  { name: 'iFood', category: 'Restaurantes', min: 35, max: 90 },
  { name: 'Uber', category: 'Transporte', min: 14, max: 45 },
  { name: 'Posto Ipiranga', category: 'Transporte', min: 150, max: 260 },
  { name: 'Drogasil', category: 'Farmácia', min: 25, max: 120 },
  { name: 'Cinemark', category: 'Lazer', min: 40, max: 90 },
  { name: 'Livraria Curitiba', category: 'Lazer', min: 50, max: 150 },
];

const BASE_CATEGORIES = [
  'Mercado',
  'Restaurantes',
  'Transporte',
  'Farmácia',
  'Lazer',
  'Moradia',
  'Assinaturas',
  'Salário',
];

const SUBSCRIPTIONS = [
  { name: 'Netflix', amount: 55.9, day: 20 },
  { name: 'Spotify', amount: 21.9, day: 15 },
];

const SCENARIOS: Scenario[] = [
  {
    key: 'tipico',
    name: 'Típico',
    checking: { name: 'Nubank Conta', opening: 3000 },
    savings: { name: 'Reserva de emergência', opening: 15000 },
    cards: [{ name: 'Nubank Crédito', closingDay: 3, dueDay: 10 }],
    categories: BASE_CATEGORIES,
    salary: 5200,
    rent: 1800,
    subscriptions: SUBSCRIPTIONS,
    merchants: MERCHANTS,
    purchasesPerDay: 1.1,
    cardShare: 0.85,
    spendScale: 1,
    installment: { description: 'Geladeira', amount: 349.9, count: 10 },
    budgets: [
      { category: 'Mercado', amount: 1200 },
      { category: 'Restaurantes', amount: 600 },
      { category: 'Transporte', amount: 450 },
      { category: 'Lazer', amount: 300 },
      { category: 'Farmácia', amount: 200 },
    ],
    paysBills: true,
    uncategorized: [
      { name: 'Padaria Real', amount: 23.9, daysAgo: 0 },
      { name: 'Posto Shell', amount: 180, daysAgo: 1 },
    ],
  },
  {
    key: 'apertado',
    name: 'Apertado',
    checking: { name: 'Itaú Conta', opening: 400 },
    cards: [{ name: 'Itaú Crédito', closingDay: 25, dueDay: 5 }],
    categories: BASE_CATEGORIES,
    salary: 3500,
    rent: 1500,
    subscriptions: SUBSCRIPTIONS,
    merchants: MERCHANTS,
    purchasesPerDay: 0.95,
    cardShare: 0.95,
    spendScale: 1.4,
    installment: { description: 'Celular', amount: 289.9, count: 12 },
    budgets: [
      { category: 'Mercado', amount: 800 },
      { category: 'Restaurantes', amount: 300 },
      { category: 'Transporte', amount: 300 },
    ],
    paysBills: true,
    uncategorized: [{ name: 'Uber', amount: 27.4, daysAgo: 0 }],
  },
  {
    key: 'novo',
    name: 'Novo',
    cards: [],
    categories: [],
    subscriptions: [],
    merchants: [],
    purchasesPerDay: 0,
    cardShare: 0,
    spendScale: 1,
    budgets: [],
    paysBills: false,
    uncategorized: [],
  },
  {
    key: 'so-cartao',
    name: 'Só cartão',
    cards: [{ name: 'Nubank Crédito', closingDay: 3, dueDay: 10 }],
    categories: BASE_CATEGORIES,
    subscriptions: SUBSCRIPTIONS,
    merchants: MERCHANTS,
    purchasesPerDay: 0.6,
    cardShare: 1,
    spendScale: 1,
    budgets: [{ category: 'Mercado', amount: 900 }],
    paysBills: false,
    uncategorized: [],
  },
  {
    key: 'muitos',
    name: 'Muitos',
    checking: { name: 'Banco do Brasil Conta Corrente', opening: 8000 },
    savings: { name: 'Poupança', opening: 40000 },
    cards: [
      { name: 'Nubank Crédito', closingDay: 3, dueDay: 10 },
      { name: 'Itaú Personnalité Visa Infinite', closingDay: 15, dueDay: 22 },
      { name: 'XP Crédito', closingDay: 28, dueDay: 7 },
    ],
    categories: [
      ...BASE_CATEGORIES,
      'Saúde',
      'Educação',
      'Pets',
      'Viagem',
      'Presentes',
      'Vestuário',
      'Restaurantes e bares com os amigos do trabalho',
    ],
    salary: 14500,
    rent: 3200,
    subscriptions: [
      ...SUBSCRIPTIONS,
      { name: 'Academia', amount: 129.9, day: 5 },
      { name: 'iCloud', amount: 14.9, day: 12 },
    ],
    merchants: [
      ...MERCHANTS,
      { name: 'Petz', category: 'Pets', min: 60, max: 240 },
      { name: 'Renner', category: 'Vestuário', min: 90, max: 380 },
      { name: 'Clínica Sorriso', category: 'Saúde', min: 150, max: 450 },
      {
        name: 'Bar do Alemão',
        category: 'Restaurantes e bares com os amigos do trabalho',
        min: 70,
        max: 220,
      },
    ],
    purchasesPerDay: 1.6,
    cardShare: 0.8,
    spendScale: 1.2,
    installment: { description: 'Notebook', amount: 612.5, count: 8 },
    budgets: [
      { category: 'Mercado', amount: 1800 },
      { category: 'Restaurantes', amount: 900 },
      { category: 'Transporte', amount: 700 },
      { category: 'Lazer', amount: 500 },
      { category: 'Farmácia', amount: 300 },
      { category: 'Pets', amount: 400 },
      { category: 'Vestuário', amount: 500 },
      { category: 'Saúde', amount: 600 },
      {
        category: 'Restaurantes e bares com os amigos do trabalho',
        amount: 400,
      },
    ],
    paysBills: true,
    uncategorized: [
      { name: 'Amazon', amount: 213.4, daysAgo: 0 },
      { name: 'Posto Shell', amount: 245, daysAgo: 1 },
      { name: 'Mercado Livre', amount: 89.9, daysAgo: 2 },
    ],
  },
];

/** Deterministic, so the screenshots of a scenario only change when the code does. */
function seededRandom(seed: string) {
  let state = [...seed].reduce(
    (hash, char) => hash * 31 + char.charCodeAt(0),
    7,
  );
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgo(today: Date, days: number, hour = 12, minute = 0): Date {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - days,
    hour,
    minute,
  );
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getOrCreateUser(email: string, name: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existing) return existing.id;

  const result = await auth.api.signUpEmail({
    body: { name, email, password: PASSWORD },
  });
  // A seed has no inbox to click a verification link from (see seed.ts).
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, result.user.id));
  return result.user.id;
}

async function wipeFinancialData(tx: Executor, userId: string) {
  await tx.delete(budgets).where(eq(budgets.userId, userId));
  await tx
    .delete(recurringTransactions)
    .where(eq(recurringTransactions.userId, userId));
  await tx.delete(installmentPlans).where(eq(installmentPlans.userId, userId));
  // Transactions go with their accounts (cascade).
  await tx.delete(accounts).where(eq(accounts.userId, userId));
  await tx.delete(categories).where(eq(categories.userId, userId));
  await tx
    .delete(userViewPreferences)
    .where(eq(userViewPreferences.userId, userId));
}

async function build(tx: Executor, userId: string, scenario: Scenario) {
  const today = new Date();
  const random = seededRandom(scenario.key);
  const historyStart = daysAgo(today, HISTORY_DAYS, 0);

  const accountRepository = new DrizzleAccountRepository(tx);
  const transactionRepository = new DrizzleTransactionRepository(tx);
  const categoryRepository = new DrizzleCategoryRepository(tx);
  const recurringRepository = new DrizzleRecurringTransactionRepository(tx);
  const createAccount = new CreateAccountUseCase(accountRepository);
  const createTransaction = new CreateTransactionUseCase(
    transactionRepository,
    accountRepository,
    categoryRepository,
  );

  const categoryIds = new Map<string, string>();
  for (const name of scenario.categories) {
    const id = randomUUID();
    await new CreateCategoryUseCase(categoryRepository).execute({
      id,
      userId,
      name,
    });
    categoryIds.set(name, id);
  }

  const account = async (
    name: string,
    type: 'checking' | 'savings' | 'credit',
    balance: number,
    card?: CardSpec,
  ) => {
    const id = randomUUID();
    await createAccount.execute({
      id,
      userId,
      name,
      type,
      balance,
      currency: 'BRL',
      closingDay: card?.closingDay,
      dueDay: card?.dueDay,
    });
    return id;
  };

  const checkingId = scenario.checking
    ? await account(
        scenario.checking.name,
        'checking',
        scenario.checking.opening,
      )
    : undefined;
  if (scenario.savings) {
    await account(scenario.savings.name, 'savings', scenario.savings.opening);
  }
  const cards: Array<CardSpec & { id: string }> = [];
  for (const card of scenario.cards) {
    cards.push({ ...card, id: await account(card.name, 'credit', 0, card) });
  }

  const recurring = async (
    accountId: string,
    description: string,
    amount: number,
    type: 'income' | 'expense',
    day: number,
    category: string,
  ) =>
    new CreateRecurringTransactionUseCase(
      recurringRepository,
      accountRepository,
      categoryRepository,
    ).execute({
      id: randomUUID(),
      userId,
      accountId,
      categoryId: categoryIds.get(category),
      description,
      amount,
      type,
      dayRuleKind: 'fixed_day',
      dayRuleDay: day,
      startDate: historyStart,
    });

  if (checkingId && scenario.salary) {
    await recurring(
      checkingId,
      'Salário',
      scenario.salary,
      'income',
      5,
      'Salário',
    );
  }
  if (checkingId && scenario.rent) {
    await recurring(
      checkingId,
      'Aluguel',
      scenario.rent,
      'expense',
      10,
      'Moradia',
    );
  }
  const mainCard = cards[0];
  for (const subscription of scenario.subscriptions) {
    const accountId = mainCard?.id ?? checkingId;
    if (accountId) {
      await recurring(
        accountId,
        subscription.name,
        subscription.amount,
        'expense',
        subscription.day,
        'Assinaturas',
      );
    }
  }

  // Day-to-day purchases: mostly by card, like someone paying by phone.
  for (let day = HISTORY_DAYS; day >= 1; day--) {
    let budget = scenario.purchasesPerDay;
    while (budget > 0 && random() < Math.min(budget, 1)) {
      budget -= 1;
      const merchant =
        scenario.merchants[Math.floor(random() * scenario.merchants.length)];
      const onCard =
        cards.length > 0 && (random() < scenario.cardShare || !checkingId);
      const accountId = onCard
        ? cards[Math.floor(random() * cards.length)].id
        : checkingId;
      if (!accountId) continue;
      await createTransaction.execute({
        id: randomUUID(),
        userId,
        accountId,
        categoryId: categoryIds.get(merchant.category),
        description: merchant.name,
        amount: cents(
          (merchant.min + random() * (merchant.max - merchant.min)) *
            scenario.spendScale,
        ),
        type: 'expense',
        occurredAt: daysAgo(
          today,
          day,
          8 + Math.floor(random() * 13),
          Math.floor(random() * 60),
        ),
      });
    }
  }

  for (const purchase of scenario.uncategorized) {
    const accountId = mainCard?.id ?? checkingId;
    if (!accountId) continue;
    await createTransaction.execute({
      id: randomUUID(),
      userId,
      accountId,
      description: purchase.name,
      amount: purchase.amount,
      type: 'expense',
      occurredAt: daysAgo(today, purchase.daysAgo, 12, 41),
    });
  }

  if (scenario.installment && mainCard) {
    const { description, amount, count } = scenario.installment;
    await new CreateInstallmentPlanUseCase(
      new DrizzleInstallmentPlanRepository(tx),
      transactionRepository,
      accountRepository,
      categoryRepository,
    ).execute({
      id: randomUUID(),
      userId,
      accountId: mainCard.id,
      categoryId: categoryIds.get('Moradia'),
      description,
      kind: 'purchase',
      installmentAmount: amount,
      installmentCount: count,
      startDate: new Date(today.getFullYear(), today.getMonth() - 2, 8),
      installmentIds: Array.from({ length: count }, () => randomUUID()),
    });
  }

  await new GenerateDueOccurrencesUseCase(
    recurringRepository,
    transactionRepository,
    accountRepository,
  ).execute(userId, today);

  // Pay each closed statement on its due date: everything charged to the
  // card between the two closings before it.
  if (scenario.paysBills && checkingId) {
    const payBill = new PayCreditCardBillUseCase(
      transactionRepository,
      accountRepository,
    );
    for (const card of cards) {
      const charges = await transactionRepository.findByAccountId(card.id);
      for (let back = 4; back >= 0; back--) {
        const closing = new Date(
          today.getFullYear(),
          today.getMonth() - back,
          card.closingDay,
        );
        const previousClosing = new Date(
          closing.getFullYear(),
          closing.getMonth() - 1,
          card.closingDay,
        );
        const due = new Date(
          closing.getFullYear(),
          closing.getMonth() + (card.dueDay < card.closingDay ? 1 : 0),
          card.dueDay,
          9,
        );
        if (due > today) continue;

        const statement = charges
          .filter(
            (t) => t.occurredAt > previousClosing && t.occurredAt <= closing,
          )
          .reduce(
            (sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount),
            0,
          );
        if (statement <= 0) continue;
        await payBill.execute({
          userId,
          creditAccountId: card.id,
          payingAccountId: checkingId,
          amount: cents(statement),
          paidAt: due,
        });
      }
    }
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  for (const budget of scenario.budgets) {
    const categoryId = categoryIds.get(budget.category);
    if (!categoryId) continue;
    await new CreateBudgetUseCase(
      new DrizzleBudgetRepository(tx),
      categoryRepository,
    ).execute({
      id: randomUUID(),
      userId,
      categoryId,
      amount: budget.amount,
      currency: 'BRL',
      periodStart: monthStart,
      periodEnd: monthEnd,
    });
  }
}

async function main() {
  const only = process.argv[2];
  for (const scenario of SCENARIOS) {
    if (only && scenario.key !== only) continue;
    const email = `demo-${scenario.key}@hermes.app`;
    const userId = await getOrCreateUser(email, `Demo ${scenario.name}`);
    await withTransaction(async (tx) => {
      await wipeFinancialData(tx, userId);
      await build(tx, userId, scenario);
    });
    console.log(`${email} / ${PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error('Scenario seed failed:', error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
