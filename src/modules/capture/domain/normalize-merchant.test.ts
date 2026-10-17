import { describe, expect, it } from 'vitest';

import { normalizeMerchant } from './normalize-merchant';

describe('normalizeMerchant', () => {
  it.each([
    ['PADARIA REAL LTDA *123', 'padaria real', 'Padaria Real'],
    ['Padaria Real', 'padaria real', 'Padaria Real'],
    ['  padaria   real ', 'padaria real', 'Padaria Real'],
    ['PAG*JoseDaSilva', 'josedasilva', 'JoseDaSilva'],
    ['MP *CAFE DO PONTO', 'cafe do ponto', 'Cafe do Ponto'],
    ['FARMÁCIA SÃO JOÃO S/A', 'farmacia sao joao', 'Farmácia São João'],
    ['iFood', 'ifood', 'iFood'],
    ['Geladeira (4/10)', 'geladeira', 'Geladeira'],
    ['POSTO SHELL 0123', 'posto shell', 'Posto Shell'],
    ['Drogasil 24h', 'drogasil h', 'Drogasil 24h'],
  ])('%s → "%s" / "%s"', (raw, key, displayName) => {
    expect(normalizeMerchant(raw)).toEqual({ key, displayName });
  });

  it('has no key when nothing recognizable is left', () => {
    expect(normalizeMerchant('*1234')).toEqual({
      key: '',
      displayName: '*1234',
    });
  });
});
