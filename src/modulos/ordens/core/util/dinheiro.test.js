import { describe, expect, it } from 'vitest';
import { formatarFinanceiro, lerFinanceiro } from './dinheiro.js';

describe('lerFinanceiro', () => {
  it('lê o padrão brasileiro completo', () => {
    expect(lerFinanceiro('R$ 11.000,00')).toBe(11000);
    expect(lerFinanceiro('R$ 50.000,00')).toBe(50000);
  });

  it('lê valor sem centavos', () => {
    expect(lerFinanceiro('R$ 34.800')).toBe(34800);
  });

  it('lê valor sem separador de milhar', () => {
    expect(lerFinanceiro('R$ 11000,50')).toBe(11000.5);
  });

  it('lê valor colado a uma observação entre parênteses', () => {
    expect(lerFinanceiro('R$ 34.800(não ultrapassar esse valor)')).toBe(34800);
  });

  it('devolve null quando não há número', () => {
    expect(lerFinanceiro('R$')).toBeNull();
    expect(lerFinanceiro('')).toBeNull();
    expect(lerFinanceiro(null)).toBeNull();
  });

  it('não confunde o ponto de milhar com decimal', () => {
    expect(lerFinanceiro('R$ 1.234')).toBe(1234);
    expect(lerFinanceiro('R$ 1.234,56')).toBe(1234.56);
  });
});

describe('formatarFinanceiro', () => {
  it('formata no padrão R$ X.XXX,XX', () => {
    expect(formatarFinanceiro(11000)).toBe('R$ 11.000,00');
    expect(formatarFinanceiro(34800)).toBe('R$ 34.800,00');
    expect(formatarFinanceiro(1234.5)).toBe('R$ 1.234,50');
  });

  it('formata valores pequenos e milhões', () => {
    expect(formatarFinanceiro(50)).toBe('R$ 50,00');
    expect(formatarFinanceiro(1000000)).toBe('R$ 1.000.000,00');
  });

  it('usa espaço normal, não espaço não separável, para colar em planilha', () => {
    expect(formatarFinanceiro(1000)).toBe('R$ 1.000,00');
    expect(formatarFinanceiro(1000)).not.toMatch(/\u00a0/);
  });

  it('devolve string vazia sem valor', () => {
    expect(formatarFinanceiro(null)).toBe('');
  });
});
