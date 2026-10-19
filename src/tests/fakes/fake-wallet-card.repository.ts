import type { WalletCardRepository } from '@/core/contracts/wallet-card-repository';
import type { WalletCard } from '@/core/entities/wallet-card';

export class FakeWalletCardRepository implements WalletCardRepository {
  private readonly cards = new Map<string, WalletCard>();

  async findById(id: string): Promise<WalletCard | null> {
    return this.cards.get(id) ?? null;
  }

  async findByKey(userId: string, nameKey: string): Promise<WalletCard | null> {
    return (
      [...this.cards.values()].find(
        (card) => card.userId === userId && card.nameKey === nameKey,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<WalletCard[]> {
    return [...this.cards.values()].filter((card) => card.userId === userId);
  }

  async save(card: WalletCard): Promise<void> {
    this.cards.set(card.id, card);
  }
}
