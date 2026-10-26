import type { BudgetAlertLog } from '@/core/contracts/budget-alert-log';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';

import { budgetAlertFor, staleStages } from '../domain/budget-alerts';
import { limitState } from '../domain/limit-state';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from './get-budget-progress.use-case';

export interface CheckBudgetAlertsInput {
  userId: string;
  /** The purchases just recorded, in the order they should be told about. */
  transactionIds: string[];
  now: Date;
}

/**
 * What to tell the user after recording purchases: for each running budget a
 * purchase falls in, at most one alert, and each warning stage only once per
 * period (see `BudgetAlertLog`).
 */
export class CheckBudgetAlertsUseCase {
  private readonly progress: GetBudgetProgressUseCase;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly alertLog: BudgetAlertLog,
  ) {
    this.progress = new GetBudgetProgressUseCase(
      budgetRepository,
      transactionRepository,
    );
  }

  async execute({
    userId,
    transactionIds,
    now,
  }: CheckBudgetAlertsInput): Promise<string[]> {
    const purchases = await this.loadPurchases(transactionIds);
    if (purchases.length === 0) return [];

    // One path for what "spent" means: the same one the budget screens use.
    const running = (await this.progress.execute(userId, now)).filter(
      (progress) => progress.running,
    );

    const alerts: string[] = [];
    const told = new Set<string>();

    for (const purchase of purchases) {
      for (const progress of running) {
        const { budget, period } = progress;
        if (
          told.has(budget.id) ||
          budget.categoryId !== purchase.categoryId ||
          !period.contains(purchase.occurredAt)
        ) {
          continue;
        }
        told.add(budget.id);

        const alert = await this.alertFor(progress, now);
        if (alert) alerts.push(alert);
      }
    }

    return alerts;
  }

  /** The expenses among `ids`; ids that are missing or aren't spending are skipped. */
  private async loadPurchases(ids: string[]): Promise<Transaction[]> {
    const found = await Promise.all(
      ids.map((id) => this.transactionRepository.findById(id)),
    );
    return found.filter(
      (transaction): transaction is Transaction =>
        transaction !== null &&
        transaction.countsAs('expense') &&
        transaction.categoryId !== undefined,
    );
  }

  private async alertFor(
    { budget, period, amount, spent }: BudgetProgress,
    now: Date,
  ): Promise<string | null> {
    const category = await this.categoryRepository.findById(budget.categoryId);
    if (!category) return null;

    // Stages spending no longer reaches start over, so they warn again when
    // it gets back there.
    const claimed = await this.alertLog.warned(budget.id, period.start);
    const stale = staleStages(claimed, spent, amount);
    await this.alertLog.release(budget.id, period.start, stale);
    const warned = new Set(
      [...claimed].filter((stage) => !stale.includes(stage)),
    );

    const alert = budgetAlertFor({
      categoryName: category.name,
      amount,
      spent,
      period,
      today: now,
      warned,
    });
    if (!alert) return null;

    // "Over the limit" claims nothing once told, and is still always sent.
    if (alert.claims.length === 0 && limitState(spent, amount) === 'over')
      return alert.text;

    const won = await this.alertLog.claim(
      budget.id,
      period.start,
      alert.claims,
    );
    return won.length > 0 ? alert.text : null;
  }
}
