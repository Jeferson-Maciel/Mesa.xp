import { describe, expect, it } from 'vitest';
import {
  diaAnteriorComFoto,
  filtrarPrateleira,
  fotoDaPrateleira,
  guardarFoto,
  linhasDaPrateleira,
  mudancasNaPrateleira,
  ordenarPrateleira,
  semMudanca
} from './regras.js';

// Fundos e números inventados.
const fundo = (id, nome, extra = {}) => ({ id, nome, ticker: null, desagio: 6, desagioMinimo: 5.5, pu: 8, estoque: 1000, aplicacaoMinima: 10, corretagem: 1.5, p2p: null, ...extra });
const ESTOQUE = {
  fundos: [
    fundo('a', 'Valora Imobiliário', { ticker: 'VGPR11' }),
    fundo('b', 'Navi Hedge Fund', { desagio: 8.75, desagioMinimo: 8.25, estoque: 0, p2p: { pode: true, desagio: 8.9, estoque: 500 } }),
    fundo('c', 'Riza Terrax Vintage', { desagio: 2, desagioMinimo: null })
  ]
};

describe('as linhas da prateleira', () => {
  it('o ROA máximo é o deságio menos o mínimo, e só com os dois', () => {
    const linhas = linhasDaPrateleira(ESTOQUE);
    expect(linhas.map((l) => l.roaMaximo)).toEqual([0.5, 0.5, null]);
    expect(linhas[1].clientes).toEqual({ desagio: 8.9, estoque: 500 });
    expect(linhasDaPrateleira(null)).toEqual([]);
  });

  it('filtra pelo nome ou ticker, sem acento, pelo estoque XP e pelo Estoque clientes aberto', () => {
    const linhas = linhasDaPrateleira(ESTOQUE);
    expect(filtrarPrateleira(linhas, { termo: 'imobiliario' }).map((l) => l.chave)).toEqual(['a']);
    expect(filtrarPrateleira(linhas, { termo: 'vgpr' }).map((l) => l.chave)).toEqual(['a']);
    expect(filtrarPrateleira(linhas, { comEstoque: true }).map((l) => l.chave)).toEqual(['a', 'c']);
    expect(filtrarPrateleira(linhas, { estoqueClientes: true }).map((l) => l.chave)).toEqual(['b']);
  });

  it('ordena pelo campo; o que não tem o valor vai para o fim nos dois sentidos', () => {
    const linhas = linhasDaPrateleira(ESTOQUE);
    expect(ordenarPrateleira(linhas, 'desagio', 'desc').map((l) => l.chave)).toEqual(['b', 'a', 'c']);
    expect(ordenarPrateleira(linhas, 'roaMaximo', 'asc').map((l) => l.chave)).toEqual(['a', 'b', 'c']);
    expect(ordenarPrateleira(linhas, 'roaMaximo', 'desc').map((l) => l.chave)).toEqual(['a', 'b', 'c']);
    expect(ordenarPrateleira(linhas, 'nome', 'asc').map((l) => l.chave)).toEqual(['b', 'c', 'a']);
  });
});

describe('o que mudou desde o último dia', () => {
  const ontem = fotoDaPrateleira(linhasDaPrateleira(ESTOQUE));

  it('o fundo que entrou e o que saiu, o deságio e o ROA que mudaram, o estoque que zerou ou voltou', () => {
    const hoje = fotoDaPrateleira(
      linhasDaPrateleira({
        fundos: [
          fundo('a', 'Valora Imobiliário', { ticker: 'VGPR11', desagio: 6.5, desagioMinimo: 5.5, estoque: 0 }),
          fundo('b', 'Navi Hedge Fund', { desagio: 8.75, desagioMinimo: 8.25, estoque: 200 }),
          fundo('d', 'Fundo Novo')
        ]
      })
    );
    expect(mudancasNaPrateleira(ontem, hoje)).toEqual({
      entraram: ['Fundo Novo'],
      sairam: ['Riza Terrax Vintage'],
      desagio: [{ fundo: 'VGPR11 · Valora Imobiliário', de: 6, para: 6.5 }],
      roa: [{ fundo: 'VGPR11 · Valora Imobiliário', de: 0.5, para: 1 }],
      estoque: [
        { fundo: 'VGPR11 · Valora Imobiliário', zerou: true },
        { fundo: 'Navi Hedge Fund', zerou: false }
      ]
    });
  });

  it('nada mudou é nada mudou', () => {
    expect(semMudanca(mudancasNaPrateleira(ontem, ontem))).toBe(true);
  });

  it('guarda uma foto por dia, as dos últimos dias, e acha o dia anterior com foto', () => {
    let fotos = {};
    for (const dia of ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']) fotos = guardarFoto(fotos, dia, { dia }, 3);
    expect(Object.keys(fotos)).toEqual(['2026-10-02', '2026-10-05', '2026-10-06']);
    expect(diaAnteriorComFoto(fotos, '2026-10-06')).toBe('2026-10-05');
    expect(diaAnteriorComFoto(fotos, '2026-10-02')).toBeNull();
  });
});
