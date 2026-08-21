import type { AccountRepository } from '@/core/contracts/account-repository';
import { Account, type AccountKind } from '@/core/entities/account';

export interface CreateAccountInput {
  id: string;
  userId: string;
  name: string;
  type: AccountKind;
  balance: number;
  currency: string;
  /** Only meaningful when type === 'credit'. */
  closingDay?: number;
  dueDay?: number;
}

export class CreateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    const account = new Account({
      ...input,
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.accountRepository.save(account);

    return account;
  }
}
