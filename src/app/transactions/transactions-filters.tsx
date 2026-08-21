import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface TransactionsFiltersProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  defaultAccountId?: string;
  defaultCategoryId?: string;
  defaultType?: string;
  defaultFrom?: string;
  defaultTo?: string;
}

/**
 * A plain GET form — filtering works without any client JS, matching
 * ui-ux.md's table requirements (filters/sort/search) with the least
 * amount of code.
 */
export function TransactionsFilters({
  accounts,
  categories,
  defaultAccountId,
  defaultCategoryId,
  defaultType,
  defaultFrom,
  defaultTo,
}: TransactionsFiltersProps) {
  return (
    <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" method="get">
      <select
        name="accountId"
        defaultValue={defaultAccountId ?? ''}
        className={FIELD_BASE_CLASSES}
      >
        <option value="">Todas as contas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <select
        name="categoryId"
        defaultValue={defaultCategoryId ?? ''}
        className={FIELD_BASE_CLASSES}
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        name="type"
        defaultValue={defaultType ?? ''}
        className={FIELD_BASE_CLASSES}
      >
        <option value="">Todos os tipos</option>
        {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="from"
        aria-label="De"
        defaultValue={defaultFrom ?? ''}
        className={FIELD_BASE_CLASSES}
      />
      <input
        type="date"
        name="to"
        aria-label="Até"
        defaultValue={defaultTo ?? ''}
        className={FIELD_BASE_CLASSES}
      />
      <button
        type="submit"
        className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        Filtrar
      </button>
    </form>
  );
}
