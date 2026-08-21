import type { AccountRepository } from '@/core/contracts/account-repository';
import type { Account } from '@/core/entities/account';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface ArchiveAccountInput {
  id: string;
  archived: boolean;
}

export class ArchiveAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: ArchiveAccountInput): Promise<Account> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new NotFoundError('Account', input.id);
    }

    const updated = input.archived ? account.archive() : account.unarchive();
    await this.accountRepository.save(updated);

    return updated;
  }
}
