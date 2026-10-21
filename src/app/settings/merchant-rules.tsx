'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { foldText } from '@/shared/lib/fold-text';

import {
  changeMerchantRuleCategoryAction,
  forgetMerchantRuleAction,
} from './actions';

export interface MerchantRuleView {
  id: string;
  name: string;
  categoryId: string;
  /** "escolhida 4 vezes seguidas" */
  usage: string;
}

interface MerchantRulesProps {
  rules: MerchantRuleView[];
  categories: Array<{ id: string; name: string }>;
}

/** Past this many, a search box helps find one. */
const SEARCH_FROM = 8;

/**
 * The category Hermes remembers for each merchant (spec 2026-10-17-
 * telegram-apple-pay-design.md §6): the next payment there is filed the
 * same way. Each one can be filed elsewhere, or forgotten.
 */
export function MerchantRules({ rules, categories }: MerchantRulesProps) {
  const [search, setSearch] = useState('');

  if (rules.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum ainda. Quando você escolhe a categoria de uma compra, o Hermes
        lembra do estabelecimento e as próximas já entram nela.
      </p>
    );
  }

  const query = foldText(search).trim();
  const shown = query
    ? rules.filter((rule) => foldText(rule.name).includes(query))
    : rules;

  return (
    <div className="space-y-2">
      {rules.length >= SEARCH_FROM && (
        <Input
          type="search"
          aria-label="Buscar estabelecimento"
          placeholder="Buscar estabelecimento"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <ul>
        {shown.map((rule) => (
          <MerchantRuleRow key={rule.id} rule={rule} categories={categories} />
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nenhum estabelecimento com esse nome.
        </p>
      )}
    </div>
  );
}

function MerchantRuleRow({
  rule,
  categories,
}: {
  rule: MerchantRuleView;
  categories: MerchantRulesProps['categories'];
}) {
  const [categoryId, setCategoryId] = useState(rule.categoryId);
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    const previous = categoryId;
    setCategoryId(next);
    startTransition(async () => {
      const result = await changeMerchantRuleCategoryAction({
        ruleId: rule.id,
        categoryId: next,
      });
      if (!result.success) {
        setCategoryId(previous);
        toast({ title: result.error, variant: 'error' });
      }
    });
  }

  function forget() {
    startTransition(async () => {
      const result = await forgetMerchantRuleAction(rule.id);
      toast(
        result.success
          ? {
              title: `${rule.name} esquecido. A próxima compra lá pergunta a categoria.`,
              variant: 'success',
            }
          : { title: result.error, variant: 'error' },
      );
    });
  }

  const nameId = `merchant-rule-${rule.id}`;
  return (
    <li
      className={cn(
        'dimension-row flex-wrap gap-x-4 gap-y-2 py-3',
        isPending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 basis-40">
        <p id={nameId} className="truncate font-medium">
          {rule.name}
        </p>
        <p className="text-muted-foreground text-xs">{rule.usage}</p>
      </div>
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="text-muted-foreground text-xs">Entra em</span>
        <select
          aria-describedby={nameId}
          value={categoryId}
          disabled={isPending}
          onChange={(event) => change(event.target.value)}
          className={FIELD_BASE_CLASSES}
        >
          {!categories.some((category) => category.id === categoryId) && (
            <option value={categoryId} disabled>
              Categoria arquivada
            </option>
          )}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={forget}
        aria-describedby={nameId}
      >
        Esquecer
      </Button>
    </li>
  );
}
