'use client';

import { useState } from 'react';

import {
  archiveCategoryAction,
  mergeCategoriesAction,
} from '@/app/categories/actions';
import { pluralize } from '@/app/categories/category-display';
import {
  SuggestionLine,
  useLineAction,
} from '@/app/categories/category-suggestion-line';
import { fileUnderNewCategoryAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CategoriesOverview } from '@/modules/categories/application/get-categories-overview.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';

type Suggestions = CategoriesOverview['suggestions'];

interface CategorySuggestionsProps {
  suggestions: Suggestions;
}

/**
 * The tidy-up suggestions for the month: new categories for purchases
 * that have none, categories gone unused, and look-alike pairs. Each line
 * has one button; the merge asks first, since it moves transactions.
 */
export function CategorySuggestions({ suggestions }: CategorySuggestionsProps) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Sugestões</h2>
      <ul className="divide-border mt-2 divide-y">
        {suggestions.create.map((suggestion) => (
          <CreateLine key={suggestion.key} suggestion={suggestion} />
        ))}
        {suggestions.archive.map((suggestion) => (
          <ArchiveLine key={suggestion.categoryId} suggestion={suggestion} />
        ))}
        {suggestions.merge.map((suggestion) => (
          <MergeLine
            key={`${suggestion.keepId}-${suggestion.mergeId}`}
            suggestion={suggestion}
          />
        ))}
      </ul>
    </Card>
  );
}

type CreateSuggestion = Suggestions['create'][number];

function CreateLine({ suggestion }: { suggestion: CreateSuggestion }) {
  const { isPending, run } = useLineAction();
  const { name, color, transactionIds, total } = suggestion;
  const count = transactionIds.length;

  return (
    <SuggestionLine
      text={
        <>
          <span className="font-medium">{name}</span>:{' '}
          {pluralize(count, 'compra', 'compras')} sem categoria,{' '}
          {formatCurrency(total)}
        </>
      }
      button={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              const result = await fileUnderNewCategoryAction({
                transactionIds,
                name,
                color,
              });
              return result.success
                ? {
                    title: `${name} criada; ${pluralize(count, 'compra classificada', 'compras classificadas')}.`,
                    variant: 'success',
                  }
                : { title: result.error, variant: 'error' };
            })
          }
        >
          {isPending ? 'Aguarde…' : 'Criar e classificar'}
        </Button>
      }
    />
  );
}

type ArchiveSuggestion = Suggestions['archive'][number];

function ArchiveLine({ suggestion }: { suggestion: ArchiveSuggestion }) {
  const { isPending, run } = useLineAction();
  const { categoryId, name } = suggestion;

  return (
    <SuggestionLine
      text={
        <>
          <span className="font-medium">{name}</span> está sem uso há 60 dias ou
          mais.
        </>
      }
      button={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              const result = await archiveCategoryAction(categoryId, true);
              return result.success
                ? { title: 'Categoria arquivada.', variant: 'success' }
                : {
                    title:
                      result.error ??
                      'Não foi possível arquivar esta categoria.',
                    variant: 'error',
                  };
            })
          }
        >
          {isPending ? 'Aguarde…' : 'Arquivar'}
        </Button>
      }
    />
  );
}

type MergeSuggestion = Suggestions['merge'][number];

function MergeLine({ suggestion }: { suggestion: MergeSuggestion }) {
  const [confirming, setConfirming] = useState(false);
  const { isPending, run } = useLineAction();
  const { keepId, keepName, mergeId, mergeName, mergeCount } = suggestion;
  const moved =
    mergeCount === 1 ? '1 transação passa' : `${mergeCount} transações passam`;

  return (
    <SuggestionLine
      text={
        <>
          <span className="font-medium">{mergeName}</span> parece a mesma que{' '}
          <span className="font-medium">{keepName}</span>.
        </>
      }
      button={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setConfirming(true)}
        >
          {isPending ? 'Aguarde…' : 'Juntar'}
        </Button>
      }
    >
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Juntar categorias"
        description={`Juntar ${mergeName} em ${keepName}? ${moved} para ${keepName} e ${mergeName} é arquivada.`}
        confirmLabel="Juntar"
        onConfirm={() => {
          setConfirming(false);
          run(async () => {
            const result = await mergeCategoriesAction({ keepId, mergeId });
            return result.success
              ? { title: 'Categorias juntadas.', variant: 'success' }
              : {
                  title:
                    result.error ?? 'Não foi possível juntar as categorias.',
                  variant: 'error',
                };
          });
        }}
      />
    </SuggestionLine>
  );
}
