import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { auth } from '@/infra/auth/server';

import { db } from './client';
import { accounts, budgets, categories, transactions, user } from './schema';

const DEMO_EMAIL = 'demo@hermes.app';
const DEMO_PASSWORD = 'Demo12345';

async function getOrCreateDemoUser(): Promise<string> {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return existing.id;

  const result = await auth.api.signUpEmail({
    body: { name: 'Usuário Demo', email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });

  // Sign-up alone doesn't verify the email (requireEmailVerification is on
  // — see infra/auth/server.ts), and a seed script has no inbox to click a
  // link from. Marking it verified here is the seed's job, not a bypass of
  // the rule for real users.
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, result.user.id));

  return result.user.id;
}

async function main() {
  const userId = await getOrCreateDemoUser();

  const essentialsCategoryId = randomUUID();
  const leisureCategoryId = randomUUID();
  const checkingAccountId = randomUUID();
  const savingsAccountId = randomUUID();

  await db
    .insert(categories)
    .values([
      {
        id: essentialsCategoryId,
        userId,
        name: 'Essenciais',
        description: 'Necessidades básicas do mês',
        color: '#2563eb',
      },
      {
        id: leisureCategoryId,
        userId,
        name: 'Lazer',
        description: 'Entretenimento e hobbies',
        color: '#f59e0b',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(accounts)
    .values([
      {
        id: checkingAccountId,
        userId,
        name: 'Conta corrente',
        type: 'checking',
        balance: '3250.75',
        currency: 'BRL',
      },
      {
        id: savingsAccountId,
        userId,
        name: 'Reserva de emergência',
        type: 'savings',
        balance: '8500.00',
        currency: 'BRL',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(transactions)
    .values([
      {
        accountId: checkingAccountId,
        categoryId: essentialsCategoryId,
        description: 'Supermercado',
        amount: '145.80',
        type: 'expense',
        occurredAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        accountId: checkingAccountId,
        categoryId: leisureCategoryId,
        description: 'Assinatura de streaming',
        amount: '39.90',
        type: 'expense',
        occurredAt: new Date('2026-08-03T18:00:00.000Z'),
      },
      {
        accountId: checkingAccountId,
        categoryId: null,
        description: 'Salário',
        amount: '2800.00',
        type: 'income',
        occurredAt: new Date('2026-08-05T09:30:00.000Z'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(budgets)
    .values([
      {
        userId,
        categoryId: essentialsCategoryId,
        amount: '1800.00',
        currency: 'BRL',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-31T23:59:59.000Z'),
      },
      {
        userId,
        categoryId: leisureCategoryId,
        amount: '600.00',
        currency: 'BRL',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-31T23:59:59.000Z'),
      },
    ])
    .onConflictDoNothing();

  console.log('Database seed completed successfully.');
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
