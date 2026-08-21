import type { AccountRepository } from '@/core/contracts/account-repository';
import type { Account } from '@/core/entities/account';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface GetAccountInput {
  id: string;
  userId: string;
}

export class GetAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: GetAccountInput): Promise<Account> {
    const account = await this.accountRepository.findById(input.id);

    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Account', input.id);
    }

    return account;
  }
}
