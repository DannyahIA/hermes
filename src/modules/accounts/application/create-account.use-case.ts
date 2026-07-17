import { Account } from '@/core/entities/account';
import type { AccountRepository } from '@/core/contracts/account-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface CreateAccountInput {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  balance: number;
  currency: string;
}

export class CreateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    if (!input.name.trim()) {
      throw new ValidationError('Account name is required.');
    }

    const account = new Account({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.accountRepository.save(account);

    return account;
  }
}
