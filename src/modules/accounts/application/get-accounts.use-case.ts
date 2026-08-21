import type { AccountRepository } from '@/core/contracts/account-repository';
import type { Account } from '@/core/entities/account';

export class GetAccountsUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(userId: string): Promise<Account[]> {
    return this.accountRepository.findByUserId(userId);
  }
}
