import { and, desc, eq, gte, lte } from 'drizzle-orm';

import type {
  TransactionFilters,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import { Transaction, type TransactionKind } from '@/core/entities/transaction';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { accounts, transactions } from '@/infra/database/schema';

type TransactionRow = typeof transactions.$inferSelect;

function toDomain(row: TransactionRow): Transaction {
  return new Transaction({
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId ?? undefined,
    description: row.description,
    amount: Number(row.amount),
    type: row.type as TransactionKind,
    occurredAt: row.occurredAt,
    installmentPlanId: row.installmentPlanId ?? undefined,
    installmentNumber: row.installmentNumber ?? undefined,
    recurringRuleId: row.recurringRuleId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<Transaction | null> {
    const [row] = await this.executor
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const rows = await this.executor
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.occurredAt));

    return rows.map(toDomain);
  }

  async findByUserId(
    userId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    const conditions = [eq(accounts.userId, userId)];

    if (filters.accountId)
      conditions.push(eq(transactions.accountId, filters.accountId));
    if (filters.categoryId)
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters.type) conditions.push(eq(transactions.type, filters.type));
    if (filters.from)
      conditions.push(gte(transactions.occurredAt, filters.from));
    if (filters.to) conditions.push(lte(transactions.occurredAt, filters.to));

    const pageSize = filters.pageSize ?? 50;
    const page = filters.page ?? 1;

    const rows = await this.executor
      .select({ transaction: transactions })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return rows.map((row) => toDomain(row.transaction));
  }

  async findByInstallmentPlanId(
    installmentPlanId: string,
  ): Promise<Transaction[]> {
    const rows = await this.executor
      .select()
      .from(transactions)
      .where(eq(transactions.installmentPlanId, installmentPlanId))
      .orderBy(transactions.installmentNumber);

    return rows.map(toDomain);
  }

  async save(transaction: Transaction): Promise<void> {
    const values = {
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId ?? null,
      description: transaction.description,
      amount: transaction.amount.toFixed(2),
      type: transaction.type,
      occurredAt: transaction.occurredAt,
      installmentPlanId: transaction.installmentPlanId ?? null,
      installmentNumber: transaction.installmentNumber ?? null,
      recurringRuleId: transaction.recurringRuleId ?? null,
      updatedAt: transaction.props.updatedAt,
    };

    await this.executor
      .insert(transactions)
      .values({ ...values, createdAt: transaction.props.createdAt })
      .onConflictDoUpdate({ target: transactions.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(transactions).where(eq(transactions.id, id));
  }
}
