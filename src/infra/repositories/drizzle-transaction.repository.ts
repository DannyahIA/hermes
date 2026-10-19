import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import type {
  GroupTotal,
  TransactionFilters,
  TransactionGrouping,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import { Transaction, type TransactionKind } from '@/core/entities/transaction';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { accounts, transactions } from '@/infra/database/schema';
import { foldText } from '@/shared/lib/fold-text';

type TransactionRow = typeof transactions.$inferSelect;

/**
 * What `foldText` does, in SQL: `lower` alone keeps accented capitals
 * under the C locale, so both cases are mapped.
 */
const ACCENTED = 'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const UNACCENTED = 'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn';

/** A LIKE pattern matching `text` anywhere, its wildcards taken literally. */
function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** The server's zone: "2026-10-13" means that day here, as everywhere else. */
function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

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
    settlesAccountId: row.settlesAccountId ?? undefined,
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

  private conditionsFor(userId: string, filters: TransactionFilters): SQL[] {
    const conditions = [eq(accounts.userId, userId)];

    const search = filters.search ? foldText(filters.search).trim() : '';
    if (search) {
      conditions.push(
        sql`translate(lower(${transactions.description}), ${ACCENTED}, ${UNACCENTED}) like ${containing(search)}`,
      );
    }
    if (filters.accountId)
      conditions.push(eq(transactions.accountId, filters.accountId));
    if (filters.categoryId)
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters.uncategorized) {
      conditions.push(
        isNull(transactions.categoryId),
        isNull(transactions.settlesAccountId),
        ne(transactions.type, 'transfer'),
      );
    }
    if (filters.type) conditions.push(eq(transactions.type, filters.type));
    if (filters.from)
      conditions.push(gte(transactions.occurredAt, filters.from));
    if (filters.to) conditions.push(lte(transactions.occurredAt, filters.to));

    return conditions;
  }

  async findByUserId(
    userId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    const conditions = this.conditionsFor(userId, filters);

    if (filters.cursor) {
      const { occurredAt, id } = filters.cursor;
      // Keyset predicate for a DESC/DESC order: strictly older than the
      // cursor's occurredAt, OR same occurredAt with a strictly smaller id
      // (the tie-break that makes the sort order total and stable even
      // when several transactions share a timestamp).
      conditions.push(
        or(
          lt(transactions.occurredAt, occurredAt),
          and(eq(transactions.occurredAt, occurredAt), lt(transactions.id, id)),
        )!,
      );
    }

    const limit = filters.pageSize ?? 50;
    const usesOffset = !filters.cursor && filters.page !== undefined;

    let query = this.executor
      .select({ transaction: transactions })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(limit);

    if (usesOffset) {
      query = query.offset(((filters.page ?? 1) - 1) * limit) as typeof query;
    }

    const rows = await query;

    return rows.map((row) => toDomain(row.transaction));
  }

  async totalsBy(
    userId: string,
    grouping: TransactionGrouping,
    filters: TransactionFilters = {},
  ): Promise<GroupTotal[]> {
    const key =
      grouping === 'category'
        ? sql<string>`coalesce(${transactions.categoryId}::text, 'none')`
        : sql<string>`to_char(${transactions.occurredAt} at time zone ${localTimeZone()}, ${grouping === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'})`;

    const rows = await this.executor
      .select({
        key,
        income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
        expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          ...this.conditionsFor(userId, filters),
          ne(transactions.type, 'transfer'),
          isNull(transactions.settlesAccountId),
        ),
      )
      // By position: the key's parameters would differ between the select
      // list and a repeated expression here, and Postgres would refuse it.
      .groupBy(sql`1`);

    return rows.map((row) => ({
      key: row.key,
      income: Number(row.income),
      expense: Number(row.expense),
    }));
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
      settlesAccountId: transaction.settlesAccountId ?? null,
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
