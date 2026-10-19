const INSTALLMENT_SUFFIX = /\s*\((\d+\/\d+)\)\s*$/;

export interface TransactionOrigin {
  description: string;
  /** How the transaction came in when not typed by hand: "Parcela 3/10". */
  origin?: string;
}

/**
 * "Geladeira (4/10)" reads as "Geladeira" with the mark "Parcela 4/10"; a
 * transaction a recurrence wrote is marked "Recorrente", and one the
 * iPhone reported from an Apple Pay payment, "Apple Pay".
 */
export function splitOrigin(transaction: {
  description: string;
  installmentPlanId?: string | null;
  recurringRuleId?: string | null;
  source?: string;
}): TransactionOrigin {
  const installment = transaction.installmentPlanId
    ? INSTALLMENT_SUFFIX.exec(transaction.description)
    : null;
  if (installment) {
    return {
      description: transaction.description.slice(0, installment.index),
      origin: `Parcela ${installment[1]}`,
    };
  }
  if (transaction.recurringRuleId) {
    return { description: transaction.description, origin: 'Recorrente' };
  }
  return transaction.source === 'wallet'
    ? { description: transaction.description, origin: 'Apple Pay' }
    : { description: transaction.description };
}
