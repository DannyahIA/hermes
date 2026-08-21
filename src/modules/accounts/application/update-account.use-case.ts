import type { AccountRepository } from '@/core/contracts/account-repository';
import type { Account, AccountKind } from '@/core/entities/account';
import { NotFoundError } from '@/core/errors/not-found-error';

/**
 * `balance` is deliberately not editable here — per domain.md's Single
 * Source of Truth rule, it's only ever changed as a consequence of a
 * transaction (see `modules/transactions`).
 */
export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: AccountKind;
  currency?: string;
  closingDay?: number;
  dueDay?: number;
}

export class UpdateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: UpdateAccountInput): Promise<Account> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new NotFoundError('Account', input.id);
    }

    const updated = account.update(input);
    await this.accountRepository.save(updated);

    return updated;
  }
}
