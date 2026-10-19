export interface WalletCardProps {
  id: string;
  userId: string;
  /** As the iPhone's Wallet names it: "Nubank", "Itaú Visa". */
  walletName: string;
  /** The name without case, accents or extra spaces. */
  nameKey: string;
  /** Where its payments go; unset until the user picks it. */
  accountId?: string;
  /** For one Wallet card that pays both as debit and as credit. */
  alternateAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A card in the iPhone's Wallet and the account its payments go to. A card
 * first seen in a payment is kept without an account until the user picks
 * one; the payments that arrived meanwhile wait for it.
 */
export class WalletCard {
  constructor(public readonly props: WalletCardProps) {}

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get walletName() {
    return this.props.walletName;
  }
  get nameKey() {
    return this.props.nameKey;
  }
  get accountId() {
    return this.props.accountId;
  }
  get alternateAccountId() {
    return this.props.alternateAccountId;
  }

  assign(
    accountId: string,
    alternateAccountId: string | undefined,
    now: Date,
  ): WalletCard {
    return new WalletCard({
      ...this.props,
      accountId,
      alternateAccountId:
        alternateAccountId === accountId ? undefined : alternateAccountId,
      updatedAt: now,
    });
  }
}
