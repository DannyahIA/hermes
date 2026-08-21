import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { InstallmentPlanKind } from '@/core/entities/installment-plan';
import { InstallmentPlan } from '@/core/entities/installment-plan';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import {
  calculatePriceInstallments,
  splitEvenly,
} from '@/core/value-objects/loan-amortization';

export interface CreateInstallmentPlanInput {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  kind: InstallmentPlanKind;
  /** Purchase: the total price. Loan: the principal borrowed. Provide this OR `installmentAmount`. */
  totalAmount?: number;
  /** Per-installment value — provide this OR `totalAmount`; the other is derived. Purchases only (loans always specify totalAmount, since interest makes a flat per-installment value meaningless before amortization is computed). */
  installmentAmount?: number;
  installmentCount: number;
  /** Monthly decimal rate — loans only, ignored for purchases. */
  interestRate?: number;
  /** When the first installment is due. Defaults to now. */
  startDate?: Date;
  /** Pre-generated ids for each installment transaction, in order. */
  installmentIds: string[];
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Creates an installment plan (a purchase split into N installments, or a
 * loan's repayment schedule) and immediately materializes every
 * installment as a real, dated `Transaction` — see the plan doc's "Stated
 * scope decision" for why future-dated installments still affect the
 * stored balance right away, same as any other transaction in Hermes.
 */
export class CreateInstallmentPlanUseCase {
  constructor(
    private readonly installmentPlanRepository: InstallmentPlanRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: CreateInstallmentPlanInput): Promise<InstallmentPlan> {
    let account = await this.accountRepository.findById(input.accountId);
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Account', input.accountId);
    }

    if (input.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category || category.userId !== input.userId) {
        throw new NotFoundError('Category', input.categoryId);
      }
      if (category.archived) {
        throw new DomainError(
          'An archived category cannot receive new transactions.',
          'CATEGORY_ARCHIVED',
        );
      }
    }

    if (input.installmentIds.length !== input.installmentCount) {
      throw new DomainError(
        'installmentIds must have exactly one id per installment.',
        'INSTALLMENT_ID_MISMATCH',
      );
    }

    if (
      input.totalAmount === undefined &&
      input.installmentAmount === undefined
    ) {
      throw new DomainError(
        'Informe o valor total ou o valor da parcela.',
        'INSTALLMENT_AMOUNT_MISSING',
      );
    }
    const resolvedTotalAmount =
      input.totalAmount ?? input.installmentAmount! * input.installmentCount;

    const plan = new InstallmentPlan({
      id: input.id,
      userId: input.userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      description: input.description,
      kind: input.kind,
      totalAmount: resolvedTotalAmount,
      installmentCount: input.installmentCount,
      interestRate: input.interestRate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const amounts =
      plan.kind === 'loan'
        ? calculatePriceInstallments({
            principal: plan.totalAmount,
            monthlyInterestRate: plan.interestRate ?? 0,
            installmentCount: plan.installmentCount,
          }).map((installment) => installment.amount)
        : input.installmentAmount !== undefined
          ? // Per-installment amount was given directly: use it verbatim for
            // every installment rather than re-splitting their sum, so each
            // installment is exactly what the user typed (no rounding drift).
            Array.from(
              { length: plan.installmentCount },
              () => input.installmentAmount!,
            )
          : splitEvenly(plan.totalAmount, plan.installmentCount);

    const startDate = input.startDate ?? new Date();
    const now = new Date();
    const installments: Transaction[] = [];

    for (let index = 0; index < plan.installmentCount; index += 1) {
      const installmentNumber = index + 1;
      const transaction = new Transaction({
        id: input.installmentIds[index],
        accountId: plan.accountId,
        categoryId: plan.categoryId,
        description: `${plan.description} (${installmentNumber}/${plan.installmentCount})`,
        amount: amounts[index],
        type: 'expense',
        occurredAt: addMonths(startDate, index),
        installmentPlanId: plan.id,
        installmentNumber,
        createdAt: now,
        updatedAt: now,
      });

      installments.push(transaction);
      account = account.withBalanceDelta(
        account.deltaFor('expense', transaction.amount),
      );
    }

    await this.accountRepository.save(account);
    await this.installmentPlanRepository.save(plan);
    for (const installment of installments) {
      await this.transactionRepository.save(installment);
    }

    return plan;
  }
}
