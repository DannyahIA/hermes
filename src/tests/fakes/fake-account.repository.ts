import type { AccountRepository } from '@/core/contracts/account-repository';
import type { Account } from '@/core/entities/account';

/**
 * In-memory stand-in for `AccountRepository`, used by use-case unit tests
 * so the domain never touches a real database (conventions.md).
 */
export class FakeAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  async findById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Account[]> {
    return [...this.accounts.values()].filter(
      (account) => account.userId === userId,
    );
  }

  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async delete(id: string): Promise<void> {
    this.accounts.delete(id);
  }
}
