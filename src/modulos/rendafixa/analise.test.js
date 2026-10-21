import { describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { DATA_GOLDEN } from './golden/referencia.js';
import { montarTexto, processRows } from './motor.js';
import { aliquotaDoIR, destaqueDaSecao, equivalenteBruto, forcaDaTaxa, trechosDaMensagem, tributadoDoMesmoPrazo } from './analise.js';

const hoje = new Date(DATA_GOLDEN);
const primario = processRows(LINHAS_SINTETICAS, false, hoje);

describe('a alíquota do IR pelos dias', () => {
  it.each([
    [90, 22.5],
    [180, 22.5],
    [181, 20],
    [360, 20],
    [361, 17.5],
    [720, 17.5],
    [721, 15],
    [1825, 15]
  ])('%i dias: %f%%', (dias, ir) => expect(aliquotaDoIR(dias)).toBe(ir));
});

describe('a equivalência do isento', () => {
  it('pré e % do CDI: a taxa dividida por (1 − alíquota)', () => {
    expect(equivalenteBruto({ taxa: 10.95, indexador: 'PRE', dias: 400 })).toEqual({ taxa: 10.95 / 0.825, ir: 17.5 });
    expect(equivalenteBruto({ taxa: 89, indexador: 'CDI', dias: 730 })).toEqual({ taxa: 89 / 0.85, ir: 15 });
  });

  it('IPCA+, CDI+ ou sem os dias: nada', () => {
    expect(equivalenteBruto({ taxa: 5.2, indexador: 'IPCA', dias: 730 })).toBeNull();
    expect(equivalenteBruto({ taxa: 1, indexador: 'CDI+', dias: 730 })).toBeNull();
    expect(equivalenteBruto({ taxa: 10, indexador: 'PRE', dias: null })).toBeNull();
  });

  it('compara com o tributado da mensagem no mesmo prazo e na mesma unidade', () => {
    const secoes = [
      { id: 'pre', itens: [{ prazo: 1, indexador: 'PRE', taxa: 14.2 }, { prazo: 2, indexador: 'PRE', taxa: 14.3 }] },
      { id: 'pos', itens: [{ prazo: 2, indexador: 'CDI', taxa: 105 }, { prazo: 2, indexador: 'CDI+', taxa: 1.2 }] }
    ];
    expect(tributadoDoMesmoPrazo({ prazo: 2, indexador: 'PRE' }, secoes).taxa).toBe(14.3);
    expect(tributadoDoMesmoPrazo({ prazo: 2, indexador: 'CDI' }, secoes).taxa).toBe(105);
    expect(tributadoDoMesmoPrazo({ prazo: 3, indexador: 'PRE' }, secoes)).toBeNull();
    expect(tributadoDoMesmoPrazo({ prazo: 2, indexador: 'IPCA' }, secoes)).toBeNull();
  });
});

describe('os destaques', () => {
  it('a maior taxa da unidade que mais aparece; no empate, o prazo mais curto', () => {
    const secao = {
      itens: [
        { prazo: 1, indexador: 'CDI', taxa: 105 },
        { prazo: 2, indexador: 'CDI+', taxa: 2 },
        { prazo: 3, indexador: 'CDI', taxa: 106.5 },
        { prazo: 4, indexador: 'CDI', taxa: 106.5 }
      ]
    };
    expect(destaqueDaSecao(secao)).toMatchObject({ prazo: 3, taxa: 106.5 });
    expect(destaqueDaSecao({ itens: [] })).toBeNull();
  });

  it('a força da taxa: um quarto para a menor, cheia para a maior, só na mesma unidade', () => {
    const secao = { itens: [{ indexador: 'PRE', taxa: 10 }, { indexador: 'PRE', taxa: 12 }, { indexador: 'CDI', taxa: 100 }] };
    expect(forcaDaTaxa(secao.itens[0], secao)).toBe(0.25);
    expect(forcaDaTaxa(secao.itens[1], secao)).toBe(1);
    expect(forcaDaTaxa(secao.itens[2], secao)).toBe(1);
  });
});

describe('os trechos da mensagem', () => {
  const texto = montarTexto(primario);
  const trechos = trechosDaMensagem(texto, primario.secoes);
  const titulo = texto.split('\n')[0];

  it('um por seção com oportunidade, cada um com o título e o bloco dela, como na mensagem', () => {
    const ids = primario.secoes.filter((s) => s.itens.length).map((s) => s.id);
    expect(Object.keys(trechos)).toEqual(ids);
    for (const trecho of Object.values(trechos)) {
      expect(trecho.startsWith(`${titulo}\n\n*`)).toBe(true);
      expect(texto).toContain(trecho.slice(titulo.length + 2));
    }
    expect(trechos.pre).toContain('*Taxas pré fixadas:*');
  });

  it('juntos, refazem a mensagem inteira', () => {
    const blocos = Object.values(trechos).map((t) => t.slice(titulo.length + 2));
    expect(`${titulo}\n\n${blocos.join('\n\n')}`).toBe(texto.trimEnd());
  });

  it('sem mensagem, ou numa forma inesperada, nada', () => {
    expect(trechosDaMensagem('', primario.secoes)).toEqual({});
    expect(trechosDaMensagem('uma linha só', primario.secoes)).toEqual({});
  });
});

describe('os dias no resultado do motor', () => {
  it('cada item da mensagem leva os dias até o vencimento', () => {
    for (const secao of primario.secoes) for (const item of secao.itens) expect(item.dias).toBeGreaterThan(0);
  });
});
