import { randomUUID } from 'node:crypto';

import { db } from './client';
import { accounts, budgets, categories, transactions, users } from './schema';

async function main() {
  const adminUserId = randomUUID();
  const guestUserId = randomUUID();
  const essentialsCategoryId = randomUUID();
  const leisureCategoryId = randomUUID();
  const checkingAccountId = randomUUID();
  const savingsAccountId = randomUUID();

  await db
    .insert(users)
    .values([
      { id: adminUserId, name: 'Admin User', email: 'admin@example.com' },
      { id: guestUserId, name: 'Guest User', email: 'guest@example.com' },
    ])
    .onConflictDoNothing();

  await db
    .insert(categories)
    .values([
      {
        id: essentialsCategoryId,
        name: 'Essentials',
        description: 'Basic monthly needs',
        color: '#2563eb',
      },
      {
        id: leisureCategoryId,
        name: 'Leisure',
        description: 'Entertainment and hobbies',
        color: '#f59e0b',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(accounts)
    .values([
      {
        id: checkingAccountId,
        userId: adminUserId,
        name: 'Main Checking',
        type: 'checking',
        balance: '3250.75',
        currency: 'BRL',
      },
      {
        id: savingsAccountId,
        userId: adminUserId,
        name: 'Emergency Fund',
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
        description: 'Groceries',
        amount: '145.80',
        type: 'expense',
        occurredAt: new Date('2026-07-01T10:00:00.000Z'),
      },
      {
        accountId: checkingAccountId,
        categoryId: leisureCategoryId,
        description: 'Streaming subscription',
        amount: '39.90',
        type: 'expense',
        occurredAt: new Date('2026-07-03T18:00:00.000Z'),
      },
      {
        accountId: checkingAccountId,
        categoryId: undefined,
        description: 'Salary',
        amount: '2800.00',
        type: 'income',
        occurredAt: new Date('2026-07-05T09:30:00.000Z'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(budgets)
    .values([
      {
        userId: adminUserId,
        categoryId: essentialsCategoryId,
        amount: '1800.00',
        currency: 'BRL',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T23:59:59.000Z'),
      },
      {
        userId: adminUserId,
        categoryId: leisureCategoryId,
        amount: '600.00',
        currency: 'BRL',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T23:59:59.000Z'),
      },
    ])
    .onConflictDoNothing();

  console.log('Database seed completed successfully.');
}

main().catch((error) => {
  console.error('Database seed failed:', error);
  process.exit(1);
});
