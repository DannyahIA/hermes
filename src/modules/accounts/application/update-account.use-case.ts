import type { AccountRepository } from '@/core/contracts/account-repository';
import { Account } from '@/core/entities/account';
import { ValidationError } from '@/core/errors/validation-error';

export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: 'checking' | 'savings' | 'credit';
  balance?: number;
  currency?: string;
}

export class UpdateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: UpdateAccountInput): Promise<Account> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new ValidationError('Account not found.');
    }

    const updatedAccount = new Account({
      ...account.props,
      ...input,
      updatedAt: new Date(),
    });

    await this.accountRepository.save(updatedAccount);

    return updatedAccount;
  }
}
