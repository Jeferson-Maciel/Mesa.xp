import { describe, expect, it } from 'vitest';
import { separarConta } from './separarConta.js';
import { parseSolicitacoes } from '../parse/parseSolicitacoes.js';

// Num pedido real de 20/10/2026, a conta do segundo pedido veio colada no fim da linha do primeiro
// (a quebra de linha se perdeu na colagem). As contas aqui são fictícias.
const COLADO = '1234567\n\nCompra\nLFT - R$ 81.708,17   7654321 \nComprar 2k\nTesouro Selic 2031\nEmail';

describe('separarConta — a conta de outro pedido, colada no fim da linha', () => {
  it('volta a quebra de linha antes da conta, e o pedido vira dois', () => {
    const texto = separarConta(COLADO, '7654321');
    expect(texto).toBe('1234567\n\nCompra\nLFT - R$ 81.708,17\n7654321\nComprar 2k\nTesouro Selic 2031\nEmail');
    const { solicitacoes } = parseSolicitacoes(texto);
    expect(solicitacoes.map((s) => [s.conta, s.ordens.map((o) => [o.ativo, o.financeiro])])).toEqual([
      ['1234567', [['LFT', 81708.17]]],
      ['7654321', [['Tesouro Selic 2031', 2000]]]
    ]);
  });

  it('só a conta inteira, no fim de uma linha com mais coisa antes', () => {
    expect(separarConta('1234567\nPETR4 100 17654321', '7654321')).toBeNull();
    expect(separarConta('7654321\nPETR4 100', '7654321')).toBeNull();
    expect(separarConta('1234567\nPETR4 100\t7654321\r\nVALE3 50', '7654321')).toBe('1234567\nPETR4 100\n7654321\r\nVALE3 50');
  });

  it('não mexe em nada que não seja conta', () => {
    expect(separarConta(COLADO, '12')).toBeNull();
    expect(separarConta(COLADO, '7654321.0')).toBeNull();
  });
});
