import type { AccountRepository } from '@/core/contracts/account-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface DeleteAccountInput {
  id: string;
}

export class DeleteAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: DeleteAccountInput): Promise<void> {
    const account = await this.accountRepository.findById(input.id);

    if (!account) {
      throw new ValidationError('Account not found.');
    }

    await this.accountRepository.save(account);
  }
}
