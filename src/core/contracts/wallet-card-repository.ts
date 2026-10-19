import type { WalletCard } from '@/core/entities/wallet-card';

export interface WalletCardRepository {
  findById(id: string): Promise<WalletCard | null>;
  findByKey(userId: string, nameKey: string): Promise<WalletCard | null>;
  findByUserId(userId: string): Promise<WalletCard[]>;
  save(card: WalletCard): Promise<void>;
}
