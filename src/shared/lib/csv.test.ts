import { describe, expect, it } from 'vitest';

import { buildCsv, parseCsv } from './csv';

describe('buildCsv', () => {
  it('joins rows and fields with commas and CRLF', () => {
    const csv = buildCsv([
      ['Data', 'Descrição'],
      ['2026-08-20', 'Supermercado'],
    ]);

    expect(csv).toBe('Data,Descrição\r\n2026-08-20,Supermercado');
  });

  it('quotes a field containing a comma', () => {
    const csv = buildCsv([['Aluguel, condomínio e luz']]);
    expect(csv).toBe('"Aluguel, condomínio e luz"');
  });

  it('quotes and escapes a field containing a quote', () => {
    const csv = buildCsv([['Presente "surpresa"']]);
    expect(csv).toBe('"Presente ""surpresa"""');
  });
});

describe('parseCsv', () => {
  it('parses a simple CSV back into rows', () => {
    const rows = parseCsv('Data,Descrição\r\n2026-08-20,Supermercado');
    expect(rows).toEqual([
      ['Data', 'Descrição'],
      ['2026-08-20', 'Supermercado'],
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const rows = parseCsv('﻿Data,Valor\r\n2026-08-20,10.00');
    expect(rows[0]).toEqual(['Data', 'Valor']);
  });

  it('handles a trailing line with no final newline', () => {
    const rows = parseCsv('a,b\nc,d');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('round-trip', () => {
  it('recovers the same rows after building and reparsing a CSV', () => {
    const rows = [
      ['Data', 'Descrição', 'Conta', 'Categoria', 'Tipo', 'Valor'],
      [
        '2026-08-20',
        'Aluguel, condomínio e luz',
        'Conta corrente',
        'Moradia',
        'Despesa',
        '1500.00',
      ],
      ['2026-08-15', 'Presente "surpresa"', 'Carteira', '', 'Despesa', '80.00'],
    ];

    const csv = buildCsv(rows);
    expect(parseCsv(csv)).toEqual(rows);
  });

  it('round-trips a field containing a comma', () => {
    const rows = [['Supermercado, feira e padaria']];
    expect(parseCsv(buildCsv(rows))).toEqual(rows);
  });

  it('round-trips a field containing a quote', () => {
    const rows = [['Ele disse "oi"']];
    expect(parseCsv(buildCsv(rows))).toEqual(rows);
  });
});
