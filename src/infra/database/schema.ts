import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const accountType = pgEnum('account_type', [
  'checking',
  'savings',
  'credit',
]);
export const transactionType = pgEnum('transaction_type', [
  'income',
  'expense',
  'transfer',
]);
export const installmentPlanKind = pgEnum('installment_plan_kind', [
  'purchase',
  'loan',
]);
export const recurringDayRuleKind = pgEnum('recurring_day_rule_kind', [
  'fixed_day',
  'first_business_day',
  'last_business_day',
]);

/**
 * ---------------------------------------------------------------------------
 * Auth tables — owned and read by better-auth's Drizzle adapter.
 * `user` is the single source of truth for identity; every domain table
 * below references `user.id`. Application code should treat these four
 * tables as infrastructure detail and never query them directly outside
 * `infra/auth`.
 * ---------------------------------------------------------------------------
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * ---------------------------------------------------------------------------
 * Domain tables.
 * ---------------------------------------------------------------------------
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountType('type').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('BRL'),
  archived: boolean('archived').notNull().default(false),
  hidden: boolean('hidden').notNull().default(false),
  // Only meaningful for type: 'credit' — the day of the month a card's
  // statement closes / its bill is due. See Account#nextDueDate.
  closingDay: integer('closing_day'),
  dueDay: integer('due_day'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * An installment purchase or a loan — either way, a fixed number of future
 * `transactions` rows are generated from it (see `installment_plan_id`
 * below). A loan is simply a plan with `kind: 'loan'` and `interestRate`
 * set; its per-installment interest/principal split is never stored, only
 * computed on read from `totalAmount`/`interestRate`/`installmentCount`
 * (see core/value-objects/loan-amortization.ts).
 */
export const installmentPlans = pgTable('installment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: uuid('account_id')
    .references(() => accounts.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  description: varchar('description', { length: 255 }).notNull(),
  kind: installmentPlanKind('kind').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  installmentCount: integer('installment_count').notNull(),
  // Monthly rate as a decimal (0.02 = 2% a.m.) — loans only.
  interestRate: numeric('interest_rate', { precision: 8, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A rule that stamps out a real `transactions` row on each occurrence —
 * "salário no primeiro dia útil", "internet todo dia 8". Materialization is
 * lazy (see `GenerateDueOccurrencesUseCase`, invoked from `AppShell` on
 * every authenticated page load) — there is no cron/queue in this app, so a
 * rule simply catches up to "today" the next time the user opens Hermes.
 */
export const recurringTransactions = pgTable('recurring_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: uuid('account_id')
    .references(() => accounts.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  description: varchar('description', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: transactionType('type').notNull(),
  dayRuleKind: recurringDayRuleKind('day_rule_kind').notNull(),
  // Only meaningful when dayRuleKind === 'fixed_day' (1–31, clamped to the
  // month's real last day when shorter — see core/value-objects/recurrence.ts).
  dayRuleDay: integer('day_rule_day'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  lastGeneratedThrough: timestamp('last_generated_through', {
    withTimezone: true,
  }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * `transactions.account_id` cascades on account deletion — an account and
 * its history are one lifecycle. `category_id` sets to null so deleting a
 * category never destroys financial history, only its classification.
 * `installment_plan_id` cascades — deleting a plan (see
 * DeleteInstallmentPlanUseCase, which reverses balances first) removes all
 * of its generated installments. `recurring_rule_id` sets to null instead —
 * deleting a recurring rule must never erase the transactions it already
 * produced, only detach the label.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    description: varchar('description', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    type: transactionType('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    installmentPlanId: uuid('installment_plan_id').references(
      () => installmentPlans.id,
      { onDelete: 'cascade' },
    ),
    installmentNumber: integer('installment_number'),
    recurringRuleId: uuid('recurring_rule_id').references(
      () => recurringTransactions.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Backs the keyset-pagination query (WHERE (occurred_at, id) < cursor
    // ORDER BY occurred_at DESC, id DESC) used by GetTransactionsUseCase's
    // cursor path — see infra/repositories/drizzle-transaction.repository.ts.
    // .nullsFirst() on both DESC columns matches Postgres's default
    // DESC NULLS FIRST sort order (used by the plain `desc()` ORDER BY in
    // the repository query) so the planner can use this index to satisfy
    // the sort directly, without an explicit Sort node. Both columns are
    // NOT NULL, so this is a pathkey-matching fix only — no semantic change.
    index('transactions_account_cursor_idx').on(
      table.accountId,
      table.occurredAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);

/**
 * `budgets.category_id` cascades on category deletion — a budget without
 * its category no longer means anything, unlike a transaction.
 */
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: uuid('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('BRL'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
