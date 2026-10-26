import type {
  ChatDependencies,
  ChatUnitOfWork,
} from '@/modules/capture/application/chat-dependencies';

import { FakeAccountRepository } from './fake-account.repository';
import { FakeBudgetRepository } from './fake-budget.repository';
import { FakeBudgetAlertLog } from './fake-budget-alert-log';
import { FakeCaptureEventRepository } from './fake-capture-event.repository';
import { FakeCategoryRepository } from './fake-category.repository';
import { FakeChatLinkRepository } from './fake-chat-link.repository';
import { FakeInstallmentPlanRepository } from './fake-installment-plan.repository';
import { FakeMerchantRuleRepository } from './fake-merchant-rule.repository';
import { FakeRecurringTransactionRepository } from './fake-recurring-transaction.repository';
import { FakeTransactionRepository } from './fake-transaction.repository';
import { FakeViewPreferenceRepository } from './fake-view-preference.repository';
import { FakeWalletCardRepository } from './fake-wallet-card.repository';

/** Every repository the chat touches, in memory, and a unit of work over them. */
export function fakeChatDependencies() {
  const deps = {
    captureEvents: new FakeCaptureEventRepository(),
    walletCards: new FakeWalletCardRepository(),
    merchantRules: new FakeMerchantRuleRepository(),
    categories: new FakeCategoryRepository(),
    accounts: new FakeAccountRepository(),
    transactions: new FakeTransactionRepository(),
    chatLinks: new FakeChatLinkRepository(),
    installmentPlans: new FakeInstallmentPlanRepository(),
    budgets: new FakeBudgetRepository(),
    budgetAlerts: new FakeBudgetAlertLog(),
    recurringTransactions: new FakeRecurringTransactionRepository(),
    viewPreferences: new FakeViewPreferenceRepository(),
  } satisfies ChatDependencies;
  const run: ChatUnitOfWork = (work) => work(deps);
  return { deps, run };
}
