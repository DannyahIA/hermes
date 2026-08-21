import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { occurrencesToGenerate } from '@/core/value-objects/recurrence';

/**
 * Catches every active rule up to `asOf`, materializing one real
 * `Transaction` per missing occurrence and advancing each rule's
 * `lastGeneratedThrough`. Safe to call on every page load — a rule with
 * nothing due does no work, and calling it twice in a row the second call
 * generates nothing (see `occurrencesToGenerate`'s idempotency).
 */
export class GenerateDueOccurrencesUseCase {
  constructor(
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(userId: string, asOf: Date = new Date()): Promise<number> {
    const dueRules =
      await this.recurringTransactionRepository.findDueForGeneration(
        userId,
        asOf,
      );
    let generatedCount = 0;

    for (const rule of dueRules) {
      const occurrences = occurrencesToGenerate(rule, asOf);
      if (occurrences.length === 0) continue;

      let account = await this.accountRepository.findById(rule.accountId);
      // The account may have been deleted independently of its rules —
      // skip defensively rather than failing the whole batch.
      if (!account) continue;

      for (const occurredAt of occurrences) {
        const transaction = new Transaction({
          id: randomUUID(),
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          description: rule.description,
          amount: rule.amount,
          type: rule.type,
          occurredAt,
          recurringRuleId: rule.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        account = account.withBalanceDelta(
          account.deltaFor(rule.type, rule.amount),
        );
        await this.transactionRepository.save(transaction);
        generatedCount += 1;
      }

      await this.accountRepository.save(account);
      await this.recurringTransactionRepository.save(
        rule.withLastGeneratedThrough(occurrences.at(-1)!),
      );
    }

    return generatedCount;
  }
}
