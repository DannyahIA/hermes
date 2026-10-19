import { describe, expect, it } from 'vitest';

import { foldText } from './fold-text';

describe('foldText', () => {
  it('drops case and accents, so "cafe" finds "Café"', () => {
    expect(foldText('Café')).toBe('cafe');
    expect(foldText('AÇAÍ da Esquina')).toBe('acai da esquina');
    expect(foldText('Pão de Açúcar')).toBe('pao de acucar');
  });

  it('leaves everything else as typed', () => {
    expect(foldText('  uber *trip 12 ')).toBe('  uber *trip 12 ');
  });
});
