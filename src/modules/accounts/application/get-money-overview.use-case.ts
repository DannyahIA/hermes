import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { AccountKind } from '@/core/entities/account';
import { DateRange } from '@/core/value-objects/date-range';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';

export interface AccountLine {
  id: string;
  name: string;
  type: AccountKind;
  balance: number;
  currency: string;
  archived: boolean;
  hidden: boolean;
  closingDay?: number;
  dueDay?: number;
  nextDue?: Date;
}

export interface MoneyOverview {
  /** Sum of the checking balances. */
  checking: number;
  /** What is owed on credit cards, as a positive number. */
  cards: number;
  /** Sum of the savings balances. */
  savings: number;
  /** Expenses with an installment plan dated this month (purchases and loans). */
  installmentsThisMonth: number;
  /** Checking, credit, savings — active and visible accounts only. */
  groups: { kind: AccountKind; accounts: AccountLine[] }[];
  /** Archived or hidden accounts, kept out of the totals. */
  tucked: AccountLine[];
}

const GROUP_ORDER: AccountKind[] = ['checking', 'credit', 'savings'];

/**
 * The figures and the account list behind the Meu Dinheiro page. Balances
 * are the current ones (future installments excluded); a card's balance is
 * what is owed, so it is already the positive "nos cartões" figure.
 */
export class GetMoneyOverviewUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(userId: string, now: Date): Promise<MoneyOverview> {
    const month = DateRange.monthOf(now);
    const [withBalances, monthExpenses] = await Promise.all([
      new GetAccountsUseCase(
        this.accountRepository,
        this.transactionRepository,
      ).execute(userId, now),
      this.transactionRepository.findByUserId(userId, {
        type: 'expense',
        from: month.start,
        to: month.end,
        pageSize: 10_000,
      }),
    ]);

    const lines: AccountLine[] = withBalances.map(
      ({ account, currentBalance }) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: currentBalance,
        currency: account.currency,
        archived: account.archived,
        hidden: account.hidden,
        closingDay: account.closingDay,
        dueDay: account.dueDay,
        nextDue: account.nextDueDate(now) ?? undefined,
      }),
    );

    const live = lines.filter((line) => !line.archived && !line.hidden);
    const tucked = lines.filter((line) => line.archived || line.hidden);
    const sumOf = (kind: AccountKind) =>
      live
        .filter((line) => line.type === kind)
        .reduce((total, line) => total + line.balance, 0);

    return {
      checking: sumOf('checking'),
      cards: sumOf('credit'),
      savings: sumOf('savings'),
      installmentsThisMonth: monthExpenses
        .filter(
          (transaction) =>
            transaction.installmentPlanId !== undefined &&
            transaction.countsAs('expense'),
        )
        .reduce((total, transaction) => total + transaction.amount, 0),
      groups: GROUP_ORDER.map((kind) => ({
        kind,
        accounts: live.filter((line) => line.type === kind),
      })).filter((group) => group.accounts.length > 0),
      tucked,
    };
  }
}
