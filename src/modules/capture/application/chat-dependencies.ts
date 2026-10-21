import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { ChatLinkRepository } from '@/core/contracts/chat-link-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';

import type { CaptureDependencies } from './capture-wallet-payment.use-case';

/** Every repository the chat touches, bound to one unit of work. */
export interface ChatDependencies extends CaptureDependencies {
  chatLinks: ChatLinkRepository;
  installmentPlans: InstallmentPlanRepository;
  budgets: BudgetRepository;
  recurringTransactions: RecurringTransactionRepository;
  viewPreferences: ViewPreferenceRepository;
}

/**
 * Runs `work` in one unit of work (a database transaction) and hands back
 * its result. The chat is spoken to outside of it, once the work is kept:
 * a message never tells about a change that was rolled back.
 */
export type ChatUnitOfWork = <T>(
  work: (deps: ChatDependencies) => Promise<T>,
) => Promise<T>;
