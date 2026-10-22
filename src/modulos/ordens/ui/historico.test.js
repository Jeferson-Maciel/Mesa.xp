import { describe, expect, it } from 'vitest';
import { htmlItemDoHistorico } from './historico.js';

// Contas fictícias.
const entrada = (extra = {}) => ({ id: 'ord_1', quando: '2026-10-21T13:00:00.000Z', conta: '1234567', ativos: ['PETR4'], formato: 'E-mail', textoOriginal: 'x', pedidos: ['p1'], ...extra });
const pedido = (estado, extra = {}) => ({ id: 'p1', conta: '1234567', estado, ...extra });

describe('o histórico do Ordens mostra o estado do e-mail na Fila (Fase 3)', () => {
  it('o selo diz em que pé o e-mail está, e leva ao cartão', () => {
    const rotulos = ['enviado', 'respondeu', 'aprovado', 'executado', 'cancelado'].map((estado) => {
      const html = htmlItemDoHistorico(entrada(), new Map([['p1', pedido(estado)]]));
      expect(html).toContain(`data-fila="p1"`);
      expect(html).toContain(`data-estado="${estado}"`);
      return html.match(/class="history-fila"[^>]*>([^<]*)</)[1];
    });
    expect(rotulos).toEqual(['Esperando o cliente', 'O cliente respondeu', 'Aprovado', 'Executado', 'Cancelado']);
  });

  it('sem cartão na Fila (o lote, ou apagado depois de 90 dias), sem selo', () => {
    expect(htmlItemDoHistorico(entrada({ pedidos: [] }), new Map())).not.toContain('history-fila');
    expect(htmlItemDoHistorico(entrada(), new Map())).not.toContain('history-fila');
    expect(htmlItemDoHistorico(entrada({ pedidos: undefined }), new Map())).not.toContain('history-fila');
  });

  it('com dois cartões (duas contas no mesmo texto), um selo por cartão, com a conta', () => {
    const html = htmlItemDoHistorico(entrada({ pedidos: ['p1', 'p2'] }), new Map([['p1', pedido('enviado')], ['p2', pedido('executado', { id: 'p2', conta: '7654321' })]]));
    expect(html.match(/class="history-fila"/g)).toHaveLength(2);
    expect(html).toContain('7654321 · Executado');
  });

  it('com as correções guardadas, o Reabrir diz que volta com elas', () => {
    expect(htmlItemDoHistorico(entrada({ correcoes: { solicitacoes: [{}] } }), new Map())).toContain('Reabrir com as correções');
    expect(htmlItemDoHistorico(entrada(), new Map())).toMatch(/data-reabrir="ord_1"[^>]*>Reabrir</);
  });

  it('o que veio de fora passa por esc', () => {
    const html = htmlItemDoHistorico(entrada({ conta: '<img src=x>', ativos: ['<b>'] }), new Map());
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('<b>');
  });
});
