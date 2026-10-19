import type { Executor } from '@/infra/database/client';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCaptureEventRepository } from '@/infra/repositories/drizzle-capture-event.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { DrizzleWalletCardRepository } from '@/infra/repositories/drizzle-wallet-card.repository';
import type { CaptureDependencies } from '@/modules/capture/application/capture-wallet-payment.use-case';

/** The capture use cases' repositories, all on one unit of work. */
export function captureDependencies(executor: Executor): CaptureDependencies {
  return {
    captureEvents: new DrizzleCaptureEventRepository(executor),
    walletCards: new DrizzleWalletCardRepository(executor),
    merchantRules: new DrizzleMerchantRuleRepository(executor),
    categories: new DrizzleCategoryRepository(executor),
    accounts: new DrizzleAccountRepository(executor),
    transactions: new DrizzleTransactionRepository(executor),
  };
}
