import { describe, expect, it } from 'vitest';
import {
  CHAVE_HISTORICO,
  MAX_HISTORICO,
  buscarReferencia,
  excluir,
  lerHistorico,
  novoRegistro,
  registroSecundario,
  salvar,
  variacao
} from './historico.js';

const memoria = (inicial = {}) => {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    dados
  };
};

const resultado = (secundario = false) => ({
  secundario,
  totais: { lidos: 890, exibidos: 2 },
  secoes: [
    { id: 'pre', itens: [{ prazo: 1, taxa: 14.2, indexador: 'PRE', tipo: 'CDB' }] },
    { id: 'pos', itens: [] },
    { id: 'ipca', itens: [] },
    { id: 'isentos', itens: [{ prazo: 2, taxa: 89, indexador: 'CDI', tipo: 'LCA', sub: 'CDI' }] }
  ]
});

describe('histórico do Renda Fixa', () => {
  it('usa a mesma chave e o mesmo limite do RendaFixa Pro', () => {
    expect(CHAVE_HISTORICO).toBe('rendafixa_history');
    expect(MAX_HISTORICO).toBe(20);
  });

  it('grava o registro no formato do original, com as taxas compactas para as variações', () => {
    const agora = new Date('2026-09-23T15:00:00-03:00');
    const registro = novoRegistro({ resultado: resultado(), texto: '*Oportunidades*', arquivo: 'xp.xlsx' }, agora);
    expect(registro).toEqual({
      id: agora.getTime(),
      resultado: '*Oportunidades*',
      total_ativos: 890,
      total_oportunidades: 2,
      created_at: agora.toISOString(),
      modo: 'primario',
      arquivo: 'xp.xlsx',
      itens: [
        { s: 'pre', p: 1, t: 14.2, x: 'PRE', u: '' },
        { s: 'isentos', p: 2, t: 89, x: 'CDI', u: 'CDI' }
      ]
    });
  });

  it('põe o mais recente primeiro e guarda no máximo 20', () => {
    const armazenamento = memoria();
    for (let i = 0; i < 25; i++) salvar({ id: i }, armazenamento);
    const lista = lerHistorico(armazenamento);
    expect(lista).toHaveLength(20);
    expect(lista[0].id).toBe(24);
  });

  it('exclui pelo id', () => {
    const armazenamento = memoria();
    salvar({ id: 1 }, armazenamento);
    salvar({ id: 2 }, armazenamento);
    excluir(1, armazenamento);
    expect(lerHistorico(armazenamento).map((r) => r.id)).toEqual([2]);
  });

  it('não quebra com armazenamento corrompido ou bloqueado', () => {
    expect(lerHistorico(memoria({ [CHAVE_HISTORICO]: '{nao é json' }))).toEqual([]);
    expect(lerHistorico(memoria({ [CHAVE_HISTORICO]: '{"a":1}' }))).toEqual([]);
    const bloqueado = { getItem: () => { throw new Error('negado'); }, setItem: () => { throw new Error('negado'); } };
    expect(lerHistorico(bloqueado)).toEqual([]);
    expect(salvar({ id: 1 }, bloqueado)).toBe(false);
  });

  it('lê registros antigos sem "modo" pelo título da mensagem', () => {
    expect(registroSecundario({ resultado: '*Oportunidades de RENDA FIXA hoje!* ⭐ (MERCADO SECUNDÁRIO)' })).toBe(true);
    expect(registroSecundario({ resultado: '*Oportunidades de RENDA FIXA hoje!* ⭐' })).toBe(false);
    expect(registroSecundario({})).toBe(false);
  });
});

describe('variações do dia', () => {
  const agora = new Date('2026-09-23T10:00:00-03:00');
  const ontem = { id: 1, modo: 'primario', created_at: '2026-09-22T18:00:00.000Z', itens: [{ s: 'pre', p: 1, t: 14.05, x: 'PRE', u: '' }] };
  const hojeCedo = { id: 2, modo: 'primario', created_at: '2026-09-23T12:00:00.000Z', itens: [{ s: 'pre', p: 1, t: 13, x: 'PRE', u: '' }] };
  const secundario = { id: 3, modo: 'secundario', created_at: '2026-09-21T18:00:00.000Z', itens: [] };
  const semItens = { id: 4, created_at: '2026-09-20T18:00:00.000Z', resultado: '...' };

  it('compara com a última análise salva ANTES de hoje, no mesmo mercado', () => {
    expect(buscarReferencia([hojeCedo, ontem, secundario], false, agora)).toBe(ontem);
    expect(buscarReferencia([hojeCedo, ontem, secundario], true, agora)).toBe(secundario);
  });

  it('ignora registros antigos, sem as taxas compactas', () => {
    expect(buscarReferencia([semItens], false, agora)).toBeNull();
  });

  it('dá a diferença em pontos, arredondada a centésimos', () => {
    const v = variacao({ prazo: 1, taxa: 14.2, indexador: 'PRE' }, 'pre', ontem);
    expect(v.diferenca).toBe(0.15);
    expect(v.anterior.t).toBe(14.05);
  });

  it('não mostra variação sem referência, sem o mesmo prazo ou quando a taxa não mudou', () => {
    expect(variacao({ prazo: 1, taxa: 14.2, indexador: 'PRE' }, 'pre', null)).toBeNull();
    expect(variacao({ prazo: 2, taxa: 14.2, indexador: 'PRE' }, 'pre', ontem)).toBeNull();
    expect(variacao({ prazo: 1, taxa: 14.05, indexador: 'PRE' }, 'pre', ontem)).toBeNull();
  });

  it('não compara % do CDI com CDI + spread no mesmo prazo', () => {
    const ref = { created_at: '2026-09-22T18:00:00.000Z', itens: [{ s: 'pos', p: 2, t: 1.2, x: 'CDI+', u: '' }] };
    expect(variacao({ prazo: 2, taxa: 105, indexador: 'CDI' }, 'pos', ref)).toBeNull();
  });
});
