import type { AccountRepository } from '@/core/contracts/account-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface ArchiveAccountInput {
  id: string;
}

export class ArchiveAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: ArchiveAccountInput): Promise<void> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new ValidationError('Account not found.');
    }

    const archivedAccount = {
      ...account.props,
      updatedAt: new Date(),
    };

    await this.accountRepository.save(
      new (require('@/core/entities/account').Account)(archivedAccount),
    );
  }
}
