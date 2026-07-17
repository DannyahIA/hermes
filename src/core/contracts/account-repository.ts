import type { Account } from '@/core/entities/account';

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findByUserId(userId: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}
