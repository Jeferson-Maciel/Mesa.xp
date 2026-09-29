import { describe, expect, it } from 'vitest';
import { gerar } from './saidas.js';

const solicitacao = (ordem) => ({
  conta: '1234567',
  descartadas: [],
  horario: null,
  ordens: [{ ativo: 'IVVB11', operacao: 'C', quantidade: 7, financeiro: null, preco: null, ...ordem }]
});

describe('gerar', () => {
  // A tabela vai em HTML para chegar em grade no Outlook; o texto com TAB vai junto, para onde
  // HTML não entra.
  it('entrega a auditoria em tabela e em texto com TAB', () => {
    const saida = gerar(solicitacao(), 'auditoria', new Set());
    expect(saida.html).toContain('<table');
    expect(saida.texto).toContain('Simples\t1234567\tIVVB11\tC\tA mercado\t7');
  });

  it('entrega os outros formatos só em texto', () => {
    expect(gerar(solicitacao(), 'lote', new Set()).html).toBeNull();
  });

  // A comporta não pode depender de o botão estar escondido: confirmar um bloqueio que não se
  // confirma escreveria `null` na coluna Qtd. Total.
  it('ignora a confirmação de um bloqueio que não é confirmável', () => {
    const porValor = solicitacao({ quantidade: null, financeiro: 50000 });
    expect(gerar(porValor, 'lote', new Set(['financeiro-em-lote-simples']))).toBeNull();
  });

  it('gera o e-mail em tabela de uma ordem por valor, com a coluna Financeiro', () => {
    const saida = gerar(solicitacao({ quantidade: null, financeiro: 50000 }), 'auditoria', new Set());
    expect(saida.texto).toContain('Simples\t1234567\tIVVB11\tC\tA mercado\tR$ 50.000,00');
    expect(saida.html).toContain('Financeiro');
  });
});
