import { describe, expect, it } from 'vitest';
import { formatarFinanceiro, lerFinanceiro, porExtenso } from './dinheiro.js';

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

describe('porExtenso', () => {
  it('escreve valores redondos em reais', () => {
    expect(porExtenso(50000)).toBe('Cinquenta mil reais');
    expect(porExtenso(1000)).toBe('Mil reais');
    expect(porExtenso(100)).toBe('Cem reais');
    expect(porExtenso(1)).toBe('Um real');
    expect(porExtenso(1000000)).toBe('Um milhão de reais');
  });

  it('escreve valores com centavos', () => {
    expect(porExtenso(45023.17)).toBe('Quarenta e cinco mil e vinte e três reais e dezessete centavos');
    expect(porExtenso(1234.5)).toBe('Mil duzentos e trinta e quatro reais e cinquenta centavos');
    expect(porExtenso(0.5)).toBe('Cinquenta centavos');
  });

  // O "e" entre as casas, como se lê: antes de um grupo menor que 100 ou de uma centena redonda.
  it('o "e" entre mil, milhão e o resto, como se fala', () => {
    expect(porExtenso(1100)).toBe('Mil e cem reais');
    expect(porExtenso(2300)).toBe('Dois mil e trezentos reais');
    expect(porExtenso(2340)).toBe('Dois mil trezentos e quarenta reais');
    expect(porExtenso(1200000)).toBe('Um milhão e duzentos mil reais');
    expect(porExtenso(1250000)).toBe('Um milhão duzentos e cinquenta mil reais');
    expect(porExtenso(2000050)).toBe('Dois milhões e cinquenta reais');
    expect(porExtenso(1001000)).toBe('Um milhão e mil reais');
  });

  it('os centavos pelo valor arredondado: 0,999 é um real, não "cem centavos"', () => {
    expect(porExtenso(0.999)).toBe('Um real');
    expect(porExtenso(10.01)).toBe('Dez reais e um centavo');
  });

  it('devolve vazio para valores nulos ou inválidos', () => {
    expect(porExtenso(null)).toBe('');
    expect(porExtenso(0)).toBe('');
    expect(porExtenso(-50)).toBe('');
  });
});

