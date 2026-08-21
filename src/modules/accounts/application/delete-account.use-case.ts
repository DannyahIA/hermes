import type { AccountRepository } from '@/core/contracts/account-repository';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteAccountInput {
  id: string;
}

export class DeleteAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly hasTransactions: (accountId: string) => Promise<boolean>,
  ) {}

  async execute(input: DeleteAccountInput): Promise<void> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new NotFoundError('Account', input.id);
    }

    if (await this.hasTransactions(input.id)) {
      throw new DomainError(
        'This account has transactions and cannot be deleted. Archive it instead.',
        'ACCOUNT_HAS_TRANSACTIONS',
      );
    }

    await this.accountRepository.delete(input.id);
  }
}
