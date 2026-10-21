import { beforeEach, describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';

import {
  ChangeMerchantRuleCategoryUseCase,
  ForgetMerchantRuleUseCase,
} from './merchant-rules.use-case';

const NOW = new Date('2026-10-19T15:00:00.000Z');

function category(id: string, userId = 'user-1', archived = false) {
  return new Category({
    id,
    userId,
    name: id,
    archived,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('the merchants Hermes remembers', () => {
  let rules: FakeMerchantRuleRepository;
  let categories: FakeCategoryRepository;

  beforeEach(async () => {
    rules = new FakeMerchantRuleRepository();
    categories = new FakeCategoryRepository();
    await categories.save(category('restaurantes'));
    await categories.save(category('mercado'));
    await categories.save(category('antiga', 'user-1', true));
    await categories.save(category('alheia', 'user-2'));
    await rules.save(
      new MerchantRule({
        id: 'rule-1',
        userId: 'user-1',
        merchantKey: 'padaria real',
        displayName: 'Padaria Real',
        categoryId: 'restaurantes',
        hits: 4,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('files a merchant under another category from now on', async () => {
    await new ChangeMerchantRuleCategoryUseCase(rules, categories).execute({
      userId: 'user-1',
      ruleId: 'rule-1',
      categoryId: 'mercado',
    });

    const rule = await rules.findByKey('user-1', 'padaria real');
    expect(rule?.categoryId).toBe('mercado');
    expect(rule?.hits).toBe(1);
  });

  it('refuses a category that is archived or someone else’s, and a rule that is', async () => {
    const change = new ChangeMerchantRuleCategoryUseCase(rules, categories);

    await expect(
      change.execute({
        userId: 'user-1',
        ruleId: 'rule-1',
        categoryId: 'antiga',
      }),
    ).rejects.toMatchObject({ code: 'CATEGORY_ARCHIVED' });
    await expect(
      change.execute({
        userId: 'user-1',
        ruleId: 'rule-1',
        categoryId: 'alheia',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      change.execute({
        userId: 'user-2',
        ruleId: 'rule-1',
        categoryId: 'alheia',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await rules.findById('rule-1'))?.categoryId).toBe('restaurantes');
  });

  it('forgets a merchant, only for its owner', async () => {
    const forget = new ForgetMerchantRuleUseCase(rules);

    await expect(
      forget.execute({ userId: 'user-2', ruleId: 'rule-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await forget.execute({ userId: 'user-1', ruleId: 'rule-1' });

    expect(await rules.findByUserId('user-1')).toEqual([]);
  });
});
