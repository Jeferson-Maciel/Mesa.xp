import { beforeEach, describe, expect, it } from 'vitest';
import * as historico from './historico.js';

// O localStorage de mentira (o ambiente dos testes é o node). Contas fictícias.
beforeEach(() => {
  const dados = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k)
  };
});

describe('o histórico do Ordens e a Fila (Fase 3)', () => {
  it('guarda as correções do cartão junto do texto', () => {
    const correcoes = { solicitacoes: [{ indice: 0, conta: '1234567', campos: {}, editadas: [], removidas: [], novas: [], confirmados: ['bolsa|repetido-hoje'] }] };
    const e = historico.registrar({ conta: '1234567', ativos: ['PETR4'], formato: 'E-mail', textoOriginal: '1234567\nC PETR4 100', correcoes });
    expect(historico.listar()[0]).toMatchObject({ id: e.id, correcoes });
  });

  it('o mesmo texto copiado de novo não duplica, mas fica com as correções de agora', () => {
    const a = historico.registrar({ conta: '1234567', formato: 'E-mail', textoOriginal: 'x', correcoes: null });
    const b = historico.registrar({ conta: '1234567', formato: 'E-mail', textoOriginal: 'x', correcoes: { solicitacoes: [] } });
    expect(b.id).toBe(a.id);
    expect(historico.listar()).toHaveLength(1);
    expect(historico.listar()[0].correcoes).toEqual({ solicitacoes: [] });
  });

  it('liga a entrada ao cartão da Fila, sem repetir', () => {
    const e = historico.registrar({ conta: '1234567', formato: 'E-mail', textoOriginal: 'x' });
    historico.vincularPedido(e.id, 'p1');
    historico.vincularPedido(e.id, 'p1');
    historico.vincularPedido(e.id, 'p2');
    expect(historico.listar()[0].pedidos).toEqual(['p1', 'p2']);
  });
});
