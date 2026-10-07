import { describe, expect, it } from 'vitest';
import { contaDaBoleta, cotasPara, margemDoPu } from './boleta.js';

const centavos = (n) => Math.round(n * 100) / 100;

/**
 * As três boletas reais de 05/10/2026, como o Hub as mostrou. A planilha traz o PU com duas casas;
 * o PU de cada caso aqui é o que o Hub usou, tirado da própria boleta — e o mesmo PU tem de
 * explicar todos os números dela.
 */
describe('as boletas do Hub', () => {
  it('Riza Renda Imobiliária: 100 cotas, deságio 2,50%, ROA 1,00%', () => {
    const conta = contaDaBoleta({ pu: 101.510457, desagio: 2.5, roa: 1, cotas: 100 });
    expect(conta.desconto).toBeCloseTo(1.5);
    expect(centavos(conta.posicao)).toBe(9998.78);
    expect(centavos(conta.corretagem)).toBe(149.98);
    expect(centavos(conta.remuneracao)).toBe(249.97);
    expect(conta.percentualDaRemuneracao).toBe(2.5);
  });

  // As duas boletas do XPHF11 são do mesmo momento: um PU só tem de explicar as duas.
  const XPHF11 = { pu: 9.686949, desagio: 5.5, cotas: 10000 };

  it('XPHF11 com o ROA no teto de 0,50%', () => {
    const conta = contaDaBoleta({ ...XPHF11, roa: 0.5 });
    expect(centavos(conta.posicao)).toBe(92026.02);
    expect(centavos(conta.corretagem)).toBe(1380.39);
    expect(centavos(conta.remuneracao)).toBe(1840.52);
    expect(conta.percentualDaRemuneracao).toBe(2);
  });

  it('XPHF11 com a barra toda para o cliente: só a corretagem fica', () => {
    const conta = contaDaBoleta({ ...XPHF11, roa: 0 });
    expect(centavos(conta.corretagem)).toBe(1373.13);
    expect(centavos(conta.remuneracao)).toBe(1373.13);
  });

  // 87.381,09 × 1,015 daria 88.691,81; o Hub mostra 88.691,80. Só bate somando sem arredondar a
  // posição antes — que é o que esta conta faz.
  it('CPHF11: o total é a posição mais a corretagem, arredondado só no fim', () => {
    const conta = contaDaBoleta({ pu: 9.3206492, desagio: 6.75, roa: 0.5, cotas: 10000 });
    expect(centavos(conta.posicao)).toBe(87381.09);
    expect(centavos(conta.total)).toBe(88691.8);
  });
});

describe('ágio', () => {
  it('deságio negativo faz o cliente pagar acima do PU', () => {
    const conta = contaDaBoleta({ pu: 100, desagio: -0.5, roa: 0, cotas: 10 });
    expect(conta.desconto).toBe(-0.5);
    expect(centavos(conta.posicao)).toBe(1005);
  });
});

describe('cotas para um valor em R$', () => {
  const CPHF11 = { pu: 9.32, casasDoPu: 2, desagio: 6.75, roa: 0.5 };

  // Pelo PU da planilha seriam 1.804 cotas — R$ 16.000,00 no Hub, no limite. Com a margem, 1.803.
  it('CPHF11, R$ 16.000: 1.803 cotas, abaixo do pedido mesmo no PU real', () => {
    expect(cotasPara(16000, CPHF11)).toBe(1803);
    expect(contaDaBoleta({ ...CPHF11, pu: 9.3206492, cotas: 1803 }).total).toBeLessThan(16000);
  });

  it('a margem é meia unidade da última casa da planilha', () => {
    expect(margemDoPu(2)).toBeCloseTo(0.005);
    expect(margemDoPu(6)).toBeCloseTo(0.0000005);
  });

  it('nunca passa do valor, em qualquer PU que o arredondamento esconda', () => {
    let semente = 7;
    const sorteio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);

    for (let i = 0; i < 2000; i++) {
      const pu = Math.round((0.2 + sorteio() * 1500) * 100) / 100;
      const desagio = Math.round((sorteio() * 20 - 1) * 100) / 100;
      const roa = Math.round(sorteio() * 2 * 100) / 100;
      const valor = Math.round(sorteio() * 500000 * 100) / 100;
      const boleta = { pu, casasDoPu: 2, desagio, roa };

      const cotas = cotasPara(valor, boleta);
      for (const puReal of [pu - 0.005, pu, pu + 0.0049999]) {
        expect(contaDaBoleta({ ...boleta, pu: puReal, cotas }).total).toBeLessThanOrEqual(valor);
      }
      // E é a maior que cabe: uma a mais passaria no PU mais alto que o arredondamento permite.
      expect(contaDaBoleta({ ...boleta, pu: pu + 0.005, cotas: cotas + 1 }).total).toBeGreaterThan(valor);
    }
  });

  it('conta com a corretagem do fundo, quando ela vem', () => {
    const comMenos = cotasPara(16000, { ...CPHF11, corretagem: 1 });
    expect(comMenos).toBeGreaterThan(cotasPara(16000, CPHF11));
    expect(contaDaBoleta({ ...CPHF11, pu: 9.325, corretagem: 1, cotas: comMenos }).total).toBeLessThanOrEqual(16000);
  });

  it('valor que não compra uma cota dá zero', () => {
    expect(cotasPara(50, { pu: 101.51, casasDoPu: 2, desagio: 2.5, roa: 1 })).toBe(0);
  });
});
